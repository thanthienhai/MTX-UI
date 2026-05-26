"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  AlertCircle,
  Eye,
  EyeOff,
  Lock,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useNotifications } from "@/components/notification-provider"
import * as api from "@/lib/mediamtx-api"
import type { PathConf, Path } from "@/lib/mediamtx-api"
import { requireMediaMtxAction, type MediaMtxPermissionSet } from "@/lib/mediamtx-permissions"
import { getFieldsForSourceType, detectSourceType } from "@/lib/path-management.mjs"
import { ForwardingConfig } from "@/components/forwarding-config"
import { ReEncodingConfig } from "@/components/re-encoding-config"
import { ProxyConfig } from "@/components/proxy-config"
import { StreamModeSelector, detectStreamMode, applyStreamMode, type StreamMode } from "@/components/stream-mode-selector"
import { OnDemandConfig } from "@/components/on-demand-config"
import { HookCommandEditor, HOOK_ENV_VARS } from "@/components/hook-command-editor"

type PathNameMode = "normal" | "regex" | "all_others"
type SourceType =
  | "publisher"
  | "rtspSource"
  | "rtspsSource"
  | "rtmpSource"
  | "rtmpsSource"
  | "hlsSource"
  | "srtSource"
  | "udpSource"
  | "webRTCSource"
  | "redirect"
  | "rpiCameraSource"

interface PathFormProps {
  mode: "add" | "edit"
  submitMode?: "patch" | "replace"
  initialPath?: PathConf | null
  runtimePath?: Path | null
  permissions: MediaMtxPermissionSet
  username?: string | null
  isOpen: boolean
  onClose: () => void
  onSuccess: () => Promise<void>
  appendAuditEvent?: (event: { actor: string; action: string; target: string; payloadSummary: string; result: string; errorSummary?: string }) => void
}

const SOURCE_TYPE_OPTIONS: Array<{ value: SourceType; label: string }> = [
  { value: "publisher", label: "Publisher ( RTSP, RTMP, WebRTC... )" },
  { value: "rtspSource", label: "RTSP Source" },
  { value: "rtspsSource", label: "RTSPS Source (TLS)" },
  { value: "rtmpSource", label: "RTMP Source" },
  { value: "rtmpsSource", label: "RTMPS Source (TLS)" },
  { value: "hlsSource", label: "HLS Source (HTTP)" },
  { value: "srtSource", label: "SRT Source" },
  { value: "udpSource", label: "UDP/RTP Source" },
  { value: "webRTCSource", label: "WebRTC/WHEP Source" },
  { value: "redirect", label: "Redirect to another path" },
  { value: "rpiCameraSource", label: "Raspberry Pi Camera" },
]

const SOURCE_TYPE_LABELS: Record<SourceType, string> = {
  publisher: "publisher",
  rtspSource: "rtsp://",
  rtspsSource: "rtsps://",
  rtmpSource: "rtmp://",
  rtmpsSource: "rtmps://",
  hlsSource: "http://",
  srtSource: "srt://",
  udpSource: "udp://",
  webRTCSource: "whep://",
  redirect: "redirect://",
  rpiCameraSource: "/dev/video",
}

