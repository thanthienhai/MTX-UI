"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { CheckCircle2, Eye, LinkIcon, Play, RefreshCw, Shield, XCircle } from "lucide-react"

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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { EmptyState, ErrorState, LoadingState } from "@/components/module-state"
import { StreamPlayer } from "@/components/stream-player"
import { useNotifications } from "@/components/notification-provider"
import type { DashboardAuditEvent } from "@/lib/dashboard-audit"
import * as api from "@/lib/mediamtx-api"
import type { GlobalConf, HLSMuxer, PathConfig, ProtocolResource } from "@/lib/mediamtx-api"
import { requireMediaMtxAction, type MediaMtxPermissionSet } from "@/lib/mediamtx-permissions"
import {
  buildMediaMtxHlsUrl,
  buildMediaMtxProtocolUrls,
  buildMediaMtxWebRtcPublishUrl,
  buildMediaMtxWebRtcReadUrl,
} from "@/lib/mediamtx-url.mjs"
import {
  buildProtocolConfigPatch,
  extractSrtMetrics,
  parseStringArray,
  PROTOCOL_FIELD_GROUPS,
  PROTOCOL_FIELD_METADATA,
  summarizeProtocolPayload,
  validateProtocolConfigPatch,
} from "@/lib/protocol-server-management.mjs"

interface ProtocolServerManagementProps {
  permissions: MediaMtxPermissionSet
  username?: string | null
  paths: PathConfig[]
  pathDefaults?: PathConfig | null
  appendAuditEvent?: (event: Omit<DashboardAuditEvent, "id" | "timestamp">) => void
  onChanged?: () => Promise<void> | void
}

type ProtocolKey = keyof typeof PROTOCOL_FIELD_GROUPS
type RuntimeKey =
  | "rtspConnections"
  | "rtspSessions"
  | "rtspsConnections"
  | "rtspsSessions"
  | "rtmpConnections"
  | "rtmpsConnections"
  | "hlsMuxers"
  | "srtConnections"
  | "webrtcSessions"

interface RuntimeGroup {
  key: RuntimeKey
  label: string
  protocol: ProtocolKey
  canKick: boolean
  tlsOnly?: boolean
  list: () => Promise<Array<ProtocolResource | HLSMuxer>>
  get: (id: string) => Promise<ProtocolResource | HLSMuxer>
  kick?: (id: string) => Promise<unknown>
}

const PROTOCOL_TABS: Array<{ key: ProtocolKey; label: string }> = [
  { key: "rtsp", label: "RTSP" },
  { key: "rtmp", label: "RTMP" },
  { key: "hls", label: "HLS" },
  { key: "webrtc", label: "WebRTC" },
  { key: "srt", label: "SRT" },
  { key: "rtpMpegts", label: "RTP/MPEG-TS" },
]

const RUNTIME_GROUPS: RuntimeGroup[] = [
  {
    key: "rtspConnections",
    label: "RTSP connections",
    protocol: "rtsp",
    canKick: false,
    list: api.rtspConnections.list,
    get: api.rtspConnections.get,
  },
  {
    key: "rtspSessions",
    label: "RTSP sessions",
    protocol: "rtsp",
    canKick: true,
    list: api.rtspSessions.list,
    get: api.rtspSessions.get,
    kick: api.rtspSessions.kick,
  },
  {
    key: "rtspsConnections",
    label: "RTSPS connections",
    protocol: "rtsp",
    canKick: false,
    tlsOnly: true,
    list: api.rtspsConnections.list,
    get: api.rtspsConnections.get,
  },
  {
    key: "rtspsSessions",
    label: "RTSPS sessions",
    protocol: "rtsp",
    canKick: true,
    tlsOnly: true,
    list: api.rtspsSessions.list,
    get: api.rtspsSessions.get,
    kick: api.rtspsSessions.kick,
  },
  {
    key: "rtmpConnections",
    label: "RTMP connections",
    protocol: "rtmp",
    canKick: true,
    list: api.rtmpConnections.list,
    get: api.rtmpConnections.get,
    kick: api.rtmpConnections.kick,
  },
  {
    key: "rtmpsConnections",
    label: "RTMPS connections",
    protocol: "rtmp",
    canKick: true,
    tlsOnly: true,
    list: api.rtmpsConnections.list,
    get: api.rtmpsConnections.get,
    kick: api.rtmpsConnections.kick,
  },
  {
    key: "hlsMuxers",
    label: "HLS muxers",
    protocol: "hls",
    canKick: false,
    list: api.getHlsMuxers,
    get: api.getHlsMuxer,
  },
  {
    key: "webrtcSessions",
    label: "WebRTC sessions",
    protocol: "webrtc",
    canKick: true,
    list: api.webrtcSessions.list,
    get: api.webrtcSessions.get,
    kick: api.webrtcSessions.kick,
  },
  {
    key: "srtConnections",
    label: "SRT connections",
    protocol: "srt",
    canKick: true,
    list: api.srtConnections.list,
    get: api.srtConnections.get,
    kick: api.srtConnections.kick,
  },
]

