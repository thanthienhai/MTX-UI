"use client"

import { use, useCallback, useEffect, useState } from "react"
import { Copy, RefreshCw, LogOut, Plus, Pencil, Trash2, Check, X } from "lucide-react"
import { LOGO_SRC } from "@/lib/branding"
import { StreamPlayer } from "@/components/stream-player"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface ConfigDestination {
  id: string
  name: string
  platform: string
  serverUrl: string
  enabled: boolean
  maskedKey: string
}

const PLATFORM_PLACEHOLDERS: Record<string, string> = {
  facebook: "rtmps://live-api-s.facebook.com:443/rtmp/",
  youtube: "rtmp://a.rtmp.youtube.com/live2",
  custom: "rtmp://your.server/app",
}

interface FallbackConfig {
  type: "text" | "image" | "video"
  enabled: boolean
  text?: string
  assetRef?: string
  assetName?: string
  assetMime?: string
}

interface AuditEntry {
  ts: string
  action: string
  detail?: Record<string, unknown>
}

interface ConfigPayload {
  displayName: string
  createdAt: string
  destinations: ConfigDestination[]
  slug: string
  statusToken: string
  configToken: string
  quota: number
  enabledCount: number
  recordEnabled: boolean
  relayEnabled: boolean
  fallback: FallbackConfig | null
  audit: AuditEntry[]
  runtime: {
    online: boolean
    bytesReceived: number
    bytesSent: number
    tracks: string[]
    readers: number
    sourceType: string | null
  }
  ingest: {
    rtmp: string
    rtmps: string
    srt: string
    srtStreamId: string
    srtReadStreamId: string
  }
}

const POLL_MS = 5000

function basePath() {
  return (process.env.NEXT_PUBLIC_BASE_PATH || "").replace(/\/+$/, "")
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes < 0) return "0 bytes"
  const units = ["bytes", "KB", "MB", "GB", "TB"]
  let value = bytes
  let i = 0
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024
    i++
  }
  return `${i === 0 ? value : value.toFixed(2)} ${units[i]}`
}

const PLATFORM_LABELS: Record<string, string> = {
  facebook: "Facebook",
  youtube: "YouTube",
  custom: "Tùy chỉnh",
}

