"use client"

import { use, useCallback, useEffect, useState } from "react"
import { RefreshCw } from "lucide-react"
import { StreamPlayer } from "@/components/stream-player"
import { Badge } from "@/components/ui/badge"
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
      <div className="min-h-screen bg-slate-950 text-slate-200 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-slate-200 mb-3" />
          <p>Đang tải trạng thái…</p>
        </div>
      </div>
    )
  }

  if (notFound || !data) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-200 flex items-center justify-center px-4">
        <Card className="max-w-md w-full bg-slate-900 border-slate-800">
          <CardHeader>
            <CardTitle>Không tìm thấy sự kiện</CardTitle>
          </CardHeader>
          <CardContent className="text-slate-400">
            Liên kết trạng thái không hợp lệ hoặc đã bị thu hồi.
          </CardContent>
        </Card>
      </div>
    )
  }

  const { runtime } = data
  const online = runtime.online

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200">
      <div className="max-w-5xl mx-auto px-5 py-8 space-y-5">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-2xl font-bold">{data.displayName}</h1>
          <Button
            variant="secondary"
            onClick={() => {
              setRefreshing(true)
              load()
            }}
            disabled={refreshing}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
            Làm mới
          </Button>
        </div>

        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Preview livestream</CardTitle>
            <Badge variant={online ? "default" : "secondary"}>{online ? "Online" : "Offline"}</Badge>
          </CardHeader>
          <CardContent>
            {online ? (
              <StreamPlayer hlsUrl={`${basePath()}/api/public/hls/${encodeURIComponent(token)}/index.m3u8`} />
            ) : (
              <div
                className="w-full bg-black rounded-lg flex items-center justify-center text-slate-500"
                style={{ aspectRatio: "16/9" }}
              >
                Nguồn đang offline. Preview sẽ sẵn sàng khi có tín hiệu.
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-800">
          <CardHeader>
            <CardTitle>Thông tin stream</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y divide-slate-800">
              <Row label="Tín hiệu nguồn">
                <span className={online ? "text-green-500 font-bold" : "text-orange-500 font-bold"}>
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
                <span>{runtime.readers}</span>
              </Row>
              <Row label="Dữ liệu truyền nhận">
                <span className="text-sm">
                  Đã nhận <span className="font-mono">{formatBytes(runtime.bytesReceived)}</span>
                  <span className="mx-2 text-slate-600">•</span>
                  Đã gửi <span className="font-mono">{formatBytes(runtime.bytesSent)}</span>
                </span>
              </Row>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-800">
          <CardHeader>
            <CardTitle>Danh sách luồng stream</CardTitle>
          </CardHeader>
          <CardContent>
            {data.destinations.length === 0 ? (
              <p className="text-slate-500">Chưa có luồng stream đang kích hoạt.</p>
            ) : (
              <table className="w-full text-left">
                <thead>
                  <tr className="text-slate-400 text-sm">
                    <th className="py-2">Tên</th>
                    <th className="py-2">Nền tảng</th>
                    <th className="py-2">Stream key</th>
                    <th className="py-2">Trạng thái</th>
                  </tr>
                </thead>
                <tbody>
                  {data.destinations.map((d) => (
                    <tr key={d.id} className="border-t border-slate-800">
                      <td className="py-2">{d.name}</td>
                      <td className="py-2">{PLATFORM_LABELS[d.platform] || d.platform}</td>
                      <td className="py-2 font-mono">{d.maskedKey}</td>
                      <td className="py-2">
                        <Badge variant={d.enabled ? "default" : "secondary"}>
                          {d.enabled ? "Bật" : "Tắt"}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
      <div className="text-slate-400">{label}</div>
      <div className="text-right">{children}</div>
    </div>
  )
}
