"use client"

import { useCallback, useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Play, Trash2, RefreshCw, Timer } from "lucide-react"
import { RecordingTimer } from "@/components/recording-timer"
import { EmptyState, ErrorState, LoadingState } from "@/components/module-state"
import { useNotifications } from "@/components/notification-provider"
import * as api from "@/lib/mediamtx-api"
import type { Path, PathConf, Recording } from "@/lib/mediamtx-api"
import { requireMediaMtxAction, type MediaMtxPermissionSet } from "@/lib/mediamtx-permissions"
import type { DashboardAuditEvent } from "@/lib/dashboard-audit"

interface RecordingStatusViewProps {
  permissions: MediaMtxPermissionSet
  username?: string | null
  appendAuditEvent?: (event: Omit<DashboardAuditEvent, "id" | "timestamp">) => void
  pollingRefresh: { refresh: () => Promise<void> }
}

const ESTIMATED_BITRATE_BPS = 2_000_000

function parseDuration(duration: string): number {
  const match = duration.match(/^(\d+(?:\.\d+)?)(ms|s|m|h|d)$/)
  if (!match) return 0
  const val = parseFloat(match[1])
  const unit = match[2]
  switch (unit) {
    case "ms": return val / 1000
    case "s": return val
    case "m": return val * 60
    case "h": return val * 3600
    case "d": return val * 86400
    default: return val
  }
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`
  return `${Math.floor(seconds / 86400)}d ${Math.floor((seconds % 86400) / 3600)}h`
}

function formatEstimatedSize(durationSeconds: number): string {
  const bytes = durationSeconds * (ESTIMATED_BITRATE_BPS / 8)
  if (bytes < 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString("vi-VN")
  } catch {
    return iso
  }
}

interface RetentionInfo {
  isConfigured: boolean
  deleteAfterLabel: string
  segmentEndTime: string | null
  remainingSeconds: number | null
  isExpired: boolean
}

interface RecordingPathStatus {
  pathName: string
  isRecording: boolean
  isLive: boolean
  recording: Recording | null
  retention: RetentionInfo
}

export function RecordingStatusView({ permissions, username, appendAuditEvent, pollingRefresh }: RecordingStatusViewProps) {
  const { notify } = useNotifications()
  const canUseApi = permissions.api !== false
  const canRead = permissions.read !== false

  const [paths, setPaths] = useState<PathConf[]>([])
  const [livePaths, setLivePaths] = useState<Path[]>([])
  const [recordings, setRecordings] = useState<Recording[]>([])
  const [recordDeleteAfter, setRecordDeleteAfter] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<{ path: string; start: string } | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const fetchData = useCallback(async () => {
    setIsLoading(true)
    setLoadError(null)
    try {
      const [configs, live, recordingList, defaults] = await Promise.all([
        api.getPathConfigs(),
        api.getPaths(),
        api.getRecordings(),
        api.getPathDefaults().catch(() => null),
      ])
      setPaths(configs.filter((p) => p.record === true))
      setLivePaths(live)
      setRecordings(recordingList)
      setRecordDeleteAfter(defaults?.recordDeleteAfter ?? null)
    } catch (error) {
      setLoadError(api.getMediaMtxErrorMessage(error))
      notify({ type: "error", title: "Không thể tải trạng thái ghi hình", message: api.getMediaMtxErrorMessage(error) })
    } finally {
      setIsLoading(false)
    }
  }, [notify])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  function computeRetention(
    latestSegmentStart: string | null,
    latestSegmentDuration: number,
  ): RetentionInfo {
    if (!recordDeleteAfter || !latestSegmentStart) {
      return {
        isConfigured: false,
        deleteAfterLabel: "Không có tự động xóa",
        segmentEndTime: null,
        remainingSeconds: null,
        isExpired: false,
      }
    }
    const deleteAfterSeconds = parseDuration(recordDeleteAfter)
    if (deleteAfterSeconds <= 0) {
      return {
        isConfigured: true,
        deleteAfterLabel: `${recordDeleteAfter} (tự động xóa tắt)`,
        segmentEndTime: null,
        remainingSeconds: null,
        isExpired: false,
      }
    }
    const segmentStartMs = new Date(latestSegmentStart).getTime()
    const segmentEndMs = segmentStartMs + latestSegmentDuration * 1000
    const deletionTimeMs = segmentEndMs + deleteAfterSeconds * 1000
    const now = Date.now()
    const remainingMs = deletionTimeMs - now
    const remainingSeconds = remainingMs / 1000
    return {
      isConfigured: true,
      deleteAfterLabel: formatDuration(deleteAfterSeconds),
      segmentEndTime: new Date(segmentEndMs).toISOString(),
      remainingSeconds,
      isExpired: remainingSeconds <= 0,
    }
  }

  const recordingStatuses: RecordingPathStatus[] = paths.map((p) => {
    const livePath = livePaths.find((lp) => lp.name === p.name)
    const recording = recordings.find((r) => r.name === p.name) || null
    const isLive = livePath?.ready === true && livePath.source !== null
    const segments = recording?.segments || []
    const latestSegment = segments.length > 0 ? segments[segments.length - 1] : null
    return {
      pathName: p.name,
      isRecording: isLive && p.record === true,
      isLive,
      recording,
      retention: computeRetention(
        latestSegment?.start ?? null,
        latestSegment?.duration ?? 0,
      ),
    }
  })

  const handleDeleteSegment = async () => {
    if (!deleteConfirm) return
    setIsDeleting(true)
    try {
      requireMediaMtxAction(permissions, "api")
      requireMediaMtxAction(permissions, "read")
      await api.deleteRecordingSegment(deleteConfirm)
      await fetchData()
      pollingRefresh.refresh().catch(() => undefined)
      setDeleteConfirm(null)
      notify({ type: "success", title: "Đã xóa segment ghi hình", message: deleteConfirm.path })
      appendAuditEvent?.({
        actor: username,
        action: "recording.segment.delete",
        target: deleteConfirm.path,
        payloadSummary: JSON.stringify({ start: deleteConfirm.start }),
        result: "success",
      })
    } catch (error) {
      notify({ type: "error", title: "Không thể xóa segment ghi hình", message: api.getMediaMtxErrorMessage(error) })
      appendAuditEvent?.({
        actor: username,
        action: "recording.segment.delete",
        target: deleteConfirm.path,
        payloadSummary: JSON.stringify({ start: deleteConfirm.start }),
        result: "failure",
        errorSummary: api.getMediaMtxErrorMessage(error),
      })
    } finally {
      setIsDeleting(false)
    }
  }

  const totalDuration = recordings.reduce((sum, r) => {
    return sum + (r.segments || []).reduce((s, seg) => s + seg.duration, 0)
  }, 0)

  if (isLoading && paths.length === 0) {
    return <LoadingState label="Đang tải trạng thái ghi hình..." />
  }

  if (loadError && paths.length === 0) {
    return <ErrorState message={loadError} onRetry={fetchData} />
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Trạng thái ghi hình</CardTitle>
              <CardDescription>
                {recordings.length > 0
                  ? `${recordings.length} path đang được ghi hình`
                  : "Các phiên ghi hình hiện tại"}
                {totalDuration > 0 && <> &middot; Tổng dung lượng ước tính: {formatEstimatedSize(totalDuration)}</>}
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={fetchData} disabled={isLoading}>
              <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {recordingStatuses.length === 0 && recordings.length === 0 ? (
            <EmptyState icon={<Play className="h-12 w-12 opacity-50" />} title="Chưa có ghi hình" />
          ) : (
            <div className="space-y-4">
              {recordingStatuses.map((status) => {
                const rec = status.recording
                const segments = rec?.segments || []
                const hasSegments = segments.length > 0
                const latestSegment = hasSegments ? segments[segments.length - 1] : null
                const segDuration = latestSegment ? latestSegment.duration : 0
                const segStart = latestSegment ? latestSegment.start : null
                const pathDuration = segments.reduce((sum, s) => sum + s.duration, 0)
                const estimatedSize = formatEstimatedSize(pathDuration)
                const ret = status.retention

                const remainingLabel = ret.remainingSeconds !== null && !ret.isExpired
                  ? `Còn ${formatDuration(ret.remainingSeconds)}`
                  : null

                return (
                  <div key={status.pathName} className="flex items-start justify-between rounded-lg border p-4">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${status.isRecording ? "bg-red-100" : "bg-gray-100"}`}>
                          <Play className={`h-5 w-5 ${status.isRecording ? "text-red-600" : "text-gray-500"}`} />
                        </div>
                        <div>
                          <h3 className="font-medium">{status.pathName}</h3>
                          <div className="flex items-center gap-2 mt-0.5">
                            {status.isRecording ? (
                              <Badge className="bg-red-100 text-red-700 hover:bg-red-100">Đang ghi</Badge>
                            ) : (
                              <Badge variant="secondary" className="bg-gray-100 text-gray-600 hover:bg-gray-100">Idle</Badge>
                            )}
                            {segments.length > 0 && (
                              <span className="text-sm text-gray-500">{segments.length} segment</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {segments.length > 0 && (
                          <div className="ml-12 grid grid-cols-1 md:grid-cols-4 gap-2 text-sm">
                            <div>
                              <span className="text-gray-500">Segment mới nhất: </span>
                              <span className="font-medium">{segStart ? formatTime(segStart) : "N/A"}</span>
                              {segDuration > 0 && <span className="text-gray-500"> ({formatDuration(segDuration)})</span>}
                            </div>
                            {status.isRecording && segStart && (
                              <div>
                                <span className="text-gray-500 inline-flex items-center gap-1">
                                  <Timer className="h-3.5 w-3.5 text-red-500" />
                                  Thời gian ghi:
                                </span>
                                <RecordingTimer startedAt={segStart} className="font-medium text-red-600 ml-1" />
                              </div>
                            )}
                            <div>
                              <span className="text-gray-500">Dung lượng ước tính: </span>
                              <span className="font-medium">{estimatedSize}</span>
                              <span className="text-xs text-gray-400 ml-1">(*)</span>
                            </div>
                          <div>
                            <span className="text-gray-500">Giữ lại: </span>
                            {ret.isConfigured ? (
                              <>
                                {ret.isExpired ? (
                                  <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 text-[11px]">
                                    Đã quá hạn xóa
                                  </Badge>
                                ) : remainingLabel ? (
                                  <span className="font-medium text-green-600">{remainingLabel}</span>
                                ) : (
                                  <span className="text-gray-500">{ret.deleteAfterLabel}</span>
                                )}
                              </>
                            ) : (
                              <span className="text-gray-500">{ret.deleteAfterLabel}</span>
                            )}
                          </div>
                          <div className="flex justify-end">
                            {hasSegments && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-[#cf202f] border-[#cf202f]/30 hover:bg-[#cf202f]/5"
                                disabled={!canUseApi || !canRead || isDeleting}
                                onClick={() => setDeleteConfirm({ path: status.pathName, start: segments[0].start })}
                              >
                                <Trash2 className="mr-1 h-4 w-4" />
                                Xóa segment đầu
                              </Button>
                            )}
                          </div>
                        </div>
                      )}

                      {!hasSegments && (
                        <p className="ml-12 text-sm text-gray-500">Chưa có segment</p>
                      )}
                    </div>
                  </div>
                )
              })}

              {totalDuration > 0 && (
                <p className="text-xs text-gray-400 italic">
                  (*) Dung lượng ước tính dựa trên bitrate giả định. Giá trị thực tế có thể khác.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={deleteConfirm !== null} onOpenChange={(open) => { if (!open) setDeleteConfirm(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Xóa segment ghi hình</DialogTitle>
            <DialogDescription>
              Bạn có chắc muốn xóa segment đầu tiên của path &ldquo;{deleteConfirm?.path}&rdquo;?
              Hành động này không thể hoàn tác.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)} disabled={isDeleting}>Hủy</Button>
            <Button variant="destructive" onClick={handleDeleteSegment} disabled={isDeleting}>
              {isDeleting ? "Đang xóa..." : "Xóa segment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