const protocolGroups = PROTOCOL_FIELD_GROUPS as Record<ProtocolKey, { label: string; fields: string[] }>
const protocolFieldMetadata = PROTOCOL_FIELD_METADATA as Record<
  string,
  { label: string; type: string; options?: string[] }
>
const protocolGroup = (key: ProtocolKey) => protocolGroups[key]
const fieldMetadata = (field: string) => protocolFieldMetadata[field] || { label: field, type: "text" }
const resourceId = (resource: ProtocolResource | HLSMuxer) => String(("id" in resource ? resource.id : resource.name) || "")
const formatBytes = (bytes: unknown) => (typeof bytes === "number" ? `${(bytes / 1024 / 1024).toFixed(2)} MB` : "0 MB")
const isTlsRuntimeEnabled = (group: RuntimeGroup, config: GlobalConf | null) => {
  if (!group.tlsOnly) return true
  if (group.protocol === "rtsp") return config?.rtsp === true && config.rtspEncryption !== "no"
  if (group.protocol === "rtmp") return config?.rtmp === true && config.rtmpEncryption !== "no"
  return true
}

export function ProtocolServerManagement({
  permissions,
  username,
  paths,
  pathDefaults,
  appendAuditEvent,
  onChanged,
}: ProtocolServerManagementProps) {
  const { notify } = useNotifications()
  const canUseApi = permissions.api !== false
  const canRead = permissions.read !== false
  const canPublish = permissions.publish !== false
  const [activeProtocol, setActiveProtocol] = useState<ProtocolKey>("rtsp")
  const [config, setConfig] = useState<GlobalConf | null>(null)
  const [originalConfig, setOriginalConfig] = useState<GlobalConf | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [previewPatch, setPreviewPatch] = useState<Record<string, unknown> | null>(null)
  const [isLoadingConfig, setIsLoadingConfig] = useState(false)
  const [configError, setConfigError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [runtime, setRuntime] = useState<Partial<Record<RuntimeKey, Array<ProtocolResource | HLSMuxer>>>>({})
  const [runtimeError, setRuntimeError] = useState<string | null>(null)
  const [isLoadingRuntime, setIsLoadingRuntime] = useState(false)
  const [detail, setDetail] = useState<{ title: string; data: ProtocolResource | HLSMuxer } | null>(null)
  const [kickTarget, setKickTarget] = useState<{ group: RuntimeGroup; id: string } | null>(null)
  const [selectedPathName, setSelectedPathName] = useState(paths[0]?.name || "stream")
  const [showHlsPlayer, setShowHlsPlayer] = useState(false)

  useEffect(() => {
    if (!selectedPathName && paths[0]?.name) setSelectedPathName(paths[0].name)
  }, [paths, selectedPathName])

  const loadConfig = useCallback(async () => {
    setIsLoadingConfig(true)
    setConfigError(null)
    try {
      const next = await api.getGlobalConfig()
      setConfig(next)
      setOriginalConfig(JSON.parse(JSON.stringify(next)) as GlobalConf)
      setFieldErrors({})
      setPreviewPatch(null)
    } catch (error) {
      const message = api.getMediaMtxErrorMessage(error)
      setConfigError(message)
      notify({ type: "error", title: "Không thể tải cấu hình protocol", message })
    } finally {
      setIsLoadingConfig(false)
    }
  }, [notify])

  const loadRuntime = useCallback(async (loadedConfig = config) => {
    setIsLoadingRuntime(true)
    setRuntimeError(null)
    const enabledGroups = RUNTIME_GROUPS.filter((group) => isTlsRuntimeEnabled(group, loadedConfig))
    const entries = await Promise.allSettled(
      enabledGroups.map(async (group) => [group.key, await group.list()] as const),
    )
    const next: Partial<Record<RuntimeKey, Array<ProtocolResource | HLSMuxer>>> = {}
    for (const group of RUNTIME_GROUPS) {
      if (!isTlsRuntimeEnabled(group, loadedConfig)) next[group.key] = []
    }
    const failure = entries.find((entry) => entry.status === "rejected") as PromiseRejectedResult | undefined
    for (const entry of entries) {
      if (entry.status === "fulfilled") {
        const [key, items] = entry.value
        next[key] = items
      }
    }
    setRuntime(next)
    if (failure) {
      const message = api.getMediaMtxErrorMessage(failure.reason)
      setRuntimeError(message)
      notify({ type: "error", title: "Một số runtime protocol chưa tải được", message })
    }
    setIsLoadingRuntime(false)
  }, [config, notify])

  useEffect(() => {
    loadConfig().then(() => undefined)
  }, [loadConfig])

  useEffect(() => {
    if (config) loadRuntime(config)
  }, [config, loadRuntime])

  const selectedRuntimeGroups = useMemo(
    () => RUNTIME_GROUPS.filter((group) => group.protocol === activeProtocol),
    [activeProtocol],
  )

  const updateField = (field: keyof GlobalConf, value: unknown) => {
    setConfig((current) => (current ? { ...current, [field]: value } : current))
    setFieldErrors((current) => {
      const next = { ...current }
      delete next[field as string]
      return next
    })
    setPreviewPatch(null)
  }

  const currentFields = protocolGroup(activeProtocol).fields
  const dirtyPatch = useMemo(
    () => buildProtocolConfigPatch(originalConfig || {}, config || {}, currentFields),
    [config, currentFields, originalConfig],
  )

  const showPreview = () => {
    const errors = validateProtocolConfigPatch(dirtyPatch) as Record<string, string>
    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) {
      notify({ type: "error", title: "Cấu hình protocol chưa hợp lệ", message: "Kiểm tra các trường được đánh dấu." })
      return
    }
    if (Object.keys(dirtyPatch).length === 0) {
      notify({ type: "info", title: "Không có thay đổi để lưu" })
      return
    }
    setPreviewPatch(dirtyPatch as Record<string, unknown>)
  }

  const savePatch = async () => {
    if (!previewPatch) return
    setIsSaving(true)
    try {
      requireMediaMtxAction(permissions, "api")
      await api.patchGlobalConfig(previewPatch as Partial<GlobalConf>)
      setOriginalConfig((current) => (current ? { ...current, ...previewPatch } : current))
      setPreviewPatch(null)
      notify({ type: "success", title: "Đã cập nhật protocol", message: protocolGroup(activeProtocol).label })
      appendAuditEvent?.({
        actor: username,
        action: "protocol-config.patch",
        target: activeProtocol,
        payloadSummary: summarizeProtocolPayload(previewPatch),
        result: "success",
      })
      await onChanged?.()
    } catch (error) {
      notify({ type: "error", title: "Không thể cập nhật protocol", message: api.getMediaMtxErrorMessage(error) })
      appendAuditEvent?.({
        actor: username,
        action: "protocol-config.patch",
        target: activeProtocol,
        payloadSummary: summarizeProtocolPayload(previewPatch),
        result: "failure",
        errorSummary: api.getMediaMtxErrorMessage(error),
      })
    } finally {
      setIsSaving(false)
    }
  }

  const openDetail = async (group: RuntimeGroup, id: string) => {
    try {
      const data = await group.get(id)
      setDetail({ title: `${group.label}: ${id}`, data })
    } catch (error) {
      notify({ type: "error", title: "Không thể tải chi tiết runtime", message: api.getMediaMtxErrorMessage(error) })
    }
  }

  const executeKick = async () => {
    if (!kickTarget?.group.kick) return
    try {
      requireMediaMtxAction(permissions, "api")
      await kickTarget.group.kick(kickTarget.id)
      notify({ type: "success", title: "Đã kick runtime", message: kickTarget.id })
      appendAuditEvent?.({
        actor: username,
        action: "protocol-runtime.kick",
        target: `${kickTarget.group.key}:${kickTarget.id}`,
        result: "success",
      })
      setKickTarget(null)
      await loadRuntime()
    } catch (error) {
      notify({ type: "error", title: "Không thể kick runtime", message: api.getMediaMtxErrorMessage(error) })
      appendAuditEvent?.({
        actor: username,
        action: "protocol-runtime.kick",
        target: `${kickTarget.group.key}:${kickTarget.id}`,
        result: "failure",
        errorSummary: api.getMediaMtxErrorMessage(error),
      })
    }
  }

  const urls = buildMediaMtxProtocolUrls(selectedPathName, config || {})

  const renderField = (field: string) => {
    const metadata = fieldMetadata(field)
    const value = config?.[field as keyof GlobalConf]
    const error = fieldErrors[field]
    const common = {
      id: `protocol-${field}`,
      disabled: !canUseApi || isSaving,
      className: error ? "border-[#cf202f]" : undefined,
    }

    if (metadata.type === "boolean") {
      return (
        <div key={field} className="flex items-center justify-between rounded-lg border p-3">
          <div>
            <Label>{metadata.label}</Label>
            {field === "rtspDemuxMpegts" && <p className="text-xs text-muted-foreground">Demux MPEG-TS khi nhận qua RTSP.</p>}
          </div>
          <Switch
            checked={value === true}
            onCheckedChange={(checked) => updateField(field as keyof GlobalConf, checked)}
            disabled={!canUseApi || isSaving}
          />
        </div>
      )
    }

    if (metadata.type === "enum") {
      return (
        <div key={field} className="space-y-2">
          <Label htmlFor={`protocol-${field}`}>{metadata.label}</Label>
          <Select
            value={typeof value === "string" ? value : ""}
            onValueChange={(next) => updateField(field as keyof GlobalConf, next)}
            disabled={!canUseApi || isSaving}
          >
            <SelectTrigger className={error ? "border-[#cf202f]" : undefined}>
              <SelectValue placeholder="Chọn giá trị" />
            </SelectTrigger>
            <SelectContent>
              {(metadata.options || []).map((option: string) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {error && <p className="text-xs text-[#cf202f]">{error}</p>}
        </div>
      )
    }

    if (metadata.type === "number") {
      return (
        <div key={field} className="space-y-2">
          <Label htmlFor={`protocol-${field}`}>{metadata.label}</Label>
          <Input
            {...common}
            type="number"
            value={typeof value === "number" ? value : ""}
            onChange={(event) => updateField(field as keyof GlobalConf, event.target.value ? Number(event.target.value) : undefined)}
          />
          {error && <p className="text-xs text-[#cf202f]">{error}</p>}
        </div>
      )
    }

    if (metadata.type === "stringArray") {
      return (
        <div key={field} className="space-y-2">
          <Label htmlFor={`protocol-${field}`}>{metadata.label}</Label>
          <Input
            {...common}
            value={Array.isArray(value) ? value.join(", ") : ""}
            onChange={(event) => updateField(field as keyof GlobalConf, parseStringArray(event.target.value))}
            placeholder={metadata.options?.join(", ") || "ip1, ip2"}
          />
          {error && <p className="text-xs text-[#cf202f]">{error}</p>}
        </div>
      )
    }

    if (metadata.type === "jsonArray") {
      return (
        <div key={field} className="space-y-2 md:col-span-2">
          <Label htmlFor={`protocol-${field}`}>{metadata.label}</Label>
          <Input
            {...common}
            value={JSON.stringify(Array.isArray(value) ? value : [])}
            onChange={(event) => {
              try {
                updateField(field as keyof GlobalConf, JSON.parse(event.target.value))
              } catch {
                updateField(field as keyof GlobalConf, event.target.value)
              }
            }}
            placeholder='[{"url":"stun:stun.l.google.com:19302"}]'
          />
          {error && <p className="text-xs text-[#cf202f]">{error}</p>}
        </div>
      )
    }

    return (
      <div key={field} className="space-y-2">
        <Label htmlFor={`protocol-${field}`}>{metadata.label}</Label>
        <Input
          {...common}
          type={metadata.type === "secret" ? "password" : "text"}
          value={typeof value === "string" ? value : ""}
          onChange={(event) => updateField(field as keyof GlobalConf, event.target.value)}
          placeholder={metadata.type === "secret" ? "server.key / server.crt" : undefined}
        />
        {metadata.type === "secret" && <p className="text-xs text-muted-foreground">Giá trị này sẽ bị mask trong audit log.</p>}
        {error && <p className="text-xs text-[#cf202f]">{error}</p>}
      </div>
    )
  }

  const renderRuntimeGroup = (group: RuntimeGroup) => {
    const items = runtime[group.key] || []
    return (
      <Card key={group.key} className="shadow-none">
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="text-base">{group.label}</CardTitle>
              <CardDescription>{items.length} tài nguyên</CardDescription>
            </div>
            <Button size="sm" variant="outline" onClick={() => loadRuntime()} disabled={isLoadingRuntime}>
              <RefreshCw className={`mr-2 h-4 w-4 ${isLoadingRuntime ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoadingRuntime ? (
            <LoadingState label="Đang tải runtime..." />
          ) : runtimeError && items.length === 0 ? (
            <ErrorState message={runtimeError} onRetry={() => loadRuntime()} />
          ) : items.length === 0 ? (
            <EmptyState title="Chưa có tài nguyên runtime" />
          ) : (
            <div className="space-y-3">
              {items.map((item) => {
                const id = resourceId(item)
                const srtMetrics = group.key === "srtConnections" ? extractSrtMetrics(item) : null
                return (
                  <div key={id} className="rounded-lg border p-3">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-mono text-sm font-medium">{id || "unknown"}</p>
                          {"state" in item && item.state ? <Badge variant="secondary">{String(item.state)}</Badge> : null}
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {"remoteAddr" in item && item.remoteAddr ? String(item.remoteAddr) : "Không có remote address"}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          RX {formatBytes((item as ProtocolResource).bytesReceived)} / TX {formatBytes((item as ProtocolResource).bytesSent)}
                        </p>
                        {srtMetrics && (
                          <div className="mt-2 flex flex-wrap gap-2 text-xs">
                            {Object.entries(srtMetrics).map(([metric, metricValue]) =>
                              metricValue === null ? null : (
                                <Badge key={metric} variant="outline">
                                  {metric}: {metricValue}
                                </Badge>
                              ),
                            )}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="outline" onClick={() => openDetail(group, id)}>
                          <Eye className="mr-2 h-4 w-4" />
                          Chi tiết
                        </Button>
                        {group.canKick ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-[#cf202f] hover:text-[#cf202f]"
                            disabled={!canUseApi}
                            onClick={() => setKickTarget({ group, id })}
                          >
                            <XCircle className="mr-2 h-4 w-4" />
                            Kick
                          </Button>
                        ) : (
                          <Badge variant="secondary">Read-only</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  if (isLoadingConfig && !config) return <LoadingState label="Đang tải protocol servers..." />
  if (configError && !config) return <ErrorState message={configError} onRetry={loadConfig} />

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Protocol servers</h2>
          <p className="text-sm text-muted-foreground">Cấu hình, runtime, player và URL mẫu cho các protocol MediaMTX.</p>
        </div>
        <Button variant="outline" onClick={() => { loadConfig(); loadRuntime() }} disabled={isLoadingConfig || isLoadingRuntime}>
          <RefreshCw className={`mr-2 h-4 w-4 ${isLoadingConfig || isLoadingRuntime ? "animate-spin" : ""}`} />
          Refresh protocol
        </Button>
      </div>

      {!canUseApi && (
        <div className="flex items-center gap-2 rounded-lg border border-[#cf202f]/30 bg-[#cf202f]/5 p-3 text-sm text-[#cf202f]">
          <Shield className="h-4 w-4" />
          Cần quyền api để chỉnh sửa cấu hình hoặc kick runtime.
        </div>
      )}

      <Tabs value={activeProtocol} onValueChange={(value) => setActiveProtocol(value as ProtocolKey)} className="space-y-4">
        <TabsList className="grid h-auto w-full grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-6">
          {PROTOCOL_TABS.map((tab) => (
            <TabsTrigger key={tab.key} value={tab.key}>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {PROTOCOL_TABS.map((tab) => (
          <TabsContent key={tab.key} value={tab.key} className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <CardTitle>{protocolGroup(tab.key).label}</CardTitle>
                    <CardDescription>PATCH /v3/config/global/patch chỉ gửi các trường đã thay đổi.</CardDescription>
                  </div>
                  <Button onClick={showPreview} disabled={!canUseApi || isSaving || Object.keys(dirtyPatch).length === 0}>
                    <Eye className="mr-2 h-4 w-4" />
                    Xem trước & lưu
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  {protocolGroup(tab.key).fields.map(renderField)}
                </div>
                {tab.key === "srt" && (
                  <div className="rounded-lg border bg-[#f7f7f7] p-3 text-sm text-muted-foreground">
                    Passphrase SRT là cấu hình theo path: read `{String(pathDefaults?.srtReadPassphrase || "chưa đặt")}`,
                    publish `{String(pathDefaults?.srtPublishPassphrase || "chưa đặt")}`.
                  </div>
                )}
                {tab.key === "rtpMpegts" && (
                  <div className="rounded-lg border bg-[#f7f7f7] p-3 text-sm text-muted-foreground">
                    `rtpSDP` là cấu hình theo path. MPEG-TS publish/read dùng source `udp+mpegts://ip:port` hoặc workflow phù hợp MediaMTX.
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>

      {previewPatch && (
        <Card className="border-[#0052ff]/30 bg-[#0052ff]/5">
          <CardHeader>
            <CardTitle className="text-base">Xem trước protocol patch</CardTitle>
            <CardDescription>Payload gửi tới PATCH /v3/config/global/patch.</CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="max-h-56 overflow-auto rounded-lg bg-[#0a0b0d] p-4 text-xs text-white">
              {JSON.stringify(previewPatch, null, 2)}
            </pre>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button onClick={savePatch} disabled={isSaving}>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                {isSaving ? "Đang áp dụng..." : "Áp dụng thay đổi"}
              </Button>
              <Button variant="outline" onClick={() => setPreviewPatch(null)} disabled={isSaving}>
                Hủy
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Player và URL mẫu</CardTitle>
          <CardDescription>URL được tạo từ cấu hình hiện tại hoặc fallback mặc định của MediaMTX.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
            <div className="space-y-2">
              <Label htmlFor="protocol-path">Path stream</Label>
              <Input
                id="protocol-path"
                value={selectedPathName}
                onChange={(event) => setSelectedPathName(event.target.value)}
                list="protocol-paths"
              />
              <datalist id="protocol-paths">
                {paths.map((path) => (
                  <option key={path.name} value={path.name} />
                ))}
              </datalist>
            </div>
            <Button
              variant="outline"
              disabled={!canRead}
              onClick={() => setShowHlsPlayer((current) => !current)}
            >
              <Play className="mr-2 h-4 w-4" />
              {showHlsPlayer ? "Ẩn HLS player" : "Mở HLS player"}
            </Button>
          </div>
          {showHlsPlayer && canRead && <StreamPlayer pathName={selectedPathName || "stream"} />}
          <div className="grid gap-3 md:grid-cols-2">
            {[
              ["HLS read", canRead, buildMediaMtxHlsUrl(selectedPathName || "stream")],
              ["WebRTC/WHEP read", canRead, buildMediaMtxWebRtcReadUrl(selectedPathName || "stream")],
              ["WebRTC/WHIP publish", canPublish, buildMediaMtxWebRtcPublishUrl(selectedPathName || "stream")],
              ["RTSP read/publish", canRead || canPublish, urls.rtspRead],
              ["RTSPS read/publish", canRead || canPublish, urls.rtspsRead],
              ["RTMP publish", canPublish, urls.rtmpPublish],
              ["RTMPS publish", canPublish, urls.rtmpsPublish],
              ["SRT read/publish", canRead || canPublish, urls.srtRead],
              ["RTP source", canPublish, urls.rtpSource],
              ["MPEG-TS source", canPublish, urls.mpegtsSource],
            ].map(([label, allowed, url]) => (
              <div key={String(label)} className="rounded-lg border p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <Label>{String(label)}</Label>
                  {allowed ? <LinkIcon className="h-4 w-4 text-[#0052ff]" /> : <Badge variant="secondary">Không có quyền</Badge>}
                </div>
                <code className="block overflow-x-auto rounded bg-[#f7f7f7] p-2 text-xs">{allowed ? String(url) : "Bị ẩn theo quyền phiên"}</code>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Separator />

      <div className="grid gap-4 lg:grid-cols-2">{selectedRuntimeGroups.map(renderRuntimeGroup)}</div>

      <Dialog open={Boolean(detail)} onOpenChange={(open) => !open && setDetail(null)}>
        <DialogContent className="max-h-[80vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{detail?.title}</DialogTitle>
            <DialogDescription>Chi tiết runtime trả về từ MediaMTX Control API.</DialogDescription>
          </DialogHeader>
          <pre className="max-h-[55vh] overflow-auto rounded-lg bg-[#0a0b0d] p-4 text-xs text-white">
            {JSON.stringify(detail?.data || {}, null, 2)}
          </pre>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(kickTarget)} onOpenChange={(open) => !open && setKickTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Xác nhận kick runtime</DialogTitle>
            <DialogDescription>
              Tài nguyên `{kickTarget?.id}` trong `{kickTarget?.group.label}` sẽ bị ngắt khỏi MediaMTX.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setKickTarget(null)}>
              Hủy
            </Button>
            <Button className="bg-[#cf202f] hover:bg-[#a81925]" onClick={executeKick} disabled={!canUseApi}>
              Kick
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
