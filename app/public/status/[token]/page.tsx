"use client"

import { use, useCallback, useEffect, useMemo, useState } from "react"
import { Activity, RefreshCw } from "lucide-react"
import { StreamPlayer } from "@/components/stream-player"
import { LOGO_SRC } from "@/lib/branding"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface StatusDestination {
  id: string
  name: string
  platform: string
  enabled: boolean
  maskedKey: string
}

interface StatusPayload {
  displayName: string
  createdAt: string
  destinations: StatusDestination[]
  runtime: {
    online: boolean
    readyTime: string | null
    bytesReceived: number
    bytesSent: number
    tracks: string[]
    readers: number
    sourceType: string | null
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

function StatusPill({ online }: { online: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
        online ? "bg-[#05b169] text-white" : "bg-[#eef0f3] text-[#5b616e]"
      }`}
    >
      <span className={`h-2 w-2 rounded-full ${online ? "bg-white" : "bg-[#9aa0a6]"}`} />
      {online ? "Online" : "Offline"}
    </span>
  )
}

export default function PublicStatusPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)
  const [data, setData] = useState<StatusPayload | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${basePath()}/api/public/status/${encodeURIComponent(token)}`, {
        cache: "no-store",
      })
      if (res.status === 404) {
        setNotFound(true)
        setData(null)
        return
      }
      if (!res.ok) return
      const payload = (await res.json()) as StatusPayload
      setData(payload)
      setNotFound(false)
    } catch {
      // transient network error — keep last good state
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [token])

  useEffect(() => {
    load()
    const id = setInterval(load, POLL_MS)
    return () => clearInterval(id)
  }, [load])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f7f7f7] text-[#0a0b0d]">
        <div className="text-center">
          <div className="mb-3 inline-block h-8 w-8 animate-spin rounded-full border-b-2 border-[#0a0b0d]" />
          <p className="text-sm text-[#5b616e]">Đang tải trạng thái…</p>
        </div>
      </div>
    )
  }

  if (notFound || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f7f7f7] px-4 text-[#0a0b0d]">
        <Card className="w-full max-w-md rounded-3xl border-[#dee1e6] bg-white shadow-none">
          <CardHeader>
            <CardTitle>Không tìm thấy sự kiện</CardTitle>
          </CardHeader>
          <CardContent className="text-[#5b616e]">
            Liên kết trạng thái không hợp lệ hoặc đã bị thu hồi.
          </CardContent>
        </Card>
      </div>
    )
  }

  const { runtime } = data
  const online = runtime.online
  const previewHlsUrl = useMemo(
    () => `${basePath()}/api/public/hls/${encodeURIComponent(token)}/index.m3u8`,
    [token],
  )

  return (
    <div className="min-h-screen bg-[#f7f7f7] text-[#0a0b0d]">
      <div className="bg-[#0a0b0d] text-white">
        <div className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex items-center gap-3">
            <img src={LOGO_SRC} alt="SIPVY" className="h-11 w-auto" />
            <div>
              <h1 className="text-xl font-semibold">{data.displayName}</h1>
              <p className="text-sm text-[#a8acb3]">Trạng thái sự kiện livestream</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-2">
              <Activity className={`h-4 w-4 ${online ? "text-[#05b169]" : "text-[#a8acb3]"}`} />
              <span className="text-sm font-medium text-white">{online ? "Online" : "Offline"}</span>
            </span>
            <Button
              size="sm"
              variant="secondary"
              className="rounded-full bg-white text-[#0a0b0d] hover:bg-[#eef0f3]"
              onClick={() => {
                setRefreshing(true)
                load()
              }}
              disabled={refreshing}
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
              Làm mới
            </Button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-5xl space-y-5 px-4 py-8 sm:px-6">
        <Card className="rounded-3xl border-[#dee1e6] bg-white shadow-none">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Preview livestream</CardTitle>
            <StatusPill online={online} />
          </CardHeader>
          <CardContent>
            {online ? (
              <StreamPlayer hlsUrl={previewHlsUrl} />
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

        <Card className="rounded-3xl border-[#dee1e6] bg-white shadow-none">
          <CardHeader>
            <CardTitle>Thông tin stream</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y divide-[#eef0f3]">
              <Row label="Tín hiệu nguồn">
                <span className={online ? "font-semibold text-[#05b169]" : "font-semibold text-[#cf202f]"}>
                  {online ? "Online" : "Offline"}
                </span>
              </Row>
              <Row label="Nguồn">
                <span>{runtime.sourceType || "Chưa có"}</span>
              </Row>
              <Row label="Tracks">
                <span>{runtime.tracks.length ? runtime.tracks.join(", ") : "Chưa có"}</span>
              </Row>
              <Row label="Người xem preview">
                <span className="font-mono">{runtime.readers}</span>
              </Row>
              <Row label="Dữ liệu truyền nhận">
                <span className="text-sm">
                  Đã nhận <span className="font-mono">{formatBytes(runtime.bytesReceived)}</span>
                  <span className="mx-2 text-[#c4c8cf]">•</span>
                  Đã gửi <span className="font-mono">{formatBytes(runtime.bytesSent)}</span>
                </span>
              </Row>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-3xl border-[#dee1e6] bg-white shadow-none">
          <CardHeader>
            <CardTitle>Danh sách luồng stream</CardTitle>
          </CardHeader>
          <CardContent>
            {data.destinations.length === 0 ? (
              <p className="text-sm text-[#7c828a]">Chưa có luồng stream đang kích hoạt.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="text-[#7c828a]">
                      <th className="py-2 font-medium">Tên</th>
                      <th className="py-2 font-medium">Nền tảng</th>
                      <th className="py-2 font-medium">Stream key</th>
                      <th className="py-2 font-medium">Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.destinations.map((d) => (
                      <tr key={d.id} className="border-t border-[#eef0f3]">
                        <td className="py-2.5 text-[#0a0b0d]">{d.name}</td>
                        <td className="py-2.5 text-[#5b616e]">{PLATFORM_LABELS[d.platform] || d.platform}</td>
                        <td className="py-2.5 font-mono text-[#5b616e]">{d.maskedKey}</td>
                        <td className="py-2.5">
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                              d.enabled ? "bg-[#0a0b0d] text-white" : "bg-[#eef0f3] text-[#5b616e]"
                            }`}
                          >
                            {d.enabled ? "Bật" : "Tắt"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div className="text-[#5b616e]">{label}</div>
      <div className="text-right text-[#0a0b0d]">{children}</div>
    </div>
  )
}
