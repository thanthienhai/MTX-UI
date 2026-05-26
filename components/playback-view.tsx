"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { CheckCircle2, Copy, Download, Eye, EyeOff, Play, RefreshCw, VideoIcon, X } from "lucide-react"
import { LoadingState, ErrorState, EmptyState } from "@/components/module-state"
import { useNotifications } from "@/components/notification-provider"
import * as api from "@/lib/mediamtx-api"
import type { GlobalConf, PathConf } from "@/lib/mediamtx-api"
import { listRecordings, buildPlaybackSegmentUrl, getPlaybackErrorMessage } from "@/lib/playback-api"
import type { PlaybackSegment } from "@/lib/playback-api"
import { requireMediaMtxAction, type MediaMtxPermissionSet } from "@/lib/mediamtx-permissions"
import type { DashboardAuditEvent } from "@/lib/dashboard-audit"

interface PlaybackViewProps {
  permissions: MediaMtxPermissionSet
  username?: string | null
  appendAuditEvent?: (event: Omit<DashboardAuditEvent, "id" | "timestamp">) => void
  pollingRefresh: { refresh: () => Promise<void> }
}

type PlaybackConfigFields = Pick<
  GlobalConf,
  "playback" | "playbackAddress" | "playbackEncryption" | "playbackServerKey" | "playbackServerCert" | "playbackAllowOrigin" | "playbackTrustedProxies"
>

const PLAYBACK_FIELDS: (keyof PlaybackConfigFields)[] = [
  "playback", "playbackAddress", "playbackEncryption",
  "playbackServerKey", "playbackServerCert",
  "playbackAllowOrigin", "playbackTrustedProxies",
]

