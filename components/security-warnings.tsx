"use client"

import { useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { AlertTriangle, ShieldAlert, ShieldCheck, Info } from "lucide-react"
import * as api from "@/lib/mediamtx-api"
import type { GlobalConf, PathConf } from "@/lib/mediamtx-api"

type Severity = "high" | "medium" | "low" | "info"

interface Finding {
  id: string
  severity: Severity
  title: string
  detail: string
}

const DEFAULT_USERS = ["admin", "root", "user", "mediamtx", "test"]
const DEFAULT_PASSWORDS = ["admin", "password", "12345", "root", "mediamtx", "test", "changeme"]

function listensOnPublic(addr?: string) {
  if (!addr) return false
  const a = addr.trim()
  if (a.startsWith(":")) return true
  if (a.startsWith("0.0.0.0")) return true
  if (a.startsWith("[::]")) return true
  return false
}

function severityBadge(s: Severity) {
  const color =
    s === "high"
      ? "bg-red-100 text-red-800 border-red-200"
      : s === "medium"
        ? "bg-amber-100 text-amber-800 border-amber-200"
        : s === "low"
          ? "bg-yellow-50 text-yellow-800 border-yellow-200"
          : "bg-slate-100 text-slate-700 border-slate-200"
  return <Badge variant="outline" className={color}>{s.toUpperCase()}</Badge>
}

/**
 * Heuristic to flag dangerous shell constructs in user-supplied hook
 * commands. Matches subshells, backtick eval, and known download/exec
 * tokens at word boundaries — tightened so `rm-tool` or `sh.exe` no
 * longer false-positive.
 */
const DANGEROUS_HOOK_PATTERN =
  /(?:^|\s)(rm|curl|wget|bash|sh|nc|netcat|chmod|chown|kill|killall|eval|exec)(?:\s|$)|`[^`]*`|\$\([^)]*\)/

export const PATH_HOOK_FIELDS = [
  "runOnInit",
  "runOnDemand",
  "runOnUnDemand",
  "runOnReady",
  "runOnNotReady",
  "runOnRead",
  "runOnUnread",
  "runOnRecordSegmentCreate",
  "runOnRecordSegmentComplete",
] as const

const GLOBAL_HOOK_FIELDS = ["runOnConnect", "runOnDisconnect"] as const

export function evaluateSecurity(config: GlobalConf | null, paths: PathConf[] = []): Finding[] {
  if (!config) return []
  const findings: Finding[] = []

  // 1. Default credentials in internal users
  if (Array.isArray(config.authInternalUsers)) {
    config.authInternalUsers.forEach((u, idx) => {
      const user = String(u.user ?? "").toLowerCase()
      const pass = String(u.pass ?? "").toLowerCase()
      if (user && DEFAULT_USERS.includes(user) && pass && DEFAULT_PASSWORDS.includes(pass)) {
        findings.push({
          id: `default-creds-${user}`,
          severity: "high",
          title: `Tài khoản "${u.user}" dùng mật khẩu mặc định`,
          detail:
            "Đổi mật khẩu hoặc dùng hash Argon2/SHA256 để tránh bị brute-force. Mật khẩu plain với tên user mặc định là mục tiêu phổ biến nhất của tấn công tự động.",
        })
      }
      if (user === "any" && (!pass || pass.length === 0)) {
        findings.push({
          id: `any-no-pass-${idx}`,
          severity: "medium",
          title: 'User "any" không có mật khẩu',
          detail: 'User "any" cho phép truy cập không xác thực. Đảm bảo permissions được giới hạn chặt.',
        })
      }
    })
  }

  // 2. API / metrics / pprof exposed publicly
  if (config.api && listensOnPublic(config.apiAddress as string | undefined)) {
    findings.push({
      id: "api-public",
      severity: "high",
      title: "Control API đang lắng nghe trên mọi địa chỉ",
      detail: `apiAddress = ${config.apiAddress}. Reverse-proxy hoặc bind 127.0.0.1 để hạn chế truy cập. Nếu cần expose, bắt buộc bật TLS + auth.`,
    })
  }
  if (config.metrics && listensOnPublic(config.metricsAddress as string | undefined)) {
    findings.push({
      id: "metrics-public",
      severity: "medium",
      title: "Metrics endpoint expose public",
      detail:
        "Prometheus metrics có thể chứa thông tin nhạy cảm về hạ tầng. Bind 127.0.0.1 hoặc proxy qua auth.",
    })
  }
  if (config.pprof && listensOnPublic(config.pprofAddress as string | undefined)) {
    findings.push({
      id: "pprof-public",
      severity: "high",
      title: "pprof endpoint expose public",
      detail:
        "pprof cho phép profile heap/goroutine/CPU và là vector nguy hiểm cho DoS hoặc rò rỉ thông tin. Chỉ bật pprof khi cần debug, sau đó tắt.",
    })
  }
  if (config.playback && listensOnPublic(config.playbackAddress as string | undefined) && !config.playbackEncryption) {
    findings.push({
      id: "playback-public-no-tls",
      severity: "medium",
      title: "Playback server expose public không bật TLS",
      detail: "Bật playbackEncryption hoặc đặt sau reverse-proxy HTTPS.",
    })
  }

  // 3. Hooks chứa command nguy hiểm (global + per-path)
  for (const hf of GLOBAL_HOOK_FIELDS) {
    const cmd = (config as Record<string, unknown>)[hf]
    if (typeof cmd === "string" && cmd.trim() && DANGEROUS_HOOK_PATTERN.test(cmd)) {
      findings.push({
        id: `hook-global-${hf}`,
        severity: "medium",
        title: `Global hook ${hf} chứa command có khả năng nguy hiểm`,
        detail:
          "Hook chạy với quyền của process MediaMTX. Tránh subshell, eval và download từ Internet. Kiểm tra nguồn command kỹ trước khi enable.",
      })
    }
  }
  for (const p of paths) {
    for (const hf of PATH_HOOK_FIELDS) {
      const cmd = (p as Record<string, unknown>)[hf]
      if (typeof cmd === "string" && cmd.trim() && DANGEROUS_HOOK_PATTERN.test(cmd)) {
        findings.push({
          id: `hook-path-${p.name}-${hf}`,
          severity: "medium",
          title: `Hook ${hf} của path "${p.name}" có command nguy hiểm`,
          detail:
            "Path-level hook chạy với quyền của process MediaMTX. Hạn chế subshell, eval, download từ Internet, hoặc chạy lệnh không trusted.",
        })
      }
    }
  }

  // 4. CORS allow all + auth public
  const apiAllowOrigin = (config as Record<string, unknown>).apiAllowOrigin
  if (config.api && apiAllowOrigin === "*" && listensOnPublic(config.apiAddress as string | undefined)) {
    findings.push({
      id: "api-cors-wild",
      severity: "low",
      title: "API CORS allow origin = *",
      detail: "Kết hợp với API public, mọi trang web có thể gọi API từ trình duyệt người dùng. Giới hạn origin nếu có thể.",
    })
  }

  return findings
}

interface SecurityWarningsProps {
  pollMs?: number
}

export function SecurityWarnings({ pollMs = 60_000 }: SecurityWarningsProps) {
  const [config, setConfig] = useState<GlobalConf | null>(null)
  const [paths, setPaths] = useState<PathConf[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const [c, p] = await Promise.all([api.getGlobalConfig(), api.getPathConfigs().catch(() => [] as PathConf[])])
        if (!cancelled) {
          setConfig(c)
          setPaths(p)
          setError(null)
        }
      } catch (e) {
        if (!cancelled) setError(api.getMediaMtxErrorMessage(e))
      }
    }
    load()
    if (pollMs > 0) {
      const id = window.setInterval(load, pollMs)
      return () => {
        cancelled = true
        window.clearInterval(id)
      }
    }
    return () => {
      cancelled = true
    }
  }, [pollMs])

  const findings = useMemo(() => evaluateSecurity(config, paths), [config, paths])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          {findings.length === 0 ? <ShieldCheck className="h-4 w-4 text-emerald-600" /> : <ShieldAlert className="h-4 w-4 text-amber-600" />}
          Cảnh báo bảo mật
        </CardTitle>
        <CardDescription>
          Quét cấu hình hiện tại để phát hiện mật khẩu mặc định, endpoint expose public và hook đáng ngờ.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 p-2 text-sm text-red-800">{error}</div>
        )}
        {!config && !error && <p className="text-sm text-muted-foreground">Đang tải config…</p>}
        {findings.length === 0 && config && (
          <p className="flex items-center gap-2 text-sm text-emerald-700">
            <ShieldCheck className="h-4 w-4" /> Không phát hiện cấu hình rủi ro phổ biến.
          </p>
        )}
        {findings.map((f) => (
          <div key={f.id} className="rounded-md border p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-600" />
                <div>
                  <div className="text-sm font-medium">{f.title}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{f.detail}</div>
                </div>
              </div>
              {severityBadge(f.severity)}
            </div>
          </div>
        ))}
        <div className="flex items-start gap-2 rounded-md border border-slate-200 bg-slate-50 p-2 text-xs text-slate-700">
          <Info className="mt-0.5 h-3.5 w-3.5" />
          <p>
            Đây là kiểm tra heuristic, không thay thế được security review thực sự. Trước khi expose dashboard ra
            Internet, hãy bắt buộc bật TLS, đặt phía sau reverse-proxy, và giới hạn quyền user theo nguyên tắc
            least-privilege.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

export default SecurityWarnings
