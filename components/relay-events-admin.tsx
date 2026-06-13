"use client"

import { useState } from "react"
import { Plus, Copy, ExternalLink } from "lucide-react"
import { getAuthHeader } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface CreatedEvent {
  pathKey: string
  loginCode: string
  statusToken: string
  configToken: string
}

function basePath() {
  return (process.env.NEXT_PUBLIC_BASE_PATH || "").replace(/\/+$/, "")
}

/**
 * Admin card to spin up a public relay event. The returned login code is shown
 * once and cannot be recovered later — only a salted hash is persisted.
 */
export function RelayEventsAdmin() {
  const [name, setName] = useState("")
  const [quota, setQuota] = useState(10)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [created, setCreated] = useState<CreatedEvent | null>(null)

  const origin = typeof window !== "undefined" ? window.location.origin : ""
  const configUrl = created ? `${origin}${basePath()}/public/config/${created.configToken}` : ""
  const statusUrl = created ? `${origin}${basePath()}/public/status/${created.statusToken}` : ""

  const submit = async () => {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`${basePath()}/api/relay/events`, {
        method: "POST",
        headers: { "content-type": "application/json", Authorization: getAuthHeader() },
        body: JSON.stringify({ displayName: name.trim(), quota }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(body?.error || "Không tạo được sự kiện")
        return
      }
      setCreated(body as CreatedEvent)
      setName("")
    } catch {
      setError("Lỗi kết nối")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="rounded-3xl border-[#dee1e6] bg-white shadow-none">
      <CardHeader>
        <CardTitle>Sự kiện relay (public)</CardTitle>
        <CardDescription>
          Tạo sự kiện = một path với khóa ingest bí mật + link cấu hình/trạng thái để giao cho người dùng.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[220px]">
            <Label htmlFor="evt-name">Tên sự kiện *</Label>
            <Input
              id="evt-name"
              placeholder="VD: Nguyễn Cao Nguyên"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="w-28">
            <Label htmlFor="evt-quota">Quota luồng</Label>
            <Input
              id="evt-quota"
              type="number"
              min={1}
              value={quota}
              onChange={(e) => setQuota(Number(e.target.value) || 1)}
            />
          </div>
          <Button
            className="rounded-full bg-[#0052ff] hover:bg-[#003ecc]"
            onClick={submit}
            disabled={busy || !name.trim()}
          >
            <Plus className="w-4 h-4 mr-2" />
            {busy ? "Đang tạo…" : "Tạo sự kiện"}
          </Button>
        </div>

        {error && <div className="rounded-lg bg-red-50 text-red-700 px-4 py-2 text-sm">{error}</div>}

        {created && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 space-y-3">
            <div className="font-medium text-emerald-800">
              Đã tạo sự kiện. Lưu lại mã đăng nhập — chỉ hiển thị một lần.
            </div>
            <CopyField label="Khóa ingest (path)" value={created.pathKey} />
            <CopyField label="Mã đăng nhập" value={created.loginCode} highlight />
            <CopyField label="Link cấu hình" value={configUrl} openable />
            <CopyField label="Link trạng thái" value={statusUrl} openable />
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function CopyField({
  label,
  value,
  highlight,
  openable,
}: {
  label: string
  value: string
  highlight?: boolean
  openable?: boolean
}) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="space-y-1">
      <div className="text-xs text-emerald-700">{label}</div>
      <div className="flex items-center gap-2">
        <code
          className={`flex-1 rounded border px-3 py-2 text-sm font-mono break-all ${
            highlight ? "bg-white border-emerald-300 font-bold" : "bg-white border-emerald-200"
          }`}
        >
          {value}
        </code>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => {
            navigator.clipboard?.writeText(value)
            setCopied(true)
            setTimeout(() => setCopied(false), 1500)
          }}
        >
          <Copy className="h-4 w-4 mr-1" />
          {copied ? "✓" : "Copy"}
        </Button>
        {openable && (
          <Button size="sm" variant="secondary" onClick={() => window.open(value, "_blank", "noopener,noreferrer")}>
            <ExternalLink className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  )
}