function computeDirtyFields(original: PlaybackConfigFields, current: PlaybackConfigFields): Partial<PlaybackConfigFields> {
  const patch: Partial<PlaybackConfigFields> = {}
  for (const key of PLAYBACK_FIELDS) {
    const origVal = JSON.stringify(original[key])
    const currVal = JSON.stringify(current[key])
    if (origVal !== currVal) {
      patch[key] = current[key]
    }
  }
  return patch
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString("vi-VN")
  } catch {
    return iso
  }
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`
  return `${Math.floor(seconds / 86400)}d ${Math.floor((seconds % 86400) / 3600)}h`
}

function formatEstimatedSize(durationSeconds: number): string {
  const ESTIMATED_BITRATE_BPS = 2_000_000
  const bytes = durationSeconds * (ESTIMATED_BITRATE_BPS / 8)
  if (bytes < 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
}

// ─── PlaybackSettings Sub-Component ───────────────────────────────────────────

function PlaybackSettings({
  permissions,
  username,
  appendAuditEvent,
}: {
  permissions: MediaMtxPermissionSet
  username?: string | null
  appendAuditEvent?: (event: Omit<DashboardAuditEvent, "id" | "timestamp">) => void
}) {
  const { notify } = useNotifications()
  const canUseApi = permissions.api !== false

  const [globalConfig, setGlobalConfig] = useState<GlobalConf | null>(null)
  const [originalConfig, setOriginalConfig] = useState<PlaybackConfigFields | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [previewPatch, setPreviewPatch] = useState<Record<string, unknown> | null>(null)
  const [isPreviewExpanded, setIsPreviewExpanded] = useState(false)

  const fetchConfig = useCallback(async () => {
    setIsLoading(true)
    setLoadError(null)
    try {
      const config = await api.getGlobalConfig()
      setGlobalConfig(config)
      const playbackPart: PlaybackConfigFields = {} as PlaybackConfigFields
      for (const field of PLAYBACK_FIELDS) {
        if (field in config) {
          playbackPart[field] = config[field] as GlobalConf[keyof GlobalConf] & PlaybackConfigFields[keyof PlaybackConfigFields]
        }
      }
      setOriginalConfig(JSON.parse(JSON.stringify(playbackPart)) as PlaybackConfigFields)
      setPreviewPatch(null)
      setIsPreviewExpanded(false)
    } catch (error) {
      setLoadError(api.getMediaMtxErrorMessage(error))
      notify({ type: "error", title: "Không thể tải cấu hình playback", message: api.getMediaMtxErrorMessage(error) })
    } finally {
      setIsLoading(false)
    }
  }, [notify])

  useEffect(() => {
    fetchConfig()
  }, [fetchConfig])

  const updateField = useCallback((field: keyof PlaybackConfigFields, value: unknown) => {
    setGlobalConfig((prev) => (prev ? { ...prev, [field]: value } : prev))
    setPreviewPatch(null)
    setIsPreviewExpanded(false)
  }, [])

  const showPreview = () => {
    if (!globalConfig || !originalConfig) return

    const current: PlaybackConfigFields = {} as PlaybackConfigFields
    for (const field of PLAYBACK_FIELDS) {
      current[field] = globalConfig[field] as GlobalConf[keyof GlobalConf] & PlaybackConfigFields[keyof PlaybackConfigFields]
    }

    const dirty = computeDirtyFields(originalConfig, current)
    if (Object.keys(dirty).length === 0) {
      notify({ type: "info", title: "Không có thay đổi để lưu" })
      return
    }
    setPreviewPatch(dirty as Record<string, unknown>)
    setIsPreviewExpanded(true)
  }

  const savePatch = async () => {
    if (!previewPatch) return
    setIsSaving(true)
    try {
      requireMediaMtxAction(permissions, "api")
      await api.patchGlobalConfig(previewPatch as Partial<GlobalConf>)
      setOriginalConfig((prev) => {
        if (!prev) return prev
        const updated = { ...prev }
        for (const key of Object.keys(previewPatch)) {
          ;(updated as Record<string, unknown>)[key] = previewPatch[key]
        }
        return updated
      })
      setPreviewPatch(null)
      setIsPreviewExpanded(false)
      notify({ type: "success", title: "Đã lưu cấu hình playback", message: `${Object.keys(previewPatch).length} trường đã thay đổi` })
      appendAuditEvent?.({
        actor: username,
        action: "playback.settings.patch",
        target: "globalConfig",
        payloadSummary: JSON.stringify(Object.keys(previewPatch)),
        result: "success",
      })
    } catch (error) {
      const errMessage = api.getMediaMtxErrorMessage(error)
      notify({ type: "error", title: "Không thể lưu cấu hình playback", message: errMessage })
      appendAuditEvent?.({
        actor: username,
        action: "playback.settings.patch",
        target: "globalConfig",
        payloadSummary: JSON.stringify(Object.keys(previewPatch)),
        result: "failure",
        errorSummary: errMessage,
      })
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading && !globalConfig) {
    return <LoadingState label="Đang tải cấu hình playback..." />
  }

  if (loadError && !globalConfig) {
    return <ErrorState message={loadError} onRetry={fetchConfig} />
  }

  if (!globalConfig) {
    return <ErrorState message="Không có dữ liệu cấu hình playback" onRetry={fetchConfig} />
  }

  const playbackEnabled = globalConfig.playback !== false
  const currentDirty = (() => {
    if (!originalConfig) return {}
    const current: PlaybackConfigFields = {} as PlaybackConfigFields
    for (const field of PLAYBACK_FIELDS) {
      current[field] = globalConfig[field] as GlobalConf[keyof GlobalConf] & PlaybackConfigFields[keyof PlaybackConfigFields]
    }
    return computeDirtyFields(originalConfig, current)
  })()

  const tagsValue = Array.isArray(globalConfig.playbackTrustedProxies)
    ? globalConfig.playbackTrustedProxies.join(", ")
    : typeof globalConfig.playbackTrustedProxies === "string"
      ? globalConfig.playbackTrustedProxies
      : ""

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Cài đặt Playback</CardTitle>
            <CardDescription>Cấu hình máy chủ playback để xem và tải bản ghi</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {!canUseApi && (
              <p className="text-sm text-[#cf202f]">Cần quyền api để chỉnh sửa</p>
            )}
            <Button variant="outline" size="sm" onClick={fetchConfig} disabled={isLoading || isSaving}>
              <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between rounded-lg border p-3">
          <div className="space-y-0.5">
            <Label>Bật Playback</Label>
            <p className="text-xs text-muted-foreground">Cho phép tải và xem lại bản ghi qua máy chủ playback</p>
          </div>
          <Switch
            checked={playbackEnabled}
            onCheckedChange={(checked) => updateField("playback", checked)}
            disabled={!canUseApi || isSaving}
          />
        </div>

        <div className={`space-y-4 ${playbackEnabled ? "" : "opacity-50 pointer-events-none"}`}>
          <Separator />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="playbackAddress">Địa chỉ Playback</Label>
                <Input
                  id="playbackAddress"
                  value={typeof globalConfig.playbackAddress === "string" ? globalConfig.playbackAddress : ""}
                  onChange={(e) => updateField("playbackAddress", e.target.value)}
                  disabled={!canUseApi || isSaving}
                  placeholder=":9996"
                />
                <p className="text-xs text-muted-foreground">Địa chỉ máy chủ playback (vd: :9996)</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="playbackAllowOrigin">CORS Allow-Origin</Label>
                <Input
                  id="playbackAllowOrigin"
                  value={typeof globalConfig.playbackAllowOrigin === "string" ? globalConfig.playbackAllowOrigin : ""}
                  onChange={(e) => updateField("playbackAllowOrigin", e.target.value)}
                  disabled={!canUseApi || isSaving}
                  placeholder="*"
                />
                <p className="text-xs text-muted-foreground">Giá trị header Access-Control-Allow-Origin</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="space-y-0.5">
                  <Label>HTTPS/TLS</Label>
                  <p className="text-xs text-muted-foreground">Bật mã hóa TLS cho máy chủ playback</p>
                </div>
                <Switch
                  checked={globalConfig.playbackEncryption === true}
                  onCheckedChange={(checked) => updateField("playbackEncryption", checked)}
                  disabled={!canUseApi || isSaving}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="playbackTrustedProxies">Trusted Proxies</Label>
                <Input
                  id="playbackTrustedProxies"
                  value={tagsValue}
                  onChange={(e) => {
                    const proxies = e.target.value
                      .split(",")
                      .map((s) => s.trim())
                      .filter((s) => s.length > 0)
                    updateField("playbackTrustedProxies", proxies)
                  }}
                  disabled={!canUseApi || isSaving}
                  placeholder="10.0.0.0/8, 192.168.1.0/24"
                />
                <p className="text-xs text-muted-foreground">IP hoặc CIDR, phân cách bằng dấu phẩy</p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <Button
            onClick={showPreview}
            disabled={!canUseApi || isSaving || Object.keys(currentDirty).length === 0}
          >
            <Eye className="mr-2 h-4 w-4" />
            Xem trước & lưu
          </Button>
        </div>

        {previewPatch && isPreviewExpanded && (
          <Card className="border-[#0052ff]/30 bg-[#0052ff]/5">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Eye className="h-4 w-4 text-[#0052ff]" />
                  <CardTitle className="text-sm font-medium">Xem trước global config patch</CardTitle>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={() => setIsPreviewExpanded(false)}
                >
                  <EyeOff className="h-4 w-4" />
                </Button>
              </div>
              <CardDescription>Payload gửi tới PATCH /v3/config/global/patch</CardDescription>
            </CardHeader>
            <CardContent>
              <pre className="max-h-48 overflow-auto rounded-lg border bg-[#0a0b0d] p-4 text-xs text-white">
                {JSON.stringify(previewPatch, null, 2)}
              </pre>
              <div className="mt-4 flex items-center gap-3">
                <Button size="sm" onClick={savePatch} disabled={isSaving}>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  {isSaving ? "Đang áp dụng..." : "Áp dụng thay đổi"}
                </Button>
                <Button size="sm" variant="outline" onClick={() => { setPreviewPatch(null); setIsPreviewExpanded(false) }} disabled={isSaving}>
                  Hủy
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </CardContent>
    </Card>
  )
}

// ─── PlaybackBrowser Sub-Component ─────────────────────────────────────────────

function PlaybackBrowser({
  permissions,
  pollingRefresh,
}: {
  permissions: MediaMtxPermissionSet
  pollingRefresh: { refresh: () => Promise<void> }
}) {
  const { notify } = useNotifications()
  const canRead = permissions.read !== false
  const canPlayback = permissions.playback !== false

  const videoRef = useRef<HTMLVideoElement>(null)

  const [paths, setPaths] = useState<PathConf[]>([])
  const [selectedPath, setSelectedPath] = useState<string>("")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [segments, setSegments] = useState<PlaybackSegment[]>([])
  const [selectedSegment, setSelectedSegment] = useState<PlaybackSegment | null>(null)
  const [videoSrc, setVideoSrc] = useState<string>("")
  const [isVideoLoading, setIsVideoLoading] = useState(false)
  const [videoError, setVideoError] = useState<string | null>(null)
  const [isLoadingPaths, setIsLoadingPaths] = useState(false)
  const [isLoadingSegments, setIsLoadingSegments] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  const fetchPaths = useCallback(async () => {
    setIsLoadingPaths(true)
    setLoadError(null)
    try {
      const configs = await api.getPathConfigs()
      setPaths(configs.filter((p) => p.record === true))
    } catch (error) {
      setLoadError(api.getMediaMtxErrorMessage(error))
    } finally {
      setIsLoadingPaths(false)
    }
  }, [])

  useEffect(() => {
    fetchPaths()
  }, [fetchPaths])

  const fetchSegments = useCallback(async () => {
    if (!selectedPath) return
    setIsLoadingSegments(true)
    setLoadError(null)
    try {
      const result = await listRecordings({
        path: selectedPath,
        start: startDate || undefined,
        end: endDate || undefined,
      })
      setSegments(result)
      if (result.length === 0) {
        setSelectedSegment(null)
        setVideoSrc("")
      }
    } catch (error) {
      setLoadError(getPlaybackErrorMessage(error))
      notify({ type: "error", title: "Không thể tải danh sách bản ghi", message: getPlaybackErrorMessage(error) })
    } finally {
      setIsLoadingSegments(false)
    }
  }, [selectedPath, startDate, endDate, notify])

  useEffect(() => {
    if (selectedPath) {
      fetchSegments()
    }
  }, [selectedPath, fetchSegments])

  // Hàm tạo màu sắc segment dựa trên trạng thái
  const getSegmentColor = (segment: PlaybackSegment, index: number, total: number) => {
    const isSelected = selectedSegment?.start === segment.start
    const hues = [210, 170, 330, 270, 30]
    const hue = hues[index % hues.length]
    if (isSelected) return `hsl(${hue}, 70%, 45%)`
    return `hsl(${hue}, 55%, 70%)`
  }

  const handleSegmentClick = (segment: PlaybackSegment) => {
    setSelectedSegment(segment)
    setVideoSrc(buildPlaybackSegmentUrl({ path: selectedPath, start: segment.start, format: "fmp4" }))
    setIsVideoLoading(true)
    setVideoError(null)
  }

  const handleRefresh = () => {
    fetchPaths()
    if (selectedPath) fetchSegments()
    pollingRefresh.refresh().catch(() => undefined)
  }

  const handleDownload = (format: "fmp4" | "mp4") => {
    if (!selectedSegment) return
    const url = buildPlaybackSegmentUrl({ path: selectedPath, start: selectedSegment.start, format })
    const a = document.createElement("a")
    a.href = url
    a.download = `${selectedPath}_${selectedSegment.start}.${format === "fmp4" ? "fmp4" : "mp4"}`
    a.click()
  }

  const handleCopyUrl = async () => {
    if (!selectedSegment) return
    const url = buildPlaybackSegmentUrl({ path: selectedPath, start: selectedSegment.start, format: "fmp4" })
    try {
      await navigator.clipboard.writeText(window.location.origin + url)
      notify({ type: "success", title: "Đã sao chép URL playback" })
    } catch {
      notify({ type: "error", title: "Không thể sao chép URL" })
    }
  }

  const totalDuration = segments.reduce((sum, seg) => sum + (seg.duration || 0), 0)
  const canPlay = canPlayback && canRead

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Playback bản ghi</CardTitle>
            <CardDescription>
              {segments.length > 0
                ? `${segments.length} bản ghi · Tổng ${formatDuration(totalDuration)} · Ước tính ${formatEstimatedSize(totalDuration)}`
                : "Xem và tải lại các bản ghi đã lưu"}
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isLoadingPaths || isLoadingSegments}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isLoadingPaths || isLoadingSegments ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="playback-path">Path</Label>
            <Select value={selectedPath} onValueChange={setSelectedPath} disabled={!canPlay || isLoadingPaths}>
              <SelectTrigger id="playback-path">
                <SelectValue placeholder="Chọn path..." />
              </SelectTrigger>
              <SelectContent>
                {paths.map((p) => (
                  <SelectItem key={p.name} value={p.name}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="playback-start">Từ ngày</Label>
            <Input
              id="playback-start"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              disabled={!canPlay || !selectedPath}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="playback-end">Đến ngày</Label>
            <Input
              id="playback-end"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              disabled={!canPlay || !selectedPath}
            />
          </div>
        </div>

        {!selectedPath ? (
          <EmptyState
            icon={<Play className="h-12 w-12 opacity-50" />}
            title="Chọn path để xem bản ghi"
            action={paths.length === 0 && !isLoadingPaths ? (
              <p className="text-sm text-muted-foreground">Không có path nào bật ghi hình</p>
            ) : undefined}
          />
        ) : isLoadingSegments ? (
          <LoadingState label="Đang tải danh sách bản ghi..." />
        ) : loadError ? (
          <ErrorState message={loadError} onRetry={fetchSegments} />
        ) : segments.length === 0 ? (
          <EmptyState
            icon={<VideoIcon className="h-12 w-12 opacity-50" />}
            title="Không có bản ghi nào"
            action={
              <p className="text-sm text-muted-foreground">
                {startDate || endDate
                  ? "Thử thay đổi khoảng thời gian hoặc xóa bộ lọc ngày"
                  : "Path này chưa có bản ghi nào"}
              </p>
            }
          />
        ) : (
          <>
            {/* Timeline */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Dòng thời gian</Label>
                <span className="text-xs text-muted-foreground">{segments.length} segment</span>
              </div>
              <div className="relative overflow-x-auto rounded-lg border p-4">
                {/* Time axis */}
                {(() => {
                  if (segments.length === 0) return null
                  const firstStart = new Date(segments[0].start).getTime()
                  const lastEnd = new Date(segments[segments.length - 1].start).getTime() + (segments[segments.length - 1].duration || 0) * 1000
                  const totalMs = Math.max(lastEnd - firstStart, 1)
                  const totalMinutes = totalMs / 60000

                  // Generate axis labels
                  const axisLabels: { label: string; position: number }[] = []
                  const steps = Math.min(8, Math.ceil(totalMinutes / 30))
                  for (let i = 0; i <= steps; i++) {
                    const ms = firstStart + (totalMs * i) / steps
                    const d = new Date(ms)
                    const label = d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })
                    axisLabels.push({ label, position: (i / steps) * 100 })
                  }

                  return (
                    <>
                      {/* Axis labels */}
                      <div className="relative mb-2 h-5">
                        {axisLabels.map(({ label, position }, i) => (
                          <span
                            key={i}
                            className="absolute -translate-x-1/2 text-[11px] text-muted-foreground"
                            style={{ left: `${position}%` }}
                          >
                            {label}
                          </span>
                        ))}
                      </div>
                      {/* Bars */}
                      <div className="relative h-10 rounded-md bg-gray-100">
                        {segments.map((seg, idx) => {
                          const segStartMs = new Date(seg.start).getTime()
                          const segDurationMs = (seg.duration || 0) * 1000
                          const left = ((segStartMs - firstStart) / totalMs) * 100
                          const width = Math.max((segDurationMs / totalMs) * 100, 0.5)
                          const isSelected = selectedSegment?.start === seg.start

                          return (
                            <div
                              key={seg.start}
                              className={`absolute top-0 h-full cursor-pointer rounded-sm transition-all hover:opacity-80 ${
                                isSelected ? "ring-2 ring-[#0052ff] ring-offset-1" : ""
                              }`}
                              style={{
                                left: `${left}%`,
                                width: `${width}%`,
                                backgroundColor: getSegmentColor(seg, idx, segments.length),
                                minWidth: "4px",
                              }}
                              onClick={() => handleSegmentClick(seg)}
                              title={`${formatTime(seg.start)} (${formatDuration(seg.duration || 0)})`}
                            />
                          )
                        })}
                      </div>
                    </>
                  )
                })()}
              </div>

              {/* Selected segment info */}
              {selectedSegment && (
                <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-[#f7f8fa] p-3 text-sm">
                  <Badge variant="secondary" className="bg-[#0052ff]/10 text-[#0052ff]">
                    <span className="mr-1">&#9679;</span>
                    Đã chọn
                  </Badge>
                  <span className="font-medium">{formatTime(selectedSegment.start)}</span>
                  <span className="text-muted-foreground">·</span>
                  <span>{formatDuration(selectedSegment.duration || 0)}</span>
                  <span className="text-muted-foreground">·</span>
                  <span>{formatEstimatedSize(selectedSegment.duration || 0)}</span>
                </div>
              )}
            </div>

            {/* Video Player */}
            {selectedSegment && (
              <div className="space-y-3">
                <Label>Phát lại</Label>
                <div className="relative w-full bg-black rounded-lg overflow-hidden" style={{ aspectRatio: "16/9" }}>
                  {isVideoLoading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-gray-900 z-10">
                      <div className="text-center">
                        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-white mb-2"></div>
                        <p className="text-white text-sm">Đang tải bản ghi...</p>
                      </div>
                    </div>
                  )}
                  {videoError && (
                    <div className="absolute inset-0 flex items-center justify-center bg-gray-900 z-10">
                      <div className="text-center text-red-500">
                        <p className="font-medium">{videoError}</p>
                        <p className="text-sm mt-2">Không thể phát bản ghi này</p>
                      </div>
                    </div>
                  )}
                  <video
                    ref={videoRef}
                    className="w-full h-full"
                    controls
                    playsInline
                    key={videoSrc}
                    onLoadedData={() => setIsVideoLoading(false)}
                    onError={() => {
                      setIsVideoLoading(false)
                      setVideoError("Không thể tải video bản ghi")
                    }}
                    onWaiting={() => setIsVideoLoading(true)}
                    onCanPlay={() => setIsVideoLoading(false)}
                  >
                    <source src={videoSrc} type='video/mp4; codecs="avc1.64001E, mp4a.40.2"' />
                  </video>
                </div>

                {/* Action buttons */}
                <div className="flex flex-wrap items-center gap-3">
                  <Button size="sm" onClick={() => handleDownload("fmp4")} disabled={!canPlay}>
                    <Download className="mr-2 h-4 w-4" />
                    Download fMP4
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => handleDownload("mp4")} disabled={!canPlay}>
                    <Download className="mr-2 h-4 w-4" />
                    Download MP4
                  </Button>
                  <Button size="sm" variant="outline" onClick={handleCopyUrl} disabled={!canPlay}>
                    <Copy className="mr-2 h-4 w-4" />
                    Copy playback URL
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}

// ─── PlaybackView Main Component ──────────────────────────────────────────────

export function PlaybackView({ permissions, username, appendAuditEvent, pollingRefresh }: PlaybackViewProps) {
  return (
    <div className="space-y-6">
      <PlaybackSettings
        permissions={permissions}
        username={username}
        appendAuditEvent={appendAuditEvent}
      />
      <PlaybackBrowser
        permissions={permissions}
        pollingRefresh={pollingRefresh}
      />
    </div>
  )
}