export function PathForm({
  mode,
  submitMode = "patch",
  initialPath,
  runtimePath,
  permissions,
  username,
  isOpen,
  onClose,
  onSuccess,
  appendAuditEvent,
}: PathFormProps) {
  const { notify } = useNotifications()
  const canUseApi = permissions.api !== false
  const canPublish = permissions.publish !== false

  const [nameMode, setNameMode] = useState<PathNameMode>("normal")
  const [name, setName] = useState("")
  const [source, setSource] = useState("")
  const [sourceFingerprint, setSourceFingerprint] = useState("")
  const [sourceOnDemand, setSourceOnDemand] = useState(true)
  const [sourceOnDemandStartTimeout, setSourceOnDemandStartTimeout] = useState("10s")
  const [sourceOnDemandCloseAfter, setSourceOnDemandCloseAfter] = useState("10s")
  const [maxReaders, setMaxReaders] = useState(0)
  const [overridePublisher, setOverridePublisher] = useState(true)
  const [useAbsoluteTimestamp, setUseAbsoluteTimestamp] = useState(false)
  const [record, setRecord] = useState(false)
  const [recordPath, setRecordPath] = useState("./recordings/%path/%Y-%m-%d_%H-%M-%S-%f")
  const [recordFormat, setRecordFormat] = useState("fmp4")
  const [recordPartDuration, setRecordPartDuration] = useState("1s")
  const [recordSegmentDuration, setRecordSegmentDuration] = useState("1h")
  const [recordDeleteAfter, setRecordDeleteAfter] = useState("0s")
  const [recordMaxPartSize, setRecordMaxPartSize] = useState("50M")

  // Stream mode
  const [streamMode, setStreamMode] = useState<StreamMode>("publisher")

  // runOnInit (for Always Pull mode)
  const [runOnInit, setRunOnInit] = useState("")
  const [runOnInitRestart, setRunOnInitRestart] = useState(true)

  // On-Demand Publishing fields
  const [runOnDemand, setRunOnDemand] = useState("")
  const [runOnDemandRestart, setRunOnDemandRestart] = useState(true)
  const [runOnDemandStartTimeout, setRunOnDemandStartTimeout] = useState("10s")
  const [runOnDemandCloseAfter, setRunOnDemandCloseAfter] = useState("10s")
  const [runOnUnDemand, setRunOnUnDemand] = useState("")

  // Forwarding fields
  const [runOnReady, setRunOnReady] = useState("")
  const [runOnReadyRestart, setRunOnReadyRestart] = useState(true)

  // RPi Camera fields
  const [rpiCameraCamID, setRpiCameraCamID] = useState(0)
  const [rpiCameraWidth, setRpiCameraWidth] = useState(1920)
  const [rpiCameraHeight, setRpiCameraHeight] = useState(1080)
  const [rpiCameraFPS, setRpiCameraFPS] = useState(30)
  const [rpiCameraHFlip, setRpiCameraHFlip] = useState(false)
  const [rpiCameraVFlip, setRpiCameraVFlip] = useState(false)
  const [rpiCameraBitrate, setRpiCameraBitrate] = useState(5000000)
  const [rpiCameraCodec, setRpiCameraCodec] = useState("h264")

  // Redirect source
  const [sourceRedirect, setSourceRedirect] = useState("")

  const [showAdvancedProxy, setShowAdvancedProxy] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  const detectedSourceType = useMemo(() => detectSourceType(source), [source])
  const showSourceUrl = !["publisher", "redirect", "rpiCameraSource"].includes(detectedSourceType)

  // Keep streamMode in sync when source becomes publisher
  useEffect(() => {
    if (source === "publisher" && streamMode !== "publisher") {
      setStreamMode("publisher")
    } else if (source && source !== "publisher" && streamMode === "publisher") {
      setStreamMode("pullUpstream")
    }
  }, [source, streamMode])

  // Load initial path data
  useEffect(() => {
    if (initialPath && mode === "edit") {
      setName(initialPath.name || "")
      setSource(initialPath.source || "")
      setSourceFingerprint(initialPath.sourceFingerprint || "")
      setSourceOnDemand(initialPath.sourceOnDemand ?? true)
      setSourceOnDemandStartTimeout(initialPath.sourceOnDemandStartTimeout || "10s")
      setSourceOnDemandCloseAfter(initialPath.sourceOnDemandCloseAfter || "10s")
      setMaxReaders(initialPath.maxReaders ?? 0)
      setOverridePublisher(initialPath.overridePublisher ?? true)
      setUseAbsoluteTimestamp(initialPath.useAbsoluteTimestamp ?? false)
      setRecord(initialPath.record ?? false)
      setRecordPath(initialPath.recordPath || "./recordings/%path/%Y-%m-%d_%H-%M-%S-%f")
      setRecordFormat(initialPath.recordFormat || "fmp4")
      setRecordPartDuration(initialPath.recordPartDuration || "1s")
      setRecordSegmentDuration(initialPath.recordSegmentDuration || "1h")
      setRecordDeleteAfter(initialPath.recordDeleteAfter || "0s")
      setRecordMaxPartSize(initialPath.recordMaxPartSize || "50M")

      // Forwarding
      // Stream mode
      const hasRunOnInit = !!(initialPath.runOnInit)
      setStreamMode(detectStreamMode(initialPath.source || "", initialPath.sourceOnDemand ?? true, hasRunOnInit))

      // runOnInit
      setRunOnInit(initialPath.runOnInit || "")
      setRunOnInitRestart(initialPath.runOnInitRestart ?? true)

      // On-Demand Publishing
      setRunOnDemand(initialPath.runOnDemand || "")
      setRunOnDemandRestart(initialPath.runOnDemandRestart ?? true)
      setRunOnDemandStartTimeout(initialPath.runOnDemandStartTimeout || "10s")
      setRunOnDemandCloseAfter(initialPath.runOnDemandCloseAfter || "10s")
      setRunOnUnDemand(initialPath.runOnUnDemand || "")

      // Forwarding
      setRunOnReady(initialPath.runOnReady || "")
      setRunOnReadyRestart(initialPath.runOnReadyRestart ?? true)

      // RPi Camera
      const ip = initialPath as Record<string, unknown>
      if (typeof ip.source === "string" && ip.source.includes("rpiCamera") || ip.rpiCameraCamID !== undefined) {
        setRpiCameraCamID((ip.rpiCameraCamID as number) ?? 0)
        setRpiCameraWidth((ip.rpiCameraWidth as number) ?? 1920)
        setRpiCameraHeight((ip.rpiCameraHeight as number) ?? 1080)
        setRpiCameraFPS((ip.rpiCameraFPS as number) ?? 30)
        setRpiCameraHFlip((ip.rpiCameraHFlip as boolean) ?? false)
        setRpiCameraVFlip((ip.rpiCameraVFlip as boolean) ?? false)
        setRpiCameraBitrate((ip.rpiCameraBitrate as number) ?? 5000000)
        setRpiCameraCodec((ip.rpiCameraCodec as string) || "h264")
      }

      // Redirect
      if (initialPath.source?.startsWith("redirect")) {
        setSourceRedirect(initialPath.source.replace("redirect://", "") || "")
      }

      // Path name mode
      if (initialPath.name === "all_others") {
        setNameMode("all_others")
      } else if (initialPath.name?.startsWith("~")) {
        setNameMode("regex")
      } else {
        setNameMode("normal")
      }
    } else if (mode === "add") {
      resetForm()
    }
  }, [initialPath, mode, isOpen])

  const resetForm = () => {
    setNameMode("normal")
    setName("")
    setSource("")
    setSourceFingerprint("")
    setSourceOnDemand(true)
    setSourceOnDemandStartTimeout("10s")
    setSourceOnDemandCloseAfter("10s")
    setMaxReaders(0)
    setOverridePublisher(true)
    setUseAbsoluteTimestamp(false)
    setRecord(false)
    setRecordPath("./recordings/%path/%Y-%m-%d_%H-%M-%S-%f")
    setRecordFormat("fmp4")
    setRecordPartDuration("1s")
    setRecordSegmentDuration("1h")
    setRecordDeleteAfter("0s")
    setRecordMaxPartSize("50M")
    setStreamMode("publisher")
    setRunOnInit("")
    setRunOnInitRestart(true)
    setRunOnDemand("")
    setRunOnDemandRestart(true)
    setRunOnDemandStartTimeout("10s")
    setRunOnDemandCloseAfter("10s")
    setRunOnUnDemand("")
    setRunOnReady("")
    setRunOnReadyRestart(true)
    setRpiCameraCamID(0)
    setRpiCameraWidth(1920)
    setRpiCameraHeight(1080)
    setRpiCameraFPS(30)
    setRpiCameraHFlip(false)
    setRpiCameraVFlip(false)
    setRpiCameraBitrate(5000000)
    setRpiCameraCodec("h264")
    setSourceRedirect("")
    setFieldErrors({})
  }

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {}

    if (mode === "add" || submitMode === "replace") {
      if (!name.trim()) {
        errors.name = "Tên path là bắt buộc"
      } else if (nameMode === "normal" && (name.includes(" ") || name.includes("/"))) {
        errors.name = "Tên path không được chứa khoảng trắng hoặc dấu /"
      } else if (nameMode === "regex" && !name.match(/^~.+/)) {
        errors.name = "Regex path phải bắt đầu bằng ~"
      } else if (nameMode === "all_others" && name !== "all_others") {
        errors.name = "all_others là giá trị duy nhất được chấp nhận"
      }
    }

    if (!source.trim() && detectedSourceType !== "rpiCameraSource") {
      errors.source = "URL nguồn là bắt buộc"
    }

    if (sourceOnDemandStartTimeout && !/^\d+(ms|s|m|h|d)?$/.test(sourceOnDemandStartTimeout)) {
      errors.sourceOnDemandStartTimeout = "Phải là duration hợp lệ (vd: 10s, 5m)"
    }

    if (sourceOnDemandCloseAfter && !/^\d+(ms|s|m|h|d)?$/.test(sourceOnDemandCloseAfter)) {
      errors.sourceOnDemandCloseAfter = "Phải là duration hợp lệ (vd: 10s, 5m)"
    }

    // On-Demand Publishing validation
    if (runOnDemandStartTimeout && !/^\d+(ms|s|m|h|d)?$/.test(runOnDemandStartTimeout)) {
      errors.runOnDemandStartTimeout = "Phải là duration hợp lệ (vd: 10s, 5m)"
    }
    if (runOnDemandCloseAfter && !/^\d+(ms|s|m|h|d)?$/.test(runOnDemandCloseAfter)) {
      errors.runOnDemandCloseAfter = "Phải là duration hợp lệ (vd: 10s, 5m)"
    }

    // Forwarding validation
    if (runOnReady && !runOnReady.trim()) {
      errors.runOnReady = "Command forward không được để trống"
    }

    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  const buildPayload = (): Partial<PathConf> => {
    const base: Partial<PathConf> = {}

    // Name - only for add/replace modes
    if (mode === "add" || submitMode === "replace") {
      base.name = name
    }

    // Source based on type
    if (detectedSourceType === "redirect") {
      base.source = `redirect://${sourceRedirect}`
    } else if (detectedSourceType === "rpiCameraSource") {
      const params = new URLSearchParams({
        camera: String(rpiCameraCamID),
        width: String(rpiCameraWidth),
        height: String(rpiCameraHeight),
        fps: String(rpiCameraFPS),
        hflip: String(rpiCameraHFlip),
        vflip: String(rpiCameraVFlip),
        bitrate: String(rpiCameraBitrate),
        codec: rpiCameraCodec,
      })
      base.source = `rpiCamera://${params.toString()}`
    } else if (detectedSourceType === "publisher") {
      base.source = "publisher"
    } else {
      base.source = source
    }

    if (sourceFingerprint) base.sourceFingerprint = sourceFingerprint
    base.sourceOnDemand = sourceOnDemand
    if (sourceOnDemand) {
      if (sourceOnDemandStartTimeout) base.sourceOnDemandStartTimeout = sourceOnDemandStartTimeout
      if (sourceOnDemandCloseAfter) base.sourceOnDemandCloseAfter = sourceOnDemandCloseAfter
    }

    base.maxReaders = maxReaders
    base.overridePublisher = overridePublisher
    base.useAbsoluteTimestamp = useAbsoluteTimestamp

    base.record = record
    if (record) {
      if (recordPath) base.recordPath = recordPath
      if (recordFormat) base.recordFormat = recordFormat
      if (recordPartDuration) base.recordPartDuration = recordPartDuration
      if (recordSegmentDuration) base.recordSegmentDuration = recordSegmentDuration
      if (recordDeleteAfter) base.recordDeleteAfter = recordDeleteAfter
      if (recordMaxPartSize) base.recordMaxPartSize = recordMaxPartSize
    }

    // runOnInit (Always Pull)
    if (streamMode === "alwaysPull" && runOnInit) {
      base.runOnInit = runOnInit
      base.runOnInitRestart = runOnInitRestart
    }

    // On-Demand Publishing
    if (runOnDemand) {
      base.runOnDemand = runOnDemand
      base.runOnDemandRestart = runOnDemandRestart
      if (runOnDemandStartTimeout) base.runOnDemandStartTimeout = runOnDemandStartTimeout
      if (runOnDemandCloseAfter) base.runOnDemandCloseAfter = runOnDemandCloseAfter
    }
    if (runOnUnDemand) {
      base.runOnUnDemand = runOnUnDemand
    }

    // Forwarding
    if (runOnReady) {
      base.runOnReady = runOnReady
      base.runOnReadyRestart = runOnReadyRestart
    }

    return base
  }

  const handleSubmit = async () => {
    if (!validateForm()) {
      notify({ type: "error", title: "Vui lòng kiểm tra các trường được đánh dấu" })
      return
    }

    setIsSubmitting(true)
    try {
      requireMediaMtxAction(permissions, "api")
      if (mode === "add" || submitMode === "replace") {
        requireMediaMtxAction(permissions, "publish")
      }

      const payload = buildPayload()
      const pathName = mode === "add" ? name : initialPath?.name || ""

      if (mode === "add") {
        await api.addPath(payload as PathConf)
      } else if (submitMode === "replace") {
        await api.replacePath(pathName, payload as PathConf)
      } else {
        await api.updatePath(pathName, payload)
      }

      notify({ type: "success", title: mode === "add" ? "Đã thêm path" : "Đã cập nhật path", message: pathName })
      appendAuditEvent?.({
        actor: username || "unknown",
        action: mode === "add" ? "path.add" : submitMode === "replace" ? "path.replace" : "path.update",
        target: pathName,
        payloadSummary: JSON.stringify(payload),
        result: "success",
      })

      await onSuccess()
      onClose()
      resetForm()
    } catch (error) {
      const message = api.getMediaMtxErrorMessage(error)
      notify({ type: "error", title: mode === "add" ? "Không thể thêm path" : "Không thể cập nhật path", message })
      appendAuditEvent?.({
        actor: username || "unknown",
        action: mode === "add" ? "path.add" : submitMode === "replace" ? "path.replace" : "path.update",
        target: mode === "add" ? name : initialPath?.name || "",
        payloadSummary: JSON.stringify(buildPayload()),
        result: "failure",
        errorSummary: message,
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleClose = () => {
    if (!isSubmitting) {
      onClose()
      resetForm()
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {mode === "add" ? "Thêm path mới" : `Sửa path: ${initialPath?.name || ""}`}
          </DialogTitle>
          <DialogDescription>
            {mode === "add"
              ? "Cấu hình một path streaming mới trong MediaMTX"
              : "Cập nhật cấu hình cho path streaming này"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Path Name Section */}
          {mode === "add" && (
            <div className="space-y-2">
              <Label>Tên path</Label>
              <div className="flex items-center gap-2">
                <Select
                  value={nameMode}
                  onValueChange={(v) => setNameMode(v as PathNameMode)}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="normal">Bình thường</SelectItem>
                    <SelectItem value="regex">Regex (~)</SelectItem>
                    <SelectItem value="all_others">all_others</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  placeholder={nameMode === "regex" ? "~^camera\\d+$" : nameMode === "all_others" ? "all_others" : "cam1, camera1"}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={nameMode === "all_others"}
                  className={fieldErrors.name ? "border-[#cf202f]" : ""}
                />
              </div>
              <div className="flex items-center gap-2">
                {nameMode === "normal" && (
                  <p className="text-xs text-muted-foreground">
                    Tên path không chứa khoảng trắng hoặc ký tự đặc biệt
                  </p>
                )}
                {nameMode === "regex" && (
                  <p className="text-xs text-muted-foreground">
                    Regex pattern để khớp nhiều path. Ví dụ: ~^camera\d+$
                  </p>
                )}
                {nameMode === "all_others" && (
                  <p className="text-xs text-muted-foreground">
                    Khớp tất cả các path không được cấu hình riêng
                  </p>
                )}
              </div>
              {fieldErrors.name && <p className="text-xs text-[#cf202f]">{fieldErrors.name}</p>}
            </div>
          )}

          {/* Path Name (disabled for edit) */}
          {mode === "edit" && (
            <div className="space-y-2">
              <Label>Tên path</Label>
              <Input value={initialPath?.name || ""} disabled />
            </div>
          )}

          <Separator />

          {/* Source Type Selector */}
          <div className="space-y-2">
            <Label>Loại nguồn</Label>
            <Select
              value={detectedSourceType}
              onValueChange={(v) => {
                const st = v as SourceType
                if (st === "publisher") {
                  setSource("publisher")
                  setStreamMode("publisher")
                } else if (st === "redirect") {
                  setSource("redirect://")
                  setStreamMode("pullUpstream")
                } else if (st === "rpiCameraSource") {
                  setSource("rpiCamera://")
                  setStreamMode("alwaysPull")
                } else {
                  setSource("")
                  setStreamMode("pullUpstream")
                }
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Chọn loại nguồn" />
              </SelectTrigger>
              <SelectContent>
                {SOURCE_TYPE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Source URL */}
          {showSourceUrl && (
            <div className="space-y-2">
              <Label htmlFor="source">
                URL nguồn <span className="text-[#cf202f]">*</span>
              </Label>
              <Input
                id="source"
                placeholder={
                  detectedSourceType === "rtspSource" ? "rtsp://admin:password@192.168.50.50:554/stream" :
                  detectedSourceType === "rtspsSource" ? "rtsps://admin:password@192.168.50.50:554/stream" :
                  detectedSourceType === "rtmpSource" ? "rtmp://localhost/live/stream" :
                  detectedSourceType === "rtmpsSource" ? "rtmps://localhost/live/stream" :
                  detectedSourceType === "hlsSource" ? "https://example.com/live/stream.m3u8" :
                  detectedSourceType === "srtSource" ? "srt://localhost:9000?streamid=stream" :
                  detectedSourceType === "webRTCSource" ? "whep://localhost:8889/stream" :
                  "rtsp://..."
                }
                value={source}
                onChange={(e) => setSource(e.target.value)}
                className={fieldErrors.source ? "border-[#cf202f]" : ""}
              />
              <p className="text-xs text-muted-foreground">
                {detectedSourceType === "rtspSource" && "URL RTSP với username/password nếu cần"}
                {detectedSourceType === "rtspsSource" && "URL RTSPS với TLS. Có thể cần fingerprint."}
                {detectedSourceType === "rtmpSource" && "URL RTMP đến server phát trực tuyến"}
                {detectedSourceType === "rtmpsSource" && "URL RTMPS với TLS"}
                {detectedSourceType === "hlsSource" && "URL HLS (.m3u8) HTTP/HTTPS"}
                {detectedSourceType === "srtSource" && "Địa chỉ SRT với streamid"}
                {detectedSourceType === "webRTCSource" && "URL WHEP endpoint"}
              </p>
              {fieldErrors.source && <p className="text-xs text-[#cf202f]">{fieldErrors.source}</p>}
            </div>
          )}

          {/* Stream Mode Selector */}
          <Separator />
          <StreamModeSelector
            value={streamMode}
            onChange={(mode) => {
              const result = applyStreamMode(mode, source)
              setStreamMode(mode)
              setSource(result.source)
              setSourceOnDemand(result.sourceOnDemand)
              if (mode === "alwaysPull" && result.runOnInit !== undefined) {
                setRunOnInit(result.runOnInit || "")
              }
            }}
            detectedSourceType={detectedSourceType}
          />

          {/* Source OnDemand timeouts (for on-demand modes) */}
          {streamMode === "onDemandPull" && (
            <div className="grid grid-cols-2 gap-4 ml-4">
              <div className="space-y-2">
                <Label htmlFor="sourceOnDemandStartTimeout">Start Timeout</Label>
                <Input
                  id="sourceOnDemandStartTimeout"
                  placeholder="10s"
                  value={sourceOnDemandStartTimeout}
                  onChange={(e) => setSourceOnDemandStartTimeout(e.target.value)}
                  className={fieldErrors.sourceOnDemandStartTimeout ? "border-[#cf202f]" : ""}
                />
                {fieldErrors.sourceOnDemandStartTimeout && (
                  <p className="text-xs text-[#cf202f]">{fieldErrors.sourceOnDemandStartTimeout}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="sourceOnDemandCloseAfter">Close After</Label>
                <Input
                  id="sourceOnDemandCloseAfter"
                  placeholder="10s"
                  value={sourceOnDemandCloseAfter}
                  onChange={(e) => setSourceOnDemandCloseAfter(e.target.value)}
                  className={fieldErrors.sourceOnDemandCloseAfter ? "border-[#cf202f]" : ""}
                />
                {fieldErrors.sourceOnDemandCloseAfter && (
                  <p className="text-xs text-[#cf202f]">{fieldErrors.sourceOnDemandCloseAfter}</p>
                )}
              </div>
            </div>
          )}

          {/* runOnInit for Always Pull */}
          {streamMode === "alwaysPull" && (
            <div className="ml-4 space-y-4 rounded-lg border border-blue-100 bg-blue-50 p-4">
              <HookCommandEditor
                hookName="runOnInit"
                label="runOnInit command (khởi tạo nguồn tĩnh)"
                value={runOnInit}
                onChange={(v) => setRunOnInit(v || "")}
                placeholder="ffmpeg -re -stream_loop -1 -i /data/video.mp4 -c copy -f rtsp rtsp://localhost:$RTSP_PORT/$MTX_PATH"
                envVars={HOOK_ENV_VARS.lifecycle}
              />
              <div className="flex items-center space-x-2">
                <Switch checked={runOnInitRestart} onCheckedChange={setRunOnInitRestart} />
                <Label>Tự động khởi động lại nếu lệnh thoát (runOnInitRestart)</Label>
              </div>
              <p className="text-xs text-blue-600 ml-6">
                MediaMTX sẽ khởi động lại lệnh nếu process bị thoát.
              </p>
            </div>
          )}

          {/* Advanced Proxy Configuration (for upstream URL sources) */}
          {showSourceUrl && (
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setShowAdvancedProxy(!showAdvancedProxy)}
                className="flex w-full items-center justify-between rounded-lg border bg-[#f7f8fa] px-4 py-2 text-sm font-medium hover:bg-[#eef0f3]"
              >
                <span>Proxy Configuration (Templates, OnDemand, Fingerprint)</span>
                <span className={`transition-transform ${showAdvancedProxy ? "rotate-180" : ""}`}>▼</span>
              </button>
              {showAdvancedProxy && (
                <div className="rounded-lg border p-4">
                  <ProxyConfig
                    source={source}
                    sourceOnDemand={sourceOnDemand}
                    sourceOnDemandStartTimeout={sourceOnDemandStartTimeout}
                    sourceOnDemandCloseAfter={sourceOnDemandCloseAfter}
                    sourceFingerprint={sourceFingerprint}
                    pathName={name}
                    onSourceChange={setSource}
                    onSourceOnDemandChange={setSourceOnDemand}
                    onSourceOnDemandStartTimeoutChange={setSourceOnDemandStartTimeout}
                    onSourceOnDemandCloseAfterChange={setSourceOnDemandCloseAfter}
                    onSourceFingerprintChange={setSourceFingerprint}
                  />
                </div>
              )}
            </div>
          )}

          {/* Redirect source URL */}
          {detectedSourceType === "redirect" && (
            <div className="space-y-2">
              <Label htmlFor="redirectUrl">Path đích</Label>
              <Input
                id="redirectUrl"
                placeholder="cam1, other/path"
                value={sourceRedirect}
                onChange={(e) => setSourceRedirect(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Path đích để chuyển hướng reader đến
              </p>
            </div>
          )}

          {/* RPi Camera Fields */}
          {detectedSourceType === "rpiCameraSource" && (
            <div className="space-y-4 rounded-lg border bg-[#f7f7f7] p-4">
              <p className="text-sm font-medium">Raspberry Pi Camera Settings</p>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Camera ID</Label>
                  <Input
                    type="number"
                    value={rpiCameraCamID}
                    onChange={(e) => setRpiCameraCamID(Number(e.target.value) || 0)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Codec</Label>
                  <Select value={rpiCameraCodec} onValueChange={(v) => setRpiCameraCodec(v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="h264">H.264</SelectItem>
                      <SelectItem value="h265">H.265</SelectItem>
                      <SelectItem value="mjpeg">MJPEG</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Width</Label>
                  <Input
                    type="number"
                    value={rpiCameraWidth}
                    onChange={(e) => setRpiCameraWidth(Number(e.target.value) || 1920)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Height</Label>
                  <Input
                    type="number"
                    value={rpiCameraHeight}
                    onChange={(e) => setRpiCameraHeight(Number(e.target.value) || 1080)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>FPS</Label>
                  <Input
                    type="number"
                    value={rpiCameraFPS}
                    onChange={(e) => setRpiCameraFPS(Number(e.target.value) || 30)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Bitrate</Label>
                  <Input
                    type="number"
                    value={rpiCameraBitrate}
                    onChange={(e) => setRpiCameraBitrate(Number(e.target.value) || 5000000)}
                  />
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Switch checked={rpiCameraHFlip} onCheckedChange={setRpiCameraHFlip} />
                  <Label>Horizontal Flip</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={rpiCameraVFlip} onCheckedChange={setRpiCameraVFlip} />
                  <Label>Vertical Flip</Label>
                </div>
              </div>
            </div>
          )}

          {/* Source Fingerprint */}
          {(detectedSourceType === "rtspsSource" || detectedSourceType === "rtmpsSource") && (
            <div className="space-y-2">
              <Label htmlFor="sourceFingerprint">Source Fingerprint (TLS)</Label>
              <Input
                id="sourceFingerprint"
                placeholder="SHA-256 fingerprint"
                value={sourceFingerprint}
                onChange={(e) => setSourceFingerprint(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Fingerprint SHA-256 cho nguồn TLS. Bỏ trống để bỏ qua xác minh.
              </p>
            </div>
          )}

          <Separator />

          <Separator />

          {/* Recording Section */}
          <div className="flex items-center space-x-2">
            <Switch checked={record} onCheckedChange={setRecord} />
            <Label>Bật ghi hình</Label>
          </div>

          {record && (
            <div className="space-y-4 ml-6">
              <div className="space-y-2">
                <Label htmlFor="recordPath">Đường dẫn ghi hình</Label>
                <Input
                  id="recordPath"
                  value={recordPath}
                  onChange={(e) => setRecordPath(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Biến: %path, %Y %m %d (ngày), %H %M %S (giờ)
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="recordFormat">Định dạng</Label>
                  <Select value={recordFormat} onValueChange={(v) => setRecordFormat(v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fmp4">Fragmented MP4</SelectItem>
                      <SelectItem value="mpegts">MPEG-TS</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="recordPartDuration">Thời lượng part</Label>
                  <Input
                    id="recordPartDuration"
                    value={recordPartDuration}
                    onChange={(e) => setRecordPartDuration(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="recordSegmentDuration">Thời lượng segment</Label>
                  <Input
                    id="recordSegmentDuration"
                    value={recordSegmentDuration}
                    onChange={(e) => setRecordSegmentDuration(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="recordMaxPartSize">Kích thước part tối đa</Label>
                  <Input
                    id="recordMaxPartSize"
                    value={recordMaxPartSize}
                    onChange={(e) => setRecordMaxPartSize(e.target.value)}
                    placeholder="50M"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="recordDeleteAfter">Xóa sau</Label>
                  <Input
                    id="recordDeleteAfter"
                    value={recordDeleteAfter}
                    onChange={(e) => setRecordDeleteAfter(e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}

          <Separator />

          {/* Forwarding Section */}
          <div className="space-y-4">
            <ForwardingConfig
              command={runOnReady}
              restart={runOnReadyRestart}
              onCommandChange={(cmd) => setRunOnReady(cmd)}
              onRestartChange={(restart) => setRunOnReadyRestart(restart)}
              pathName={name || (initialPath?.name || "")}
            />
            {fieldErrors.runOnReady && (
              <p className="text-xs text-[#cf202f] ml-6">{fieldErrors.runOnReady}</p>
            )}
          </div>

          <Separator />

          {/* On-Demand Publishing */}
          <div className="space-y-4">
            <OnDemandConfig
              runOnDemand={runOnDemand}
              runOnDemandRestart={runOnDemandRestart}
              runOnDemandStartTimeout={runOnDemandStartTimeout}
              runOnDemandCloseAfter={runOnDemandCloseAfter}
              runOnUnDemand={runOnUnDemand}
              onRunOnDemandChange={setRunOnDemand}
              onRunOnDemandRestartChange={setRunOnDemandRestart}
              onRunOnDemandStartTimeoutChange={setRunOnDemandStartTimeout}
              onRunOnDemandCloseAfterChange={setRunOnDemandCloseAfter}
              onRunOnUnDemandChange={setRunOnUnDemand}
              pathName={name || (initialPath?.name || "")}
              runtimePath={runtimePath}
            />
          </div>

          <Separator />

          {/* Re-Encoding Section */}
          <div className="space-y-4">
            <ReEncodingConfig
              command={runOnReady}
              restart={runOnReadyRestart}
              onCommandChange={(cmd) => setRunOnReady(cmd)}
              onRestartChange={(restart) => setRunOnReadyRestart(restart)}
              pathName={name || (initialPath?.name || "")}
            />
            {runOnReady && runOnReady.length > 0 && (
              <p className="text-xs text-amber-600 ml-6">
                Lưu ý: Forwarding và Re-Encoding cùng dùng hook runOnReady. Chỉ một lệnh được chạy. 
                Bạn có thể dùng runOnInit hoặc runOnDemand cho một trong hai nếu cần chạy đồng thời.
              </p>
            )}
          </div>

          <Separator />

          {/* Common Options */}
          <div className="space-y-2">
            <Label htmlFor="maxReaders">Số reader tối đa (0 = không giới hạn)</Label>
            <Input
              id="maxReaders"
              type="number"
              value={maxReaders}
              onChange={(e) => setMaxReaders(Number(e.target.value) || 0)}
            />
          </div>

          <div className="flex items-center space-x-2">
            <Switch checked={overridePublisher} onCheckedChange={setOverridePublisher} />
            <Label>Cho phép ghi đè publisher</Label>
          </div>

          <div className="flex items-center space-x-2">
            <Switch checked={useAbsoluteTimestamp} onCheckedChange={setUseAbsoluteTimestamp} />
            <Label>Sử dụng Absolute Timestamp</Label>
          </div>
          <p className="text-xs text-muted-foreground ml-6">
            Gửi timestamp tuyệt đối thay vì relative RTCP
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isSubmitting}>
            Hủy
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !canUseApi || (mode === "add" && !canPublish)}
          >
            {isSubmitting
              ? "Đang xử lý..."
              : mode === "add"
              ? "Thêm path"
              : submitMode === "replace"
              ? "Thay thế path"
              : "Cập nhật path"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}