function StatusPill({ on, labelOn = "Online", labelOff = "Offline" }: { on: boolean; labelOn?: string; labelOff?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
        on ? "bg-[#05b169] text-white" : "bg-[#eef0f3] text-[#5b616e]"
      }`}
    >
      <span className={`h-2 w-2 rounded-full ${on ? "bg-white" : "bg-[#9aa0a6]"}`} />
      {on ? labelOn : labelOff}
    </span>
  )
}

export default function PublicConfigPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)
  const apiBase = `${basePath()}/api/public/config/${encodeURIComponent(token)}`

  const [data, setData] = useState<ConfigPayload | null>(null)
  const [needLogin, setNeedLogin] = useState(false)
  const [notFound, setNotFound] = useState(false)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch(apiBase, { cache: "no-store" })
      if (res.status === 401) {
        setNeedLogin(true)
        setData(null)
        return
      }
      if (res.status === 404) {
        setNotFound(true)
        return
      }
      if (!res.ok) return
      setData((await res.json()) as ConfigPayload)
      setNeedLogin(false)
    } catch {
      // keep last good state
    } finally {
      setLoading(false)
    }
  }, [apiBase])

  useEffect(() => {
    load()
  }, [load])

  // Poll only while authenticated.
  useEffect(() => {
    if (needLogin || notFound) return
    const id = setInterval(load, POLL_MS)
    return () => clearInterval(id)
  }, [needLogin, notFound, load])

  const postAction = useCallback(
    async (payload: Record<string, unknown>) => {
      setBusy(true)
      setError(null)
      try {
        const res = await fetch(apiBase, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        })
        const body = await res.json().catch(() => ({}))
        if (!res.ok) {
          setError(body?.error || "Thao tác thất bại")
          return false
        }
        return true
      } catch {
        setError("Lỗi kết nối")
        return false
      } finally {
        setBusy(false)
      }
    },
    [apiBase],
  )

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f7f7f7] text-[#0a0b0d]">
        <div className="text-center">
          <div className="mb-3 inline-block h-8 w-8 animate-spin rounded-full border-b-2 border-[#0a0b0d]" />
          <p className="text-sm text-[#5b616e]">Đang tải…</p>
        </div>
      </div>
    )
  }

  if (notFound) {
    return (
      <CenterCard title="Không tìm thấy sự kiện">
        Liên kết cấu hình không hợp lệ hoặc đã bị thu hồi.
      </CenterCard>
    )
  }

  if (needLogin || !data) {
    return <LoginGate apiBase={apiBase} onSuccess={load} />
  }

  const { runtime, ingest } = data
  const online = runtime.online

  return (
    <div className="min-h-screen bg-[#f7f7f7] text-[#0a0b0d]">
      <div className="bg-[#0a0b0d] text-white">
        <div className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex items-center gap-3">
            <img src={LOGO_SRC} alt="SIPVY" className="h-11 w-auto" />
            <div>
              <h1 className="text-xl font-semibold">Cấu hình sự kiện</h1>
              <p className="text-sm text-[#a8acb3]">{data.displayName}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="secondary"
              className="rounded-full bg-[#16181c] text-white hover:bg-[#23262d]"
              onClick={() => load()}
              disabled={busy}
            >
              <RefreshCw className="h-4 w-4" /> Làm mới
            </Button>
            <Button
              size="sm"
              variant="secondary"
              className="rounded-full bg-white text-[#0a0b0d] hover:bg-[#eef0f3]"
              onClick={async () => {
                await postAction({ action: "logout" })
                setNeedLogin(true)
                setData(null)
              }}
            >
              <LogOut className="h-4 w-4" /> Đăng xuất
            </Button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-5xl space-y-5 px-4 py-8 sm:px-6">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <Card className="rounded-3xl border-[#dee1e6] bg-white shadow-none">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Preview livestream</CardTitle>
              <StatusPill on={online} />
            </CardHeader>
            <CardContent>
              {online ? (
                <StreamPlayer
                  hlsUrl={`${basePath()}/api/public/hls/${encodeURIComponent(data.statusToken)}/index.m3u8`}
                />
              ) : (
                <div
                  className="flex w-full items-center justify-center rounded-2xl bg-[#0a0b0d] text-sm text-[#a8acb3]"
                  style={{ aspectRatio: "16/9" }}
                >
                  Nguồn đang offline. Preview sẽ sẵn sàng khi có tín hiệu.
                </div>
              )}
            </CardContent>
          </Card>

          <div className="space-y-5">
            <Card className="rounded-3xl border-[#dee1e6] bg-white shadow-none">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Tín hiệu nguồn</CardTitle>
                <StatusPill on={online} />
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                <Line label="Nguồn" value={runtime.sourceType || "Chưa có"} />
                <Line label="Tracks" value={runtime.tracks.length ? runtime.tracks.join(", ") : "Chưa có"} />
                <Line label="Người xem preview" value={String(runtime.readers)} />
                <Line
                  label="Dữ liệu"
                  value={`Nhận ${formatBytes(runtime.bytesReceived)} • Gửi ${formatBytes(runtime.bytesSent)}`}
                />
              </CardContent>
            </Card>

            <Card className="rounded-3xl border-[#dee1e6] bg-white shadow-none">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Record</CardTitle>
                <StatusPill on={data.recordEnabled} labelOn="Đang bật" labelOff="Tắt" />
              </CardHeader>
              <CardContent>
                <Button
                  onClick={() => postAction({ action: "set_record", enabled: !data.recordEnabled }).then((ok) => ok && load())}
                  disabled={busy}
                  variant={data.recordEnabled ? "destructive" : "default"}
                >
                  {data.recordEnabled ? "Dừng record" : "Bật record"}
                </Button>
              </CardContent>
            </Card>

            <Card className="rounded-3xl border-[#dee1e6] bg-white shadow-none">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Đẩy stream</CardTitle>
                <StatusPill on={data.relayEnabled} labelOn="Đang đẩy" labelOff="Tắt" />
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="text-sm text-[#5b616e]">
                  Đang bật <strong className="text-[#0a0b0d]">{data.enabledCount}</strong> / {data.quota} luồng
                </div>
                <Button
                  onClick={() => postAction({ action: "set_relay", enabled: !data.relayEnabled }).then((ok) => ok && load())}
                  disabled={busy}
                  variant={data.relayEnabled ? "destructive" : "default"}
                >
                  {data.relayEnabled ? "Dừng stream" : "Bắt đầu stream"}
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>

        <Card className="rounded-3xl border-[#dee1e6] bg-white shadow-none">
          <CardHeader>
            <CardTitle>Thông số cấu hình</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <CopyRow label="RTMPS URL (full key)" value={ingest.rtmps} />
            <CopyRow label="SRT URL" value={ingest.srt} />
            <CopyRow label="SRT Stream ID (đẩy)" value={ingest.srtStreamId} rotatable onRotate={async () => {
              if (!confirm("Tạo mới Stream ID? Stream key cũ sẽ ngừng hoạt động.")) return
              const ok = await postAction({ action: "rotate_stream_id" })
              if (ok) load()
            }} />
            <CopyRow label="SRT Stream ID (nhận)" value={ingest.srtReadStreamId} />
            <div className="pt-1 text-xs text-[#7c828a]">
              Codec khuyến nghị: H.264 + AAC. Facebook không hỗ trợ HEVC.
            </div>
            <CopyRow
              label="Link xem trạng thái"
              value={`${typeof window !== "undefined" ? window.location.origin : ""}${basePath()}/public/status/${data.statusToken}`}
            />
          </CardContent>
        </Card>

        <DestinationsCard
          data={data}
          busy={busy}
          postAction={postAction}
          onChanged={load}
        />

        <FallbackCard
          fallback={data.fallback}
          busy={busy}
          uploadUrl={`${apiBase}/asset`}
          postAction={postAction}
          onChanged={load}
        />

        <AuditCard entries={data.audit} />

        <SecurityCard
          busy={busy}
          postAction={postAction}
          configToken={data.configToken}
          statusToken={data.statusToken}
          onConfigTokenRotated={(newToken) => {
            // Old token is invalid — jump to the new URL.
            window.location.href = `${basePath()}/public/config/${encodeURIComponent(newToken)}`
          }}
          onReload={load}
        />

        <ChangeCodeCard
          onSubmit={async (newCode) => {
            const ok = await postAction({ action: "change_config_code", newCode })
            if (ok) {
              setNeedLogin(true)
              setData(null)
            }
            return ok
          }}
          busy={busy}
        />
      </div>
    </div>
  )
}

interface PostActionFn {
  (payload: Record<string, unknown>): Promise<boolean>
}

function DestinationsCard({
  data,
  busy,
  postAction,
  onChanged,
}: {
  data: ConfigPayload
  busy: boolean
  postAction: PostActionFn
  onChanged: () => void
}) {
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const quotaReached = data.enabledCount >= data.quota
  return (
    <Card className="rounded-3xl border-[#dee1e6] bg-white shadow-none">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Danh sách luồng stream</CardTitle>
        <Button size="sm" onClick={() => setAdding((v) => !v)} disabled={busy}>
          <Plus className="mr-1 h-4 w-4" /> {adding ? "Đóng" : "Thêm luồng"}
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {adding && (
          <DestinationForm
            busy={busy}
            submitLabel="Thêm"
            onCancel={() => setAdding(false)}
            onSubmit={async (input) => {
              const ok = await postAction({ action: "add_destination", ...input })
              if (ok) {
                setAdding(false)
                onChanged()
              }
              return ok
            }}
          />
        )}
        {data.destinations.length === 0 ? (
          <p className="text-sm text-[#7c828a]">Chưa có luồng stream nào. Nhấn “Thêm luồng”.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="text-[#7c828a]">
                  <th className="py-2 pr-2 font-medium">Tên</th>
                  <th className="py-2 pr-2 font-medium">Nền tảng</th>
                  <th className="py-2 pr-2 font-medium">Server</th>
                  <th className="py-2 pr-2 font-medium">Stream key</th>
                  <th className="py-2 pr-2 font-medium">Bật</th>
                  <th className="py-2 pr-2 text-right font-medium">Hành động</th>
                </tr>
              </thead>
              <tbody>
                {data.destinations.map((d) => {
                  if (editingId === d.id) {
                    return (
                      <tr key={d.id} className="border-t border-[#eef0f3]">
                        <td colSpan={6} className="py-3">
                          <DestinationForm
                            initial={{
                              name: d.name,
                              platform: d.platform,
                              serverUrl: d.serverUrl,
                              streamKey: "",
                              enabled: d.enabled,
                            }}
                            keyPlaceholder="Để trống nếu không đổi key"
                            submitLabel="Lưu"
                            busy={busy}
                            onCancel={() => setEditingId(null)}
                            onSubmit={async (input) => {
                              const patch: Record<string, unknown> = {
                                name: input.name,
                                platform: input.platform,
                                serverUrl: input.serverUrl,
                                enabled: input.enabled,
                              }
                              if (input.streamKey.trim()) patch.streamKey = input.streamKey
                              const ok = await postAction({ action: "update_destination", id: d.id, patch })
                              if (ok) {
                                setEditingId(null)
                                onChanged()
                              }
                              return ok
                            }}
                          />
                        </td>
                      </tr>
                    )
                  }
                  return (
                    <tr key={d.id} className="border-t border-[#eef0f3]">
                      <td className="py-2.5 pr-2 text-[#0a0b0d]">{d.name}</td>
                      <td className="py-2.5 pr-2 text-[#5b616e]">{PLATFORM_LABELS[d.platform] || d.platform}</td>
                      <td className="max-w-[180px] break-all py-2.5 pr-2 font-mono text-xs text-[#5b616e]">{d.serverUrl}</td>
                      <td className="py-2.5 pr-2 font-mono text-[#5b616e]">{d.maskedKey}</td>
                      <td className="py-2.5 pr-2">
                        <Button
                          size="sm"
                          variant={d.enabled ? "destructive" : "secondary"}
                          disabled={busy || (!d.enabled && quotaReached)}
                          title={!d.enabled && quotaReached ? "Đã đạt quota" : undefined}
                          onClick={async () => {
                            const ok = await postAction({
                              action: "update_destination",
                              id: d.id,
                              patch: { enabled: !d.enabled },
                            })
                            if (ok) onChanged()
                          }}
                        >
                          {d.enabled ? "Tắt" : "Bật"}
                        </Button>
                      </td>
                      <td className="space-x-1 py-2.5 pr-2 text-right">
                        <Button size="sm" variant="secondary" disabled={busy} onClick={() => setEditingId(d.id)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={busy}
                          onClick={async () => {
                            if (!confirm(`Xóa luồng “${d.name}”?`)) return
                            const ok = await postAction({ action: "delete_destination", id: d.id })
                            if (ok) onChanged()
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        <div className="text-xs text-[#7c828a]">
          Đang bật {data.enabledCount}/{data.quota}. Thêm luồng vẫn được nhưng phải tắt bớt nếu vượt quota khi bật.
        </div>
      </CardContent>
    </Card>
  )
}

function DestinationForm({
  initial,
  submitLabel,
  busy,
  onCancel,
  onSubmit,
  keyPlaceholder,
}: {
  initial?: { name: string; platform: string; serverUrl: string; streamKey: string; enabled: boolean }
  submitLabel: string
  busy: boolean
  onCancel: () => void
  onSubmit: (input: { name: string; platform: string; serverUrl: string; streamKey: string; enabled: boolean }) => Promise<boolean>
  keyPlaceholder?: string
}) {
  const [name, setName] = useState(initial?.name ?? "")
  const [platform, setPlatform] = useState(initial?.platform ?? "facebook")
  const [serverUrl, setServerUrl] = useState(initial?.serverUrl ?? "")
  const [streamKey, setStreamKey] = useState("")
  const [enabled, setEnabled] = useState(initial?.enabled ?? true)
  const canSubmit = name.trim() && serverUrl.trim() && (initial ? true : streamKey.trim())
  return (
    <div className="space-y-2 rounded-2xl border border-[#dee1e6] bg-[#f7f7f7] p-3">
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        <div>
          <Label className="text-xs">Tên</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} className="bg-white" />
        </div>
        <div>
          <Label className="text-xs">Nền tảng</Label>
          <select
            value={platform}
            onChange={(e) => setPlatform(e.target.value)}
            className="w-full rounded-md border border-[#dee1e6] bg-white px-3 py-2 text-sm"
          >
            <option value="facebook">Facebook</option>
            <option value="youtube">YouTube</option>
            <option value="custom">Tùy chỉnh</option>
          </select>
        </div>
        <div className="md:col-span-2">
          <Label className="text-xs">Server URL (rtmp / rtmps / srt)</Label>
          <Input
            value={serverUrl}
            onChange={(e) => setServerUrl(e.target.value)}
            placeholder={PLATFORM_PLACEHOLDERS[platform]}
            className="bg-white font-mono text-xs"
          />
        </div>
        <div className="md:col-span-2">
          <Label className="text-xs">Stream key</Label>
          <Input
            value={streamKey}
            onChange={(e) => setStreamKey(e.target.value)}
            placeholder={keyPlaceholder || "Stream key từ nhà cung cấp"}
            className="bg-white font-mono text-xs"
            type="password"
          />
        </div>
      </div>
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-sm text-[#3c4148]">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          Bật ngay
        </label>
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={onCancel} disabled={busy}>
            <X className="mr-1 h-4 w-4" /> Hủy
          </Button>
          <Button
            size="sm"
            disabled={busy || !canSubmit}
            onClick={async () => {
              await onSubmit({ name, platform, serverUrl, streamKey, enabled })
            }}
          >
            <Check className="mr-1 h-4 w-4" /> {submitLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}

function SecurityCard({
  busy,
  postAction,
  statusToken,
  configToken,
  onConfigTokenRotated,
  onReload,
}: {
  busy: boolean
  postAction: PostActionFn
  statusToken: string
  configToken: string
  onConfigTokenRotated: (newToken: string) => void
  onReload: () => void
}) {
  const [revealedCode, setRevealedCode] = useState<string | null>(null)
  return (
    <Card className="rounded-3xl border-[#dee1e6] bg-white shadow-none">
      <CardHeader>
        <CardTitle>Bảo mật & chia sẻ</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="text-[#5b616e]">
          Token chia sẻ hiện tại: cấu hình <code className="font-mono text-[#0a0b0d]">{configToken.slice(0, 6)}…</code>, trạng thái{" "}
          <code className="font-mono text-[#0a0b0d]">{statusToken.slice(0, 6)}…</code>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="secondary"
            disabled={busy}
            onClick={async () => {
              if (!confirm("Tạo mới token trạng thái? Link trạng thái cũ sẽ ngừng hoạt động.")) return
              const ok = await postAction({ action: "rotate_status_token" })
              if (ok) onReload()
            }}
          >
            Tạo mới token trạng thái
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={busy}
            onClick={async () => {
              if (
                !confirm(
                  "Tạo mới token cấu hình? Link cấu hình cũ sẽ ngừng hoạt động và bạn sẽ được chuyển sang URL mới.",
                )
              )
                return
              const res = await fetch(`${basePath()}/api/public/config/${encodeURIComponent(configToken)}`, {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ action: "rotate_config_token" }),
              })
              const body = await res.json().catch(() => ({}))
              if (res.ok && typeof body.configToken === "string") {
                onConfigTokenRotated(body.configToken)
              }
            }}
          >
            Tạo mới token cấu hình
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={busy}
            onClick={async () => {
              if (!confirm("Tạo mã đăng nhập mới? Mã hiện tại sẽ ngừng hoạt động ngay.")) return
              const res = await fetch(`${basePath()}/api/public/config/${encodeURIComponent(configToken)}`, {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ action: "regenerate_login_code" }),
              })
              const body = await res.json().catch(() => ({}))
              if (res.ok && typeof body.loginCode === "string") {
                setRevealedCode(body.loginCode)
              }
            }}
          >
            Tạo mã đăng nhập mới
          </Button>
        </div>
        {revealedCode && (
          <div className="space-y-2 rounded-2xl border border-[#05b169] bg-[#ecfdf3] p-3">
            <div className="text-xs text-[#05753f]">Mã mới — chỉ hiển thị một lần. Sao chép ngay.</div>
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded border border-[#05b169] bg-white px-3 py-2 font-mono font-bold text-[#0a0b0d]">
                {revealedCode}
              </code>
              <Button
                size="sm"
                onClick={() => {
                  navigator.clipboard?.writeText(revealedCode)
                }}
              >
                <Copy className="mr-1 h-4 w-4" /> Copy
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setRevealedCode(null)}>
                Đóng
              </Button>
            </div>
            <div className="text-xs text-[#05753f]">Phiên hiện tại đã bị thu hồi, bạn sẽ phải đăng nhập lại.</div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function FallbackCard({
  fallback,
  busy,
  uploadUrl,
  postAction,
  onChanged,
}: {
  fallback: FallbackConfig | null
  busy: boolean
  uploadUrl: string
  postAction: PostActionFn
  onChanged: () => void
}) {
  const [type, setType] = useState<"none" | "text" | "image" | "video">(fallback?.type ?? "none")
  const [text, setText] = useState(fallback?.text ?? "Tín hiệu đang gián đoạn — vui lòng chờ.")
  const [enabled, setEnabled] = useState(fallback?.enabled ?? true)
  const [assetRef, setAssetRef] = useState<string | undefined>(fallback?.assetRef)
  const [assetName, setAssetName] = useState<string | undefined>(fallback?.assetName)
  const [assetMime, setAssetMime] = useState<string | undefined>(fallback?.assetMime)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  // Sync local state when fallback payload changes externally.
  useEffect(() => {
    if (fallback) {
      setType(fallback.type)
      if (fallback.text !== undefined) setText(fallback.text)
      setEnabled(fallback.enabled)
      setAssetRef(fallback.assetRef)
      setAssetName(fallback.assetName)
      setAssetMime(fallback.assetMime)
    } else {
      setType("none")
    }
  }, [fallback?.type, fallback?.text, fallback?.enabled, fallback?.assetRef])

  const isAssetType = type === "image" || type === "video"
  const previewUrl = assetRef ? `${basePath()}/api/public/asset/${encodeURIComponent(assetRef)}` : null

  async function onPickFile(file: File) {
    setUploadError(null)
    setUploading(true)
    try {
      const form = new FormData()
      form.append("file", file)
      const res = await fetch(uploadUrl, { method: "POST", body: form })
      const json = (await res.json().catch(() => ({}))) as Record<string, unknown>
      if (!res.ok) {
        setUploadError(typeof json.error === "string" ? json.error : "Tải lên thất bại")
        return
      }
      setAssetRef(json.id as string)
      setAssetName(json.name as string)
      setAssetMime(json.mime as string)
      // Switch the type to match the uploaded media so Save sends the right kind.
      if (json.kind === "image" || json.kind === "video") setType(json.kind)
    } catch {
      setUploadError("Lỗi mạng khi tải lên")
    } finally {
      setUploading(false)
    }
  }

  const canSave =
    !busy &&
    !uploading &&
    (type === "none" || type === "text" || (isAssetType ? !!assetRef : false))

  return (
    <Card className="rounded-3xl border-[#dee1e6] bg-white shadow-none">
      <CardHeader>
        <CardTitle>Nguồn dự phòng (fallback)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p className="text-[#5b616e]">
          Khi nguồn chính mất tín hiệu, hệ thống tự phát nội dung dự phòng (slate) ra các luồng đang bật và dừng ngay khi
          nguồn trở lại. Hỗ trợ slate text, ảnh hoặc video.
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <Label className="text-xs">Loại</Label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as never)}
              className="rounded-md border border-[#dee1e6] bg-white px-3 py-2 text-sm"
            >
              <option value="none">Tắt</option>
              <option value="text">Slate text</option>
              <option value="image">Ảnh</option>
              <option value="video">Video</option>
            </select>
          </div>
          {type === "text" && (
            <div className="min-w-[240px] flex-1">
              <Label className="text-xs">Nội dung (≤ 200 ký tự)</Label>
              <Input
                value={text}
                onChange={(e) => setText(e.target.value)}
                maxLength={200}
                className="bg-white"
              />
            </div>
          )}
          {type !== "none" && (
            <label className="flex items-center gap-2 text-[#3c4148]">
              <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
              Bật
            </label>
          )}
        </div>

        {isAssetType && (
          <div className="space-y-2 rounded-2xl border border-[#dee1e6] bg-[#f7f7f7] p-3">
            <div className="flex flex-wrap items-center gap-3">
              <input
                type="file"
                accept={type === "image" ? "image/*" : "video/*"}
                disabled={uploading || busy}
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) onPickFile(f)
                }}
                className="text-xs"
              />
              {uploading && <span className="text-xs text-[#5b616e]">Đang tải lên…</span>}
              {assetName && !uploading && (
                <span className="text-xs text-[#05753f]">Đã có tệp: {assetName}</span>
              )}
            </div>
            {uploadError && <div className="text-xs text-[#cf202f]">{uploadError}</div>}
            {previewUrl && (
              <div className="overflow-hidden rounded-xl border border-[#dee1e6] bg-black">
                {(assetMime || "").startsWith("video/") || type === "video" ? (
                  <video src={previewUrl} controls muted className="max-h-48 w-full object-contain" />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={previewUrl} alt="preview" className="max-h-48 w-full object-contain" />
                )}
              </div>
            )}
            <p className="text-xs text-[#7c828a]">
              Ảnh/video được phát lặp lại. Video nên có sẵn audio và đúng tỉ lệ 16:9 để tránh khung đen.
            </p>
          </div>
        )}

        <div className="flex justify-end">
          <Button
            size="sm"
            disabled={!canSave}
            onClick={async () => {
              const payload: Record<string, unknown> = { action: "set_fallback", type, enabled }
              if (type === "text") payload.text = text
              if (isAssetType) {
                payload.assetRef = assetRef
                payload.assetName = assetName
                payload.assetMime = assetMime
              }
              const ok = await postAction(payload)
              if (ok) onChanged()
            }}
          >
            Lưu cấu hình
          </Button>
        </div>

        {fallback?.type === "text" && fallback.enabled && (
          <div className="text-xs text-[#05753f]">Đang dùng slate text: “{fallback.text}”.</div>
        )}
        {fallback?.type === "image" && fallback.enabled && (
          <div className="text-xs text-[#05753f]">Đang dùng slate ảnh: {fallback.assetName || fallback.assetRef}.</div>
        )}
        {fallback?.type === "video" && fallback.enabled && (
          <div className="text-xs text-[#05753f]">Đang dùng slate video: {fallback.assetName || fallback.assetRef}.</div>
        )}
      </CardContent>
    </Card>
  )
}

function AuditCard({ entries }: { entries: AuditEntry[] }) {
  return (
    <Card className="rounded-3xl border-[#dee1e6] bg-white shadow-none">
      <CardHeader>
        <CardTitle>Lịch sử hành động (20 gần nhất)</CardTitle>
      </CardHeader>
      <CardContent>
        {entries.length === 0 ? (
          <p className="text-sm text-[#7c828a]">
            Chưa có hành động nào được ghi nhận trong phiên hiện tại của máy chủ.
          </p>
        ) : (
          <ul className="max-h-64 space-y-1 overflow-y-auto font-mono text-xs">
            {entries.map((e, idx) => (
              <li key={idx} className="flex gap-3 border-b border-[#eef0f3] pb-1">
                <span className="shrink-0 text-[#9aa0a6]">{formatTs(e.ts)}</span>
                <span className="w-36 shrink-0 text-[#0052ff]">{e.action}</span>
                <span className="break-all text-[#5b616e]">
                  {e.detail ? JSON.stringify(e.detail) : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-xs text-[#7c828a]">
          Lưu trữ in-memory tại tiến trình máy chủ — sẽ reset khi máy chủ khởi động lại.
        </p>
      </CardContent>
    </Card>
  )
}

function formatTs(ts: string): string {
  try {
    const d = new Date(ts)
    return d.toLocaleTimeString("vi-VN", { hour12: false }) + "." + String(d.getMilliseconds()).padStart(3, "0")
  } catch {
    return ts
  }
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-[#5b616e]">{label}</span>
      <span className="text-right text-[#0a0b0d]">{value}</span>
    </div>
  )
}

function CopyRow({
  label,
  value,
  rotatable,
  onRotate,
}: {
  label: string
  value: string
  rotatable?: boolean
  onRotate?: () => void
}) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="space-y-1">
      <div className="text-sm text-[#5b616e]">{label}</div>
      <div className="flex items-center gap-2">
        <code className="flex-1 break-all rounded border border-[#dee1e6] bg-[#f7f7f7] px-3 py-2 font-mono text-sm text-[#0a0b0d]">
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
          <Copy className="mr-1 h-4 w-4" />
          {copied ? "✓" : "Copy"}
        </Button>
        {rotatable && (
          <Button size="sm" variant="secondary" onClick={onRotate}>
            Tạo mới
          </Button>
        )}
      </div>
    </div>
  )
}

function ChangeCodeCard({ onSubmit, busy }: { onSubmit: (code: string) => Promise<boolean>; busy: boolean }) {
  const [code, setCode] = useState("")
  return (
    <Card className="rounded-3xl border-[#dee1e6] bg-white shadow-none">
      <CardHeader>
        <CardTitle>Đổi mã đăng nhập</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-[#5b616e]">
          Mã mới sẽ dùng cho lần đăng nhập tiếp theo. Sau khi đổi, bạn phải đăng nhập lại.
        </p>
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <Label htmlFor="newcode">Mã đăng nhập mới (tối thiểu 6 ký tự)</Label>
            <Input
              id="newcode"
              type="password"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="bg-white"
            />
          </div>
          <Button
            disabled={busy || code.length < 6}
            onClick={async () => {
              if (!confirm("Đổi mã đăng nhập? Bạn sẽ phải đăng nhập lại bằng mã mới.")) return
              const ok = await onSubmit(code)
              if (ok) setCode("")
            }}
          >
            Đổi mã
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function CenterCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f7f7f7] px-4 text-[#0a0b0d]">
      <Card className="w-full max-w-md rounded-3xl border-[#dee1e6] bg-white shadow-none">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent className="text-[#5b616e]">{children}</CardContent>
      </Card>
    </div>
  )
}

function LoginGate({ apiBase, onSuccess }: { apiBase: string; onSuccess: () => void }) {
  const [code, setCode] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`${apiBase}/login`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code }),
      })
      if (res.ok) {
        onSuccess()
        return
      }
      const body = await res.json().catch(() => ({}))
      setError(body?.error || "Mã đăng nhập không đúng")
    } catch {
      setError("Lỗi kết nối")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f7f7f7] px-4 text-[#0a0b0d]">
      <Card className="w-full max-w-md rounded-3xl border-[#dee1e6] bg-white shadow-none">
        <CardHeader className="items-center text-center">
          <img src={LOGO_SRC} alt="SIPVY" className="mx-auto mb-2 h-12 w-auto" />
          <CardTitle>Cấu hình sự kiện</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-[#5b616e]">Nhập mã đăng nhập để truy cập trang cấu hình.</p>
          {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>}
          <div>
            <Label htmlFor="logincode">Mã đăng nhập</Label>
            <Input
              id="logincode"
              type="password"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              className="bg-white"
              autoFocus
            />
          </div>
          <Button className="w-full" onClick={submit} disabled={busy || !code}>
            {busy ? "Đang kiểm tra…" : "Đăng nhập"}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
