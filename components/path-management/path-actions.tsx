"use client"

import { useCallback, useMemo, useState } from "react"
import {
  CheckCircle2,
  Copy,
  ExternalLink,
  Eye,
  LinkIcon,
  Play,
  Radio,
  Shield,
  XCircle,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { EmptyState, LoadingState } from "@/components/module-state"
import { StreamPlayer } from "@/components/stream-player"
import { WHEPPlayer } from "@/components/whep-player"
import { useNotifications } from "@/components/notification-provider"
import * as api from "@/lib/mediamtx-api"
import type { Path, PathReader, KickResolution } from "@/lib/mediamtx-api"
import { requireMediaMtxAction, type MediaMtxPermissionSet } from "@/lib/mediamtx-permissions"
import { buildPathStreamUrls, isRegexPathName, isAllOthersPathName } from "@/lib/mediamtx-url.mjs"
import { copyToClipboard } from "@/lib/clipboard"

interface PathActionsProps {
  pathName: string
  runtimePath: Path | null
  permissions: MediaMtxPermissionSet
  username?: string | null
  onKickSuccess?: () => void
  appendAuditEvent?: (event: { actor: string; action: string; target: string; payloadSummary: string; result: string; errorSummary?: string }) => void
}

const formatBytes = (bytes?: number) =>
  typeof bytes === "number" ? `${(bytes / 1024 / 1024).toFixed(2)} MB` : "0 MB"

const PROTOCOL_LABELS: Record<string, string> = {
  rtsp: "RTSP",
  rtsps: "RTSPS",
  rtmp: "RTMP",
  hls: "HLS",
  webrtc: "WebRTC",
  srt: "SRT",
}

export function PathActions({
  pathName,
  runtimePath,
  permissions,
  username,
  onKickSuccess,
  appendAuditEvent,
}: PathActionsProps) {
  const { notify } = useNotifications()
  const canUseApi = permissions.api !== false
  const canRead = permissions.read !== false
  const canPublish = permissions.publish !== false

  const [showPreview, setShowPreview] = useState(false)
  const [showWebRtcPreview, setShowWebRtcPreview] = useState(false)
  const [kickTarget, setKickTarget] = useState<KickResolution | null>(null)
  const [isKicking, setIsKicking] = useState(false)

  const isRegex = isRegexPathName(pathName)
  const isAllOthers = isAllOthersPathName(pathName)

  const urls = useMemo(() => buildPathStreamUrls(pathName), [pathName])

  const kickableReaders = useMemo(() => {
    if (!runtimePath) return []
    return api.getKickableReaders(runtimePath)
  }, [runtimePath])

  const handleCopyUrl = useCallback(
    async (protocol: string, url: string | null) => {
      if (!url) {
        notify({ type: "error", title: "URL không khả dụng", message: `Protocol ${protocol} chưa được cấu hình` })
        return
      }
      const ok = await copyToClipboard(url)
      if (ok) {
        notify({ type: "success", title: "Đã copy URL", message: `${PROTOCOL_LABELS[protocol] || protocol}: ${url}` })
      } else {
        notify({ type: "error", title: "Không thể copy URL", message: "Clipboard không khả dụng" })
      }
    },
    [notify],
  )

  const handleOpenPlayback = useCallback(
    (url: string | null) => {
      if (!canRead) {
        notify({ type: "error", title: "Không có quyền playback" })
        return
      }
      if (!url) {
        notify({ type: "error", title: "Playback URL không khả dụng" })
        return
      }
      window.open(url, "_blank", "noreferrer")
    },
    [canRead, notify],
  )

  const executeKick = useCallback(async () => {
    if (!kickTarget?.supported) return

    setIsKicking(true)
    try {
      requireMediaMtxAction(permissions, "api")
      await kickTarget.kick(kickTarget.id)
      notify({ type: "success", title: "Đã kick reader", message: `${kickTarget.clientType}: ${kickTarget.id}` })
      appendAuditEvent?.({
        actor: username || "unknown",
        action: "path.reader.kick",
        target: `${pathName}:${kickTarget.id}`,
        payloadSummary: JSON.stringify({ clientType: kickTarget.clientType, id: kickTarget.id }),
        result: "success",
      })
      setKickTarget(null)
      onKickSuccess?.()
    } catch (error) {
      const message = api.getMediaMtxErrorMessage(error)
      notify({ type: "error", title: "Không thể kick reader", message })
      appendAuditEvent?.({
        actor: username || "unknown",
        action: "path.reader.kick",
        target: `${pathName}:${kickTarget.id}`,
        payloadSummary: JSON.stringify({ clientType: kickTarget.clientType, id: kickTarget.id }),
        result: "failure",
        errorSummary: message,
      })
    } finally {
      setIsKicking(false)
    }
  }, [kickTarget, permissions, username, pathName, notify, appendAuditEvent, onKickSuccess])

  const readerTypeLabel = (type: string) => {
    const t = type.toLowerCase()
    if (t.includes("rtspsession")) return "RTSP Session"
    if (t.includes("rtspsconn")) return "RTSPS Connection"
    if (t.includes("rtspconn")) return "RTSP Connection"
    if (t.includes("rtmpconn")) return "RTMP Connection"
    if (t.includes("rtmpsconn")) return "RTMPS Connection"
    if (t.includes("srtconn")) return "SRT Connection"
    if (t.includes("webrtcsession")) return "WebRTC Session"
    if (t.includes("hlsmuxer")) return "HLS Muxer"
    return type || "Unknown"
  }

  if (!runtimePath) {
    return (
      <Card className="rounded-3xl border-[#dee1e6] bg-white shadow-none">
        <CardHeader>
          <CardTitle>Path Actions</CardTitle>
          <CardDescription>Stream URLs và active readers cho path &quot;{pathName}&quot;</CardDescription>
        </CardHeader>
        <CardContent>
          <EmptyState title="Path chưa có runtime data" />
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Stream URLs Card */}
      <Card className="rounded-3xl border-[#dee1e6] bg-white shadow-none">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Stream URLs</CardTitle>
              <CardDescription>
                {isRegex && "Regex path - URLs không khả dụng cho pattern matching"}
                {isAllOthers && "all_others path - URLs không khả dụng cho catch-all"}
                {!isRegex && !isAllOthers && `URL streaming cho path "${pathName}"`}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setShowPreview((v) => !v)
                  setShowWebRtcPreview(false)
                }}
                disabled={!canRead}
              >
                <Eye className="mr-2 h-4 w-4" />
                {showPreview ? "Ẩn preview" : "Live preview"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setShowWebRtcPreview((v) => !v)
                  setShowPreview(false)
                }}
                disabled={!canRead}
              >
                <Radio className="mr-2 h-4 w-4" />
                {showWebRtcPreview ? "Ẩn WebRTC" : "WebRTC"}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {showPreview && runtimePath.ready && canRead && (
            <div className="mb-4">
              <StreamPlayer pathName={pathName} />
            </div>
          )}
          {showWebRtcPreview && runtimePath.ready && canRead && (
            <div className="mb-4">
              <WHEPPlayer pathName={pathName} />
            </div>
          )}

          <div className="grid gap-3 md:grid-cols-2">
            {/* RTSP */}
            {urls.rtsp && (
              <div className="rounded-lg border p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <Label>RTSP</Label>
                  {canRead ? <LinkIcon className="h-4 w-4 text-[#0052ff]" /> : <Badge variant="secondary">No permission</Badge>}
                </div>
                <code className="block overflow-x-auto rounded bg-[#f7f7f7] p-2 text-xs">{urls.rtsp}</code>
                <div className="mt-2 flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => handleCopyUrl("rtsp", urls.rtsp)}>
                    <Copy className="mr-1 h-3 w-3" />
                    Copy
                  </Button>
                  {canRead && (
                    <Button size="sm" variant="outline" onClick={() => handleOpenPlayback(urls.rtsp)}>
                      <ExternalLink className="mr-1 h-3 w-3" />
                      Open
                    </Button>
                  )}
                </div>
              </div>
            )}

            {/* RTSPS */}
            {urls.rtsps && (
              <div className="rounded-lg border p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <Label>RTSPS (TLS)</Label>
                  {canRead ? <LinkIcon className="h-4 w-4 text-[#0052ff]" /> : <Badge variant="secondary">No permission</Badge>}
                </div>
                <code className="block overflow-x-auto rounded bg-[#f7f7f7] p-2 text-xs">{urls.rtsps}</code>
                <div className="mt-2 flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => handleCopyUrl("rtsps", urls.rtsps)}>
                    <Copy className="mr-1 h-3 w-3" />
                    Copy
                  </Button>
                </div>
              </div>
            )}

            {/* RTMP */}
            {urls.rtmp && (
              <div className="rounded-lg border p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <Label>RTMP Publish</Label>
                  {canPublish ? <LinkIcon className="h-4 w-4 text-[#05b169]" /> : <Badge variant="secondary">No permission</Badge>}
                </div>
                <code className="block overflow-x-auto rounded bg-[#f7f7f7] p-2 text-xs">{urls.rtmp}</code>
                <div className="mt-2 flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => handleCopyUrl("rtmp", urls.rtmp)}>
                    <Copy className="mr-1 h-3 w-3" />
                    Copy
                  </Button>
                </div>
              </div>
            )}

            {/* HLS */}
            {urls.hls && (
              <div className="rounded-lg border p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <Label>HLS</Label>
                  {canRead ? <LinkIcon className="h-4 w-4 text-[#0052ff]" /> : <Badge variant="secondary">No permission</Badge>}
                </div>
                <code className="block overflow-x-auto rounded bg-[#f7f7f7] p-2 text-xs">{urls.hls}</code>
                <div className="mt-2 flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => handleCopyUrl("hls", urls.hls)}>
                    <Copy className="mr-1 h-3 w-3" />
                    Copy
                  </Button>
                  {canRead && (
                    <Button size="sm" variant="outline" onClick={() => handleOpenPlayback(urls.hls)}>
                      <ExternalLink className="mr-1 h-3 w-3" />
                      Open
                    </Button>
                  )}
                </div>
              </div>
            )}

            {/* WebRTC */}
            {urls.webrtc && (
              <div className="rounded-lg border p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <Label>WebRTC (WHEP)</Label>
                  {canRead ? <LinkIcon className="h-4 w-4 text-[#0052ff]" /> : <Badge variant="secondary">No permission</Badge>}
                </div>
                <code className="block overflow-x-auto rounded bg-[#f7f7f7] p-2 text-xs">{urls.webrtc}</code>
                <div className="mt-2 flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => handleCopyUrl("webrtc", urls.webrtc)}>
                    <Copy className="mr-1 h-3 w-3" />
                    Copy
                  </Button>
                  {canRead && (
                    <Button size="sm" variant="outline" onClick={() => handleOpenPlayback(urls.webrtc)}>
                      <ExternalLink className="mr-1 h-3 w-3" />
                      Open
                    </Button>
                  )}
                </div>
              </div>
            )}

            {/* SRT */}
            {urls.srt && (
              <div className="rounded-lg border p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <Label>SRT</Label>
                  {canRead || canPublish ? <LinkIcon className="h-4 w-4 text-[#0052ff]" /> : <Badge variant="secondary">No permission</Badge>}
                </div>
                <code className="block overflow-x-auto rounded bg-[#f7f7f7] p-2 text-xs">{urls.srt}</code>
                <div className="mt-2 flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => handleCopyUrl("srt", urls.srt)}>
                    <Copy className="mr-1 h-3 w-3" />
                    Copy
                  </Button>
                </div>
              </div>
            )}

            {/* No URLs available */}
            {!urls.rtsp && !urls.rtsps && !urls.rtmp && !urls.hls && !urls.webrtc && !urls.srt && (
              <div className="col-span-2 text-center text-sm text-muted-foreground">
                {isRegex || isAllOthers
                  ? "URLs không khả dụng cho regex hoặc all_others paths"
                  : "Chưa có protocol nào được cấu hình"}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Active Readers Card */}
      <Card className="rounded-3xl border-[#dee1e6] bg-white shadow-none">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Active Readers</CardTitle>
              <CardDescription>
                {runtimePath.readers.length} reader{ runtimePath.readers.length !== 1 ? "s" : ""} đang kết nối
              </CardDescription>
            </div>
            {!canUseApi && (
              <div className="flex items-center gap-1 text-xs text-[#cf202f]">
                <Shield className="h-3 w-3" />
                Cần quyền api để kick
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {runtimePath.readers.length === 0 ? (
            <EmptyState title="Không có reader nào" />
          ) : (
            <div className="space-y-3">
              {runtimePath.readers.map((reader, idx) => {
                const kickable = kickableReaders.find((k) => k.id === reader.id)
                return (
                  <div key={`${reader.id}-${idx}`} className="rounded-lg border p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-sm font-medium">
                            {readerTypeLabel(reader.type)}
                          </span>
                          {kickable?.supported ? (
                            <Badge className="bg-[#cf202f] text-white">Kickable</Badge>
                          ) : (
                            <Badge variant="secondary">Read-only</Badge>
                          )}
                        </div>
                        <p className="mt-1 font-mono text-xs text-muted-foreground">
                          ID: {reader.id || "unknown"}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-4 text-xs text-muted-foreground">
                          <span>
                            <span className="text-[#05b169]">↓</span> {formatBytes(reader.bytesReceived)} received
                          </span>
                          <span>
                            <span className="text-[#0052ff]">↑</span> {formatBytes(reader.bytesSent)} sent
                          </span>
                        </div>
                      </div>
                      {kickable?.supported && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-[#cf202f] hover:text-[#cf202f]"
                          onClick={() => setKickTarget(kickable)}
                          disabled={!canUseApi}
                        >
                          <XCircle className="mr-1 h-4 w-4" />
                          Kick
                        </Button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Runtime Info Card */}
      <Card className="rounded-3xl border-[#dee1e6] bg-white shadow-none">
        <CardHeader>
          <CardTitle>Runtime Info</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Trạng thái</p>
              <div className="mt-1 flex items-center gap-2">
                {runtimePath.ready ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 text-[#05b169]" />
                    <span className="font-medium text-[#05b169]">Ready</span>
                  </>
                ) : (
                  <>
                    <XCircle className="h-4 w-4 text-[#cf202f]" />
                    <span className="font-medium text-[#cf202f]">Not Ready</span>
                  </>
                )}
              </div>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Source</p>
              <p className="mt-1 font-mono text-sm">
                {runtimePath.source?.type || "N/A"}
                {runtimePath.source?.id && ` (${runtimePath.source.id})`}
              </p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Tracks</p>
              <p className="mt-1 font-mono text-sm">
                {runtimePath.tracks.length > 0 ? runtimePath.tracks.join(", ") : "None"}
              </p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Ready Time</p>
              <p className="mt-1 font-mono text-sm">
                {runtimePath.readyTime ? new Date(runtimePath.readyTime).toLocaleString() : "N/A"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Kick Confirmation Dialog */}
      <Dialog open={Boolean(kickTarget)} onOpenChange={(open) => !open && setKickTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Xác nhận kick reader</DialogTitle>
            <DialogDescription>
              Reader <code className="text-xs">{kickTarget?.id}</code> trong <code className="text-xs">{kickTarget?.clientType}</code>{" "}
              sẽ bị ngắt khỏi MediaMTX.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setKickTarget(null)} disabled={isKicking}>
              Hủy
            </Button>
            <Button className="bg-[#cf202f] hover:bg-[#a81925]" onClick={executeKick} disabled={isKicking || !canUseApi}>
              {isKicking ? "Đang kick..." : "Kick reader"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// Label component helper
function Label({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-sm font-medium text-[#0a0b0d]">{children}</span>
  )
}