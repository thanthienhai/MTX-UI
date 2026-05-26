"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Server,
  Users,
  Video,
  Shield,
  Activity,
  Play,
  Radio,
  Globe,
  Eye,
  EyeOff,
  RefreshCw,
  Plus,
  Trash2,
  Monitor,
  LogOut,
  Edit,
  VideoIcon,
  ArrowDownToLine,
  ArrowUpFromLine,
  Settings,
  Code2,
  BookOpen,
} from "lucide-react"
import { ProtectedRoute } from "@/components/protected-route"
import { clearAuth, getDashboardSession, getSessionPermissions, getUsername } from "@/lib/auth"
import { StreamPlayer } from "@/components/stream-player"
import { WHEPPlayer } from "@/components/whep-player"
import { MultiViewPlayer } from "@/components/multi-view-player"
import { SnapshotConfig } from "@/components/snapshot-config"
import { SnapshotGallery } from "@/components/snapshot-gallery"
import { SnapshotThumbnail } from "@/components/snapshot-thumbnail"
import { ReEncodingConfig } from "@/components/re-encoding-config"
import { GuidesView } from "@/components/guides-view"
import { EmptyState, ErrorState, LoadingState } from "@/components/module-state"
import { useNotifications } from "@/components/notification-provider"
import * as api from "@/lib/mediamtx-api"
import type { DashboardAuditEvent } from "@/lib/dashboard-audit"
import { createAuditEvent, loadAuditEvents, saveAuditEvents } from "@/lib/dashboard-audit"
import { requireMediaMtxAction, type MediaMtxPermissionSet } from "@/lib/mediamtx-permissions"
import {
  buildMediaMtxMetricsUrl,
  buildMediaMtxPlaybackUrl,
  buildMediaMtxPprofUrl,
  clearMediaMtxServiceUrls,
  getStoredMediaMtxServiceUrls,
  normalizeMediaMtxApiBaseUrl,
  normalizeMediaMtxHlsBaseUrl,
  normalizeMediaMtxMetricsBaseUrl,
  normalizeMediaMtxPlaybackBaseUrl,
  normalizeMediaMtxPprofBaseUrl,
  saveMediaMtxServiceUrls,
  validateMediaMtxServiceUrls,
} from "@/lib/mediamtx-url.mjs"
import { useRefreshPolling } from "@/hooks/use-refresh-polling"
import { GlobalConfigView } from "@/components/global-config-view"
import { HooksView } from "@/components/hooks-view"
import { ProtocolServerManagement } from "@/components/protocol-server-management"
import { AuthConfigurationView } from "@/components/auth-configuration-view"
import { RecordingSettingsView } from "@/components/recording-settings-view"
import { RecordingStatusView } from "@/components/recording-status-view"
import { RemoteUploadConfig } from "@/components/remote-upload-config"
import { PlaybackView } from "@/components/playback-view"
import type { GlobalConf, HLSMuxer, PathConfig, Path as LivePath } from "@/lib/mediamtx-api"
import {
  buildDashboardOverview,
  calculateBitrate,
  formatBitsPerSecond,
  getTrafficTotals,
} from "@/lib/dashboard-overview.mjs"
import { ProxyConfig } from "@/components/proxy-config"
import { CommandLifecycleBadge } from "@/components/command-lifecycle-badge"
import { isUpstreamSourceUrl } from "@/lib/path-management.mjs"

function MediaMTXDashboard() {
  const router = useRouter()
  const username = getUsername()
  const { notify } = useNotifications()

  const [config, setConfig] = useState({
    logLevel: "info",
    rtsp: true,
    rtspAddress: ":8554",
    rtmp: true,
    rtmpAddress: ":1935",
    hls: true,
    hlsAddress: ":8888",
    webrtc: true,
    webrtcAddress: ":8889",
    api: false,
    apiAddress: ":9997",
    metrics: false,
    metricsAddress: ":9998",
  })
  const defaultServiceUrls = useMemo(
    () => ({
      controlApi: normalizeMediaMtxApiBaseUrl(""),
      hls: normalizeMediaMtxHlsBaseUrl(""),
      playback: normalizeMediaMtxPlaybackBaseUrl(""),
      metrics: normalizeMediaMtxMetricsBaseUrl(""),
      pprof: normalizeMediaMtxPprofBaseUrl(""),
    }),
    [],
  )
  const [serviceUrlDraft, setServiceUrlDraft] = useState(defaultServiceUrls)
  const [serviceUrlErrors, setServiceUrlErrors] = useState<Record<string, string>>({})

  const [paths, setPaths] = useState<PathConfig[]>([])
  const [livePaths, setLivePaths] = useState<LivePath[]>([])
  const [isLoadingPaths, setIsLoadingPaths] = useState(false)
  const [dashboardError, setDashboardError] = useState<string | null>(null)
  const [globalConfig, setGlobalConfig] = useState<GlobalConf | null>(null)
  const [pathDefaults, setPathDefaults] = useState<PathConfig | null>(null)
  const [hlsMuxers, setHlsMuxers] = useState<HLSMuxer[]>([])
  const [protocolCounts, setProtocolCounts] = useState<Record<string, number>>({})
  const [auditEvents, setAuditEvents] = useState<DashboardAuditEvent[]>([])
  const [permissions, setPermissions] = useState<MediaMtxPermissionSet>(() => getSessionPermissions())
  const [apiLatencyMs, setApiLatencyMs] = useState<number | null>(null)
  const [metricsStatus, setMetricsStatus] = useState<{
    status: "healthy" | "degraded" | "disabled" | "unknown"
    latencyMs?: number
    checkedAt?: string
    message?: string
  }>({ status: "unknown" })
  const [lastConfigUpdateAt, setLastConfigUpdateAt] = useState<string | null>(null)
  const [bitrate, setBitrate] = useState<{ inboundBps: number | null; outboundBps: number | null }>({
    inboundBps: null,
    outboundBps: null,
  })
  const [isPollingEnabled, setIsPollingEnabled] = useState(true)
  const [pollingIntervalMs, setPollingIntervalMs] = useState(10000)
  const [selectedStreamPath, setSelectedStreamPath] = useState<string | null>(null)
  const [selectedStreamPathWebRTC, setSelectedStreamPathWebRTC] = useState<string | null>(null)
  const [editingPath, setEditingPath] = useState<PathConfig | null>(null)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [pathToDelete, setPathToDelete] = useState<string | null>(null)
  const [isHeroSummaryHidden, setIsHeroSummaryHidden] = useState(false)

  const [isAddPathDialogOpen, setIsAddPathDialogOpen] = useState(false)
  const [newPath, setNewPath] = useState({
    name: "",
    source: "",
    sourceFingerprint: "",
    sourceOnDemand: true,
    record: false,
    recordPath: "./recordings/%path/%Y-%m-%d_%H-%M-%S-%f",
    recordFormat: "fmp4",
    recordPartDuration: "1s",
    recordSegmentDuration: "1h",
    recordDeleteAfter: "0s",
    maxReaders: 0,
    overridePublisher: true,
  })
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Proxy dialog state
  const [isProxyDialogOpen, setIsProxyDialogOpen] = useState(false)
  const [editingProxyPath, setEditingProxyPath] = useState<PathConfig | null>(null)
  const [proxyNewPathName, setProxyNewPathName] = useState("")
  const [proxySource, setProxySource] = useState("")
  const [proxySourceOnDemand, setProxySourceOnDemand] = useState(true)
  const [proxySourceOnDemandStartTimeout, setProxySourceOnDemandStartTimeout] = useState("10s")
  const [proxySourceOnDemandCloseAfter, setProxySourceOnDemandCloseAfter] = useState("10s")
  const [proxySourceFingerprint, setProxySourceFingerprint] = useState("")

  const previousTrafficSampleRef = useRef<{ timestamp: number; bytesReceived: number; bytesSent: number } | null>(null)

  useEffect(() => {
    const events = loadAuditEvents()
    setAuditEvents(events)
    setPermissions(getSessionPermissions(getDashboardSession()))
    setServiceUrlDraft({ ...defaultServiceUrls, ...getStoredMediaMtxServiceUrls() })
  }, [defaultServiceUrls])

  const appendAuditEvent = useCallback((event: Omit<DashboardAuditEvent, "id" | "timestamp">) => {
    setAuditEvents((current) => {
      const next = [createAuditEvent(event), ...current].slice(0, 100)
      saveAuditEvents(next)
      return next
    })
  }, [])

  const notifyError = useCallback(
    (title: string, error: unknown) => {
      notify({ type: "error", title, message: api.getMediaMtxErrorMessage(error) })
    },
    [notify],
  )

  const fetchPaths = useCallback(async () => {
    setIsLoadingPaths(true)
    setDashboardError(null)
    const startedAt = performance.now()
    try {
      const [configsResult, liveResult, globalResult, defaultsResult, muxersResult] =
        await Promise.allSettled([
        api.getPathConfigs(),
        api.getPaths(),
        api.getGlobalConfig(),
        api.getPathDefaults(),
        api.getHlsMuxers(),
      ])
      const getValue = <T,>(result: PromiseSettledResult<T>, fallback: T) =>
        result.status === "fulfilled" ? result.value : fallback
      const configs = getValue(configsResult, [])
      const live = getValue(liveResult, [])
      const global = getValue(globalResult, null)
      const defaults = getValue(defaultsResult, null)
      const muxers = getValue(muxersResult, [])
      const rtspTlsEnabled = global?.rtsp === true && global.rtspEncryption !== "no"
      const rtmpTlsEnabled = global?.rtmp === true && global.rtmpEncryption !== "no"
      const protocolResults = await Promise.allSettled([
        api.rtspConnections.list(),
        api.rtspSessions.list(),
        rtspTlsEnabled ? api.rtspsConnections.list() : Promise.resolve([]),
        rtspTlsEnabled ? api.rtspsSessions.list() : Promise.resolve([]),
        api.rtmpConnections.list(),
        rtmpTlsEnabled ? api.rtmpsConnections.list() : Promise.resolve([]),
        api.srtConnections.list(),
        api.webrtcSessions.list(),
      ])
      const firstFailure = [
        configsResult,
        liveResult,
        globalResult,
        defaultsResult,
        muxersResult,
        ...protocolResults,
      ].find((result) => result.status === "rejected") as PromiseRejectedResult | undefined
      const protocolLists = protocolResults.map((result) => getValue(result, null))

      setPaths(configs.filter((p) => p.name !== "all_others"))
      setLivePaths(live)
      setGlobalConfig(global)
      setPathDefaults(defaults)
      setHlsMuxers(muxers)
      setApiLatencyMs(Math.round(performance.now() - startedAt))
      setLastConfigUpdateAt(new Date().toISOString())
      setProtocolCounts({
        rtspConnections: protocolLists[0]?.length ?? -1,
        rtspSessions: protocolLists[1]?.length ?? -1,
        rtspsConnections: protocolLists[2]?.length ?? -1,
        rtspsSessions: protocolLists[3]?.length ?? -1,
        rtmpConnections: protocolLists[4]?.length ?? -1,
        rtmpsConnections: protocolLists[5]?.length ?? -1,
        hlsMuxers: muxersResult.status === "fulfilled" ? muxers.length : -1,
        srtConnections: protocolLists[6]?.length ?? -1,
        webrtcSessions: protocolLists[7]?.length ?? -1,
      })
      const trafficTotals = getTrafficTotals(live, muxers, protocolLists.filter(Boolean))
      const currentSample = { timestamp: Date.now(), ...trafficTotals }
      const nextBitrate = calculateBitrate(previousTrafficSampleRef.current, currentSample)
      setBitrate({ inboundBps: nextBitrate.inboundBps, outboundBps: nextBitrate.outboundBps })
      previousTrafficSampleRef.current = currentSample

      if (permissions.metrics === false || global?.metrics === false) {
        setMetricsStatus({ status: "disabled", checkedAt: new Date().toISOString() })
      } else {
        const metricsStartedAt = performance.now()
        try {
          const response = await fetch(buildMediaMtxMetricsUrl(), { cache: "no-store" })
          setMetricsStatus({
            status: response.ok ? "healthy" : "degraded",
            latencyMs: Math.round(performance.now() - metricsStartedAt),
            checkedAt: new Date().toISOString(),
            message: response.ok ? undefined : `Metrics trả về ${response.status}`,
          })
        } catch (error) {
          setMetricsStatus({
            status: "degraded",
            checkedAt: new Date().toISOString(),
            message: error instanceof Error ? error.message : "Không thể scrape metrics",
          })
        }
      }
      if (firstFailure) {
        const message = api.getMediaMtxErrorMessage(firstFailure.reason)
        setDashboardError(`Một số dữ liệu MediaMTX chưa tải được: ${message}`)
        notify({ type: "error", title: "Dữ liệu MediaMTX chưa đầy đủ", message })
      }
    } catch (error) {
      console.error("Error fetching paths:", error)
      const message = api.getMediaMtxErrorMessage(error)
      setDashboardError(message)
      notify({ type: "error", title: "Không thể tải dữ liệu MediaMTX", message })
    } finally {
      setIsLoadingPaths(false)
    }
  }, [notify, permissions.metrics])

  const polling = useRefreshPolling({
    enabled: isPollingEnabled,
    intervalMs: pollingIntervalMs,
    refresh: fetchPaths,
  })

  useEffect(() => {
    fetchPaths()
  }, [fetchPaths])

  const handleEditPath = async (path: PathConfig) => {
    setEditingPath(path)
    setIsEditDialogOpen(true)
  }

  const handleUpdatePath = async () => {
    if (!editingPath) return

    setIsSubmitting(true)
    try {
      requireMediaMtxAction(permissions, "api")
      await api.updatePath(editingPath.name, editingPath)
      await fetchPaths()
      setIsEditDialogOpen(false)
      setEditingPath(null)
      notify({ type: "success", title: "Đã cập nhật path", message: editingPath.name })
      appendAuditEvent({
        actor: username,
        action: "path.update",
        target: editingPath.name,
        payloadSummary: JSON.stringify({ source: editingPath.source, record: editingPath.record }),
        result: "success",
      })
    } catch (error) {
      console.error("Error updating path:", error)
      notifyError("Không thể cập nhật path", error)
      appendAuditEvent({
        actor: username,
        action: "path.update",
        target: editingPath.name,
        payloadSummary: JSON.stringify({ source: editingPath.source, record: editingPath.record }),
        result: "failure",
        errorSummary: api.getMediaMtxErrorMessage(error),
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeletePath = async () => {
    if (!pathToDelete) return

    setIsSubmitting(true)
    try {
      requireMediaMtxAction(permissions, "api")
      await api.deletePath(pathToDelete)
      await fetchPaths()
      setIsDeleteDialogOpen(false)
      setPathToDelete(null)
      notify({ type: "success", title: "Đã xóa path", message: pathToDelete })
      appendAuditEvent({
        actor: username,
        action: "path.delete",
        target: pathToDelete,
        result: "success",
      })
    } catch (error) {
      console.error("Error deleting path:", error)
      notifyError("Không thể xóa path", error)
      appendAuditEvent({
        actor: username,
        action: "path.delete",
        target: pathToDelete,
        result: "failure",
        errorSummary: api.getMediaMtxErrorMessage(error),
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const confirmDelete = (pathName: string) => {
    setPathToDelete(pathName)
    setIsDeleteDialogOpen(true)
  }

  const getPathStatus = (pathName: string) => {
    const livePath = livePaths.find((p) => p.name === pathName)
    return {
      isLive: livePath?.ready || false,
      source: livePath?.source?.type || null,
      readers: livePath?.readers.length || 0,
      bytesReceived: livePath?.bytesReceived || 0,
      bytesSent: livePath?.bytesSent || 0,
    }
  }

  const handleLogout = () => {
    clearAuth()
    router.push("/login")
  }

  const handleSaveServiceUrls = () => {
    const errors = validateMediaMtxServiceUrls(serviceUrlDraft) as Record<string, string>
    setServiceUrlErrors(errors)
    if (Object.keys(errors).length > 0) {
      notify({ type: "error", title: "URL dịch vụ chưa hợp lệ", message: "Kiểm tra các trường được đánh dấu." })
      return
    }

    saveMediaMtxServiceUrls(serviceUrlDraft)
    notify({ type: "success", title: "Đã lưu URL dịch vụ", message: "Các link và request phía trình duyệt sẽ dùng cấu hình mới." })
    appendAuditEvent({
      actor: username,
      action: "service-urls.update",
      target: "browser-service-urls",
      payloadSummary: JSON.stringify(serviceUrlDraft),
      result: "success",
    })
    fetchPaths().catch(() => undefined)
  }

  const handleResetServiceUrls = () => {
    clearMediaMtxServiceUrls()
    setServiceUrlDraft(defaultServiceUrls)
    setServiceUrlErrors({})
    notify({ type: "info", title: "Đã đặt lại URL dịch vụ", message: "Dashboard sẽ dùng giá trị mặc định hoặc biến môi trường." })
  }

  const handleAddPath = async () => {
    if (!newPath.name) {
      notify({ type: "error", title: "Cần nhập tên path" })
      return
    }

    if (!newPath.source) {
      notify({ type: "error", title: "Cần nhập URL nguồn" })
      return
    }

    setIsSubmitting(true)

    try {
      requireMediaMtxAction(permissions, "api")
      requireMediaMtxAction(permissions, "publish")
      await api.addPath(newPath as PathConfig)
      await fetchPaths()

      // Reset form and close dialog
      setNewPath({
        name: "",
        source: "",
        sourceFingerprint: "",
        sourceOnDemand: true,
        record: false,
        recordPath: "./recordings/%path/%Y-%m-%d_%H-%M-%S-%f",
        recordFormat: "fmp4",
        recordPartDuration: "1s",
        recordSegmentDuration: "1h",
        recordDeleteAfter: "0s",
        maxReaders: 0,
        overridePublisher: true,
      })
      setIsAddPathDialogOpen(false)
      notify({ type: "success", title: "Đã thêm path", message: newPath.name })
      appendAuditEvent({
        actor: username,
        action: "path.add",
        target: newPath.name,
        payloadSummary: JSON.stringify({ source: newPath.source, record: newPath.record }),
        result: "success",
      })
    } catch (error) {
      console.error("Error adding path:", error)
      notifyError("Không thể thêm path", error)
      appendAuditEvent({
        actor: username,
        action: "path.add",
        target: newPath.name,
        payloadSummary: JSON.stringify({ source: newPath.source, record: newPath.record }),
        result: "failure",
        errorSummary: api.getMediaMtxErrorMessage(error),
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSaveProxyPath = async () => {
    if (!proxyNewPathName.trim()) {
      notify({ type: "error", title: "Cần nhập tên proxy path" })
      return
    }
    if (!proxySource.trim()) {
      notify({ type: "error", title: "Cần nhập source URL" })
      return
    }

    setIsSubmitting(true)
    try {
      requireMediaMtxAction(permissions, "api")
      if (editingProxyPath) {
        await api.updatePath(editingProxyPath.name, {
          ...editingProxyPath,
          source: proxySource,
          sourceOnDemand: proxySourceOnDemand,
          sourceOnDemandStartTimeout: proxySourceOnDemandStartTimeout,
          sourceOnDemandCloseAfter: proxySourceOnDemandCloseAfter,
          sourceFingerprint: proxySourceFingerprint,
        } as PathConfig)
        notify({ type: "success", title: "Đã cập nhật proxy path", message: editingProxyPath.name })
        appendAuditEvent({
          actor: username,
          action: "path.update",
          target: editingProxyPath.name,
          payloadSummary: JSON.stringify({ source: proxySource, sourceOnDemand: proxySourceOnDemand }),
          result: "success",
        })
      } else {
        await api.addPath({
          name: proxyNewPathName.trim(),
          source: proxySource,
          sourceOnDemand: proxySourceOnDemand,
          sourceOnDemandStartTimeout: proxySourceOnDemandStartTimeout,
          sourceOnDemandCloseAfter: proxySourceOnDemandCloseAfter,
          sourceFingerprint: proxySourceFingerprint,
          record: false,
          overridePublisher: true,
        } as PathConfig)
        notify({ type: "success", title: "Đã thêm proxy path", message: proxyNewPathName.trim() })
        appendAuditEvent({
          actor: username,
          action: "path.add",
          target: proxyNewPathName.trim(),
          payloadSummary: JSON.stringify({ source: proxySource, sourceOnDemand: proxySourceOnDemand }),
          result: "success",
        })
      }
      await fetchPaths()
      setIsProxyDialogOpen(false)
      setProxyNewPathName("")
      setProxySource("")
      setProxySourceOnDemand(true)
      setProxySourceOnDemandStartTimeout("10s")
      setProxySourceOnDemandCloseAfter("10s")
      setProxySourceFingerprint("")
      setEditingProxyPath(null)
    } catch (error) {
      console.error("Error saving proxy path:", error)
      notifyError("Không thể lưu proxy path", error)
      appendAuditEvent({
        actor: username,
        action: editingProxyPath ? "path.update" : "path.add",
        target: editingProxyPath?.name || proxyNewPathName.trim(),
        result: "failure",
        errorSummary: api.getMediaMtxErrorMessage(error),
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleRefreshJwks = async () => {
    try {
      requireMediaMtxAction(permissions, "api")
      await api.refreshJwks()
      notify({ type: "success", title: "Đã refresh JWKS" })
      appendAuditEvent({ actor: username, action: "auth.jwks.refresh", target: "jwks", result: "success" })
    } catch (error) {
      notifyError("Không thể refresh JWKS", error)
      appendAuditEvent({
        actor: username,
        action: "auth.jwks.refresh",
        target: "jwks",
        result: "failure",
        errorSummary: api.getMediaMtxErrorMessage(error),
      })
    }
  }

  const overview = useMemo(
    () =>
      buildDashboardOverview({
        paths,
        livePaths,
        globalConfig,
        hlsMuxers,
        protocolCounts,
        permissions,
        localConfig: config,
        apiLatencyMs,
        metricsStatus,
        lastConfigUpdateAt,
        bitrate,
      }),
    [
      paths,
      livePaths,
      globalConfig,
      hlsMuxers,
      protocolCounts,
      permissions,
      config,
      apiLatencyMs,
      metricsStatus,
      lastConfigUpdateAt,
      bitrate,
    ],
  )
  const activeStreamsCount = overview.streams.readyPaths
  const totalViewers = overview.streams.totalReaders
  const totalBytesReceived = overview.streams.trafficTotals.bytesReceived
  const totalBytesSent = overview.streams.trafficTotals.bytesSent
  const idleStreamsCount = overview.streams.idlePaths
  const canUseApi = permissions.api !== false
  const canUseMetrics = permissions.metrics !== false
  const canUsePprof = permissions.pprof !== false
  const canPlayback = permissions.playback !== false
  const canPublish = permissions.publish !== false
  const canRead = permissions.read !== false
  const pollingSeconds = Math.round(pollingIntervalMs / 1000)

  const formatMegabytes = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(2)} MB`
  const formatStatus = (status: string) =>
    ({ enabled: "Bật", disabled: "Tắt", unknown: "Không rõ", healthy: "Tốt", degraded: "Suy giảm" })[
      status as "enabled" | "disabled" | "unknown" | "healthy" | "degraded"
    ] || status
  const formatProtocolCount = (count: number | null) => (count === null ? "Không rõ" : count)

  const metricCards = [
    {
      title: "Stream đang chạy",
      value: activeStreamsCount,
      description: `${activeStreamsCount} live, ${idleStreamsCount} đang chờ`,
      icon: Video,
    },
    {
      title: "Tổng người xem",
      value: totalViewers,
      description: "Trên tất cả stream",
      icon: Users,
    },
    {
      title: "Path đã cấu hình",
      value: paths.length,
      description: "Sẵn sàng cho RTSP, RTMP, HLS",
      icon: Globe,
    },
    {
      title: "Trạng thái máy chủ",
      value: dashboardError ? "Lỗi" : "Online",
      description: isPollingEnabled ? `Tự refresh mỗi ${pollingSeconds} giây` : "Đang tạm dừng polling",
      icon: Activity,
      valueClassName: dashboardError ? "text-[#cf202f]" : "text-[#05b169]",
    },
  ]

  const serviceCards = [
    ["API", overview.serviceStatus.api],
    ["Metrics", overview.serviceStatus.metrics],
    ["pprof", overview.serviceStatus.pprof],
    ["Playback", overview.serviceStatus.playback],
    ["RTSP", overview.serviceStatus.rtsp],
    ["RTMP", overview.serviceStatus.rtmp],
    ["HLS", overview.serviceStatus.hls],
    ["WebRTC", overview.serviceStatus.webrtc],
    ["SRT", overview.serviceStatus.srt],
  ] as const

  const protocolReaderCards = [
    ["RTSP", overview.streams.protocolSummary.rtsp],
    ["RTMP", overview.streams.protocolSummary.rtmp],
    ["HLS", overview.streams.protocolSummary.hls],
    ["WebRTC", overview.streams.protocolSummary.webrtc],
    ["SRT", overview.streams.protocolSummary.srt],
  ] as const

  const healthCards = [
    {
      title: "Độ trễ API",
      value: overview.health.apiLatencyMs === null ? "chưa có" : `${overview.health.apiLatencyMs} ms`,
      description: dashboardError ? "Control API suy giảm" : "Lần refresh overview mới nhất",
    },
    {
      title: "Scrape metrics",
      value: formatStatus(overview.health.metricsStatus.status),
      description: overview.health.metricsStatus.message || overview.health.metricsStatus.checkedAt || "Chưa kiểm tra",
    },
    {
      title: "Cập nhật config cuối",
      value: overview.health.lastConfigUpdateAt
        ? new Date(overview.health.lastConfigUpdateAt).toLocaleTimeString()
        : "chưa có",
      description: "Snapshot config backend mới nhất",
    },
    {
      title: "Đồng bộ config",
      value: overview.health.configMismatch ? "Cảnh báo" : "Đã đồng bộ",
      description: overview.health.configMismatch ? "Giá trị UI khác backend" : "UI và backend khớp",
    },
  ]

  const renderStreamRow = (path: PathConfig) => {
    const status = getPathStatus(path.name)

    return (
      <div
        key={path.name}
        className="overflow-hidden rounded-2xl border border-[#dee1e6] bg-white transition-colors hover:border-[#a8b8cc]"
      >
        <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 flex-1 items-start gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#eef0f3]">
              <VideoIcon className="h-5 w-5 text-[#0052ff]" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <SnapshotThumbnail pathName={path.name} />
                <h3 className="truncate text-base font-semibold text-[#0a0b0d]">{path.name}</h3>
                {status.isLive ? (
                  <Badge className="rounded-full bg-[#0a0b0d] px-2.5 text-white hover:bg-[#0a0b0d]">
                    <span className="mr-1.5 h-2 w-2 rounded-full bg-[#05b169]" />
                    LIVE
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="rounded-full px-2.5">
                    Idle
                  </Badge>
                )}
              </div>
              <p className="mt-1 truncate text-sm text-[#5b616e]">{path.source || "No source configured"}</p>
              <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-[#5b616e]">
                <span className="font-mono text-[#0a0b0d]">{status.readers} viewers</span>
                {status.source && <span>Source: {status.source}</span>}
                {status.isLive && (
                  <>
                    <span className="inline-flex items-center gap-1 font-mono">
                      <ArrowDownToLine className="h-3.5 w-3.5 text-[#05b169]" />
                      {formatMegabytes(status.bytesReceived)}
                    </span>
                    <span className="inline-flex items-center gap-1 font-mono">
                      <ArrowUpFromLine className="h-3.5 w-3.5 text-[#0052ff]" />
                      {formatMegabytes(status.bytesSent)}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-auto">
            <Button
              size="icon"
              variant="outline"
              className="rounded-full"
              onClick={() => {
                setSelectedStreamPath(selectedStreamPath === path.name ? null : path.name)
                setSelectedStreamPathWebRTC(null)
              }}
              disabled={!canPlayback}
              title="Preview HLS"
            >
              <Eye className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="outline"
              className="rounded-full"
              onClick={() => {
                setSelectedStreamPathWebRTC(selectedStreamPathWebRTC === path.name ? null : path.name)
                setSelectedStreamPath(null)
              }}
              disabled={!canRead}
              title="Preview WebRTC"
            >
              <Radio className="h-4 w-4" />
            </Button>
            <SnapshotGallery pathName={path.name} />
            <Button
              size="icon"
              variant="outline"
              className="rounded-full"
              onClick={() => handleEditPath(path)}
              disabled={!canUseApi}
              title="Edit path"
            >
              <Edit className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="outline"
              className="rounded-full text-[#cf202f] hover:text-[#cf202f]"
              onClick={() => confirmDelete(path.name)}
              disabled={!canUseApi}
              title="Delete path"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
        {selectedStreamPath === path.name && status.isLive && canPlayback && (
          <div className="border-t border-[#eef0f3] px-4 pb-4 pt-4">
            <StreamPlayer pathName={path.name} />
          </div>
        )}
        {selectedStreamPathWebRTC === path.name && status.isLive && canRead && (
          <div className="border-t border-[#eef0f3] px-4 pb-4 pt-4">
            <WHEPPlayer pathName={path.name} />
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f7f7f7] text-[#0a0b0d]">
      <div className="bg-[#0a0b0d] text-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-10 px-4 py-5 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#0052ff]">
                <Radio className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-semibold tracking-normal">MediaMTX Dashboard</h1>
                <p className="text-sm text-[#a8acb3]">Media streaming server management</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="rounded-full border border-white/10 bg-white/10 text-white hover:bg-white/10">
                <Activity className="mr-1 h-3 w-3 text-[#05b169]" />
                Online
              </Badge>
              <div className="flex items-center gap-2 rounded-full bg-white/10 px-3 py-2">
                <Users className="h-4 w-4 text-[#a8acb3]" />
                <span className="text-sm font-medium text-white">{username}</span>
              </div>
              <Button
                size="sm"
                variant="secondary"
                className="rounded-full bg-[#16181c] text-white hover:bg-[#23262d]"
                onClick={() => setIsHeroSummaryHidden((hidden) => !hidden)}
              >
                {isHeroSummaryHidden ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                {isHeroSummaryHidden ? "Hiện tóm tắt" : "Ẩn tóm tắt"}
              </Button>
              <Button
                size="sm"
                variant="secondary"
                className="rounded-full bg-white text-[#0a0b0d] hover:bg-[#eef0f3]"
                onClick={handleLogout}
              >
                <LogOut className="h-4 w-4" />
                Đăng xuất
              </Button>
            </div>
          </div>

          {!isHeroSummaryHidden && (
            <div className="grid gap-6 pb-8 lg:grid-cols-[1fr_440px] lg:items-stretch">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {metricCards.map((metric) => {
                  const Icon = metric.icon
                  return (
                    <div key={metric.title} className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm text-[#a8acb3]">{metric.title}</p>
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10">
                          <Icon className="h-4 w-4 text-[#0052ff]" />
                        </div>
                      </div>
                      <p className={`mt-5 font-mono text-3xl font-medium ${metric.valueClassName || "text-white"}`}>
                        {metric.value}
                      </p>
                      <p className="mt-1 text-xs text-[#a8acb3]">{metric.description}</p>
                    </div>
                  )
                })}
                <div className="flex flex-wrap gap-3 sm:col-span-2 xl:col-span-4">
                  <Button
                    className="h-11 rounded-full bg-[#0052ff] px-5 text-white hover:bg-[#003ecc]"
                    onClick={() => setIsAddPathDialogOpen(true)}
                    disabled={!canUseApi || !canPublish}
                  >
                    <Plus className="h-4 w-4" />
                    Thêm path
                  </Button>
                  <Button
                    variant="secondary"
                    className="h-11 rounded-full bg-[#16181c] px-5 text-white hover:bg-[#23262d]"
                    onClick={() => polling.refresh().catch(() => undefined)}
                  >
                    <RefreshCw className="h-4 w-4" />
                    Refresh
                  </Button>
                </div>
              </div>

              <div className="rounded-3xl bg-[#16181c] p-5 shadow-2xl shadow-black/30">
                <div className="mb-5 flex items-center justify-between">
                  <div>
                    <p className="text-sm text-[#a8acb3]">Tóm tắt lưu lượng</p>
                    <p className="mt-1 font-mono text-2xl font-medium text-white">{formatMegabytes(totalBytesSent)}</p>
                  </div>
                  <Badge className="rounded-full bg-[#0052ff] text-white hover:bg-[#0052ff]">
                    {isPollingEnabled ? `refresh ${pollingSeconds}s` : "refresh thủ công"}
                  </Badge>
                </div>
                <div className="space-y-3">
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                    <div className="flex items-center justify-between text-sm text-[#a8acb3]">
                      <span>Stream live</span>
                      <span className="font-mono text-white">{activeStreamsCount}/{paths.length}</span>
                    </div>
                    <div className="mt-3 h-2 rounded-full bg-white/10">
                      <div
                        className="h-2 rounded-full bg-[#0052ff]"
                        style={{ width: `${paths.length ? (activeStreamsCount / paths.length) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                      <p className="text-xs text-[#a8acb3]">Đã nhận</p>
                      <p className="mt-2 font-mono text-lg text-white">{formatMegabytes(totalBytesReceived)}</p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                      <p className="text-xs text-[#a8acb3]">Người xem</p>
                      <p className="mt-2 font-mono text-lg text-white">{totalViewers}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <Tabs defaultValue="overview" className="space-y-8">
          <TabsList className="grid h-auto w-full grid-cols-2 gap-2 rounded-full bg-[#eef0f3] p-1 sm:grid-cols-6 lg:grid-cols-11">
            <TabsTrigger value="overview" className="rounded-full py-2 data-[state=active]:bg-white">
              <Monitor className="w-4 h-4" />
              <span>Tổng quan</span>
            </TabsTrigger>
            <TabsTrigger value="server" className="rounded-full py-2 data-[state=active]:bg-white">
              <Server className="w-4 h-4" />
              <span>Máy chủ</span>
            </TabsTrigger>
            <TabsTrigger value="paths" className="rounded-full py-2 data-[state=active]:bg-white">
              <Video className="w-4 h-4" />
              <span>Paths</span>
            </TabsTrigger>
            <TabsTrigger value="live-players" className="rounded-full py-2 data-[state=active]:bg-white">
              <VideoIcon className="w-4 h-4" />
              <span>Live Players</span>
            </TabsTrigger>
            <TabsTrigger value="config" className="rounded-full py-2 data-[state=active]:bg-white">
              <Settings className="w-4 h-4" />
              <span>Cấu hình</span>
            </TabsTrigger>
            <TabsTrigger value="hooks" className="rounded-full py-2 data-[state=active]:bg-white">
              <Code2 className="w-4 h-4" />
              <span>Hooks</span>
            </TabsTrigger>
            <TabsTrigger value="protocols" className="rounded-full py-2 data-[state=active]:bg-white">
              <Radio className="w-4 h-4" />
              <span>Protocols</span>
            </TabsTrigger>
            <TabsTrigger value="auth" className="rounded-full py-2 data-[state=active]:bg-white">
              <Shield className="w-4 h-4" />
              <span>Xác thực</span>
            </TabsTrigger>
            <TabsTrigger value="recording" className="rounded-full py-2 data-[state=active]:bg-white">
              <Play className="w-4 h-4" />
              <span>Ghi hình</span>
            </TabsTrigger>
            <TabsTrigger value="monitoring" className="rounded-full py-2 data-[state=active]:bg-white">
              <Activity className="w-4 h-4" />
              <span>Giám sát</span>
            </TabsTrigger>
            <TabsTrigger value="proxy" className="rounded-full py-2 data-[state=active]:bg-white">
              <Globe className="w-4 h-4" />
              <span>Proxy</span>
            </TabsTrigger>
            <TabsTrigger value="guides" className="rounded-full py-2 data-[state=active]:bg-white">
              <BookOpen className="w-4 h-4" />
              <span>Guides</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
              {metricCards.map((metric) => {
                const Icon = metric.icon
                return (
                  <Card key={metric.title} className="rounded-3xl border-[#dee1e6] bg-white shadow-none">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium text-[#5b616e]">{metric.title}</CardTitle>
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#eef0f3]">
                        <Icon className="h-4 w-4 text-[#0052ff]" />
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className={`font-mono text-3xl font-medium ${metric.valueClassName || "text-[#0a0b0d]"}`}>
                        {metric.value}
                      </div>
                      <p className="mt-1 text-xs text-[#7c828a]">{metric.description}</p>
                    </CardContent>
                  </Card>
                )
              })}
            </div>

            <Card className="rounded-3xl border-[#dee1e6] bg-white shadow-none">
              <CardHeader>
                <CardTitle>Trạng thái dịch vụ máy chủ</CardTitle>
                <CardDescription>Trạng thái thực từ config MediaMTX, URL dịch vụ và quyền hiện tại</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingPaths ? (
                  <LoadingState label="Đang tải trạng thái dịch vụ..." />
                ) : dashboardError ? (
                  <ErrorState message={dashboardError} onRetry={() => polling.refresh().catch(() => undefined)} />
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {serviceCards.map(([name, status]) => (
                      <div key={name} className="flex items-center justify-between rounded-lg border p-3">
                        <span className="font-medium">{name}</span>
                        <Badge
                          variant={status === "enabled" ? "default" : "secondary"}
                          className={status === "unknown" ? "bg-amber-100 text-amber-800 hover:bg-amber-100" : undefined}
                        >
                          {formatStatus(status)}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="grid gap-4 lg:grid-cols-2">
              <Card className="rounded-3xl border-[#dee1e6] bg-white shadow-none">
                <CardHeader>
                  <CardTitle>Tổng quan stream</CardTitle>
                  <CardDescription>Path, protocol, byte và bitrate từ dữ liệu runtime</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-lg border p-3">
                      <p className="text-xs text-muted-foreground">Path đã cấu hình</p>
                      <p className="font-mono text-2xl">{overview.streams.configuredPaths}</p>
                    </div>
                    <div className="rounded-lg border p-3">
                      <p className="text-xs text-muted-foreground">Path ready/live</p>
                      <p className="font-mono text-2xl">{overview.streams.readyPaths}</p>
                    </div>
                    <div className="rounded-lg border p-3">
                      <p className="text-xs text-muted-foreground">Tổng inbound</p>
                      <p className="font-mono text-lg">{formatMegabytes(totalBytesReceived)}</p>
                      <p className="text-xs text-muted-foreground">{formatBitsPerSecond(overview.streams.bitrate.inboundBps)}</p>
                    </div>
                    <div className="rounded-lg border p-3">
                      <p className="text-xs text-muted-foreground">Tổng outbound</p>
                      <p className="font-mono text-lg">{formatMegabytes(totalBytesSent)}</p>
                      <p className="text-xs text-muted-foreground">{formatBitsPerSecond(overview.streams.bitrate.outboundBps)}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                    {protocolReaderCards.map(([name, count]) => (
                      <div key={name} className="rounded-lg border p-2 text-center">
                        <p className="font-mono text-xl">{formatProtocolCount(count)}</p>
                        <p className="text-xs text-muted-foreground">{name}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-3xl border-[#dee1e6] bg-white shadow-none">
                <CardHeader>
                  <CardTitle>Sức khỏe hệ thống</CardTitle>
                  <CardDescription>Kiểm tra vận hành độc lập, không chặn dữ liệu dashboard khác</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-3 sm:grid-cols-2">
                  {healthCards.map((card) => (
                    <div key={card.title} className="rounded-lg border p-3">
                      <p className="text-xs text-muted-foreground">{card.title}</p>
                      <p className="mt-1 font-mono text-lg">{card.value}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{card.description}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>

            <Card className="rounded-3xl border-[#dee1e6] bg-white shadow-none">
              <CardHeader>
                <CardTitle>Thao tác nhanh</CardTitle>
                <CardDescription>Lối tắt theo quyền cho các thao tác dashboard thường dùng</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-3">
                  <Button onClick={() => setIsAddPathDialogOpen(true)} disabled={!canUseApi || !canPublish}>
                  <Plus className="h-4 w-4" />
                  Thêm path
                </Button>
                <Button
                  variant="outline"
                  disabled={!canPlayback || !selectedStreamPath}
                  onClick={() => window.open(buildMediaMtxPlaybackUrl(selectedStreamPath || "stream"), "_blank", "noreferrer")}
                >
                  <Play className="h-4 w-4" />
                  Mở playback
                </Button>
                <Button
                  variant="outline"
                  disabled={!canUseMetrics || overview.serviceStatus.metrics !== "enabled"}
                  onClick={() => window.open(buildMediaMtxMetricsUrl(), "_blank", "noreferrer")}
                >
                  <Activity className="h-4 w-4" />
                  Mở metrics
                </Button>
                <Button variant="secondary" onClick={() => polling.refresh().catch(() => undefined)}>
                  <RefreshCw className="h-4 w-4" />
                  Refresh dữ liệu
                </Button>
              </CardContent>
            </Card>

            <Card className="rounded-3xl border-[#dee1e6] bg-white shadow-none">
              <CardHeader>
                <CardTitle>Stream đang hoạt động</CardTitle>
                <CardDescription>Các path streaming hiện có và trạng thái của chúng</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingPaths ? (
                  <LoadingState label="Đang tải stream..." />
                ) : dashboardError ? (
                  <ErrorState message={dashboardError} onRetry={() => polling.refresh().catch(() => undefined)} />
                ) : !canRead ? (
                  <EmptyState title="Quyền read đang bị tắt" />
                ) : paths.length === 0 ? (
                  <EmptyState
                    icon={<VideoIcon className="h-12 w-12 opacity-50" />}
                    title="Chưa cấu hình path nào"
                    action={
                      canUseApi && canPublish ? (
                        <Button onClick={() => setIsAddPathDialogOpen(true)}>Thêm path đầu tiên</Button>
                      ) : null
                    }
                  />
                ) : (
                  <div className="space-y-4">
                    {paths.map(renderStreamRow)}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="server" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Cài đặt chung</CardTitle>
                  <CardDescription>Cấu hình cơ bản của máy chủ</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="logLevel">Mức log</Label>
                    <Select
                      value={config.logLevel}
                      onValueChange={(value) => setConfig({ ...config, logLevel: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="error">Error</SelectItem>
                        <SelectItem value="warn">Warning</SelectItem>
                        <SelectItem value="info">Info</SelectItem>
                        <SelectItem value="debug">Debug</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="readTimeout">Timeout đọc</Label>
                    <Input id="readTimeout" defaultValue="10s" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="writeTimeout">Timeout ghi</Label>
                    <Input id="writeTimeout" defaultValue="10s" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Cài đặt protocol</CardTitle>
                  <CardDescription>Bật/tắt các protocol streaming</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Máy chủ RTSP</Label>
                      <p className="text-sm text-muted-foreground">Real Time Streaming Protocol</p>
                    </div>
                    <Switch
                      checked={config.rtsp}
                      onCheckedChange={(checked) => setConfig({ ...config, rtsp: checked })}
                    />
                  </div>
                  {config.rtsp && (
                    <div className="space-y-2 ml-4">
                      <Label htmlFor="rtspAddress">Địa chỉ RTSP</Label>
                      <Input
                        id="rtspAddress"
                        value={config.rtspAddress}
                        onChange={(e) => setConfig({ ...config, rtspAddress: e.target.value })}
                      />
                    </div>
                  )}

                  <Separator />

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Máy chủ RTMP</Label>
                      <p className="text-sm text-muted-foreground">Real Time Messaging Protocol</p>
                    </div>
                    <Switch
                      checked={config.rtmp}
                      onCheckedChange={(checked) => setConfig({ ...config, rtmp: checked })}
                    />
                  </div>
                  {config.rtmp && (
                    <div className="space-y-2 ml-4">
                      <Label htmlFor="rtmpAddress">Địa chỉ RTMP</Label>
                      <Input
                        id="rtmpAddress"
                        value={config.rtmpAddress}
                        onChange={(e) => setConfig({ ...config, rtmpAddress: e.target.value })}
                      />
                    </div>
                  )}

                  <Separator />

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Máy chủ HLS</Label>
                      <p className="text-sm text-muted-foreground">HTTP Live Streaming</p>
                    </div>
                    <Switch
                      checked={config.hls}
                      onCheckedChange={(checked) => setConfig({ ...config, hls: checked })}
                    />
                  </div>
                  {config.hls && (
                    <div className="space-y-2 ml-4">
                      <Label htmlFor="hlsAddress">Địa chỉ HLS</Label>
                      <Input
                        id="hlsAddress"
                        value={config.hlsAddress}
                        onChange={(e) => setConfig({ ...config, hlsAddress: e.target.value })}
                      />
                    </div>
                  )}

                  <Separator />

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Máy chủ WebRTC</Label>
                      <p className="text-sm text-muted-foreground">Web Real-Time Communication</p>
                    </div>
                    <Switch
                      checked={config.webrtc}
                      onCheckedChange={(checked) => setConfig({ ...config, webrtc: checked })}
                    />
                  </div>
                  {config.webrtc && (
                    <div className="space-y-2 ml-4">
                      <Label htmlFor="webrtcAddress">Địa chỉ WebRTC</Label>
                      <Input
                        id="webrtcAddress"
                        value={config.webrtcAddress}
                        onChange={(e) => setConfig({ ...config, webrtcAddress: e.target.value })}
                      />
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>API & giám sát</CardTitle>
                <CardDescription>Endpoint Control API và metrics</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Control API</Label>
                        <p className="text-sm text-muted-foreground">Bật REST API</p>
                      </div>
                      <Switch
                        checked={config.api}
                        onCheckedChange={(checked) => setConfig({ ...config, api: checked })}
                      />
                    </div>
                    {config.api && (
                      <div className="space-y-2 ml-4">
                        <Label htmlFor="apiAddress">Địa chỉ API</Label>
                        <Input
                          id="apiAddress"
                          value={config.apiAddress}
                          onChange={(e) => setConfig({ ...config, apiAddress: e.target.value })}
                        />
                      </div>
                    )}
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Metrics</Label>
                        <p className="text-sm text-muted-foreground">Prometheus metrics</p>
                      </div>
                      <Switch
                        checked={config.metrics}
                        onCheckedChange={(checked) => setConfig({ ...config, metrics: checked })}
                      />
                    </div>
                    {config.metrics && (
                      <div className="space-y-2 ml-4">
                        <Label htmlFor="metricsAddress">Địa chỉ Metrics</Label>
                        <Input
                          id="metricsAddress"
                          value={config.metricsAddress}
                          onChange={(e) => setConfig({ ...config, metricsAddress: e.target.value })}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Snapshot Control API</CardTitle>
                <CardDescription>Global configuration và path defaults đã tải từ MediaMTX</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingPaths ? (
                  <LoadingState label="Đang tải cấu hình..." />
                ) : dashboardError ? (
                  <ErrorState message={dashboardError} onRetry={() => polling.refresh().catch(() => undefined)} />
                ) : (
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-lg border p-4">
                      <p className="text-sm font-medium">Global config</p>
                      <p className="mt-2 text-sm text-muted-foreground">
                        Mức log: {String(globalConfig?.logLevel || config.logLevel)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        API: {String(globalConfig?.api ?? config.api)} at {String(globalConfig?.apiAddress || config.apiAddress)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Metrics: {String(globalConfig?.metrics ?? config.metrics)} at{" "}
                        {String(globalConfig?.metricsAddress || config.metricsAddress)}
                      </p>
                    </div>
                    <div className="rounded-lg border p-4">
                      <p className="text-sm font-medium">Path defaults</p>
                      <p className="mt-2 text-sm text-muted-foreground">Source: {pathDefaults?.source || "publisher"}</p>
                      <p className="text-sm text-muted-foreground">Recording: {String(pathDefaults?.record || false)}</p>
                      <p className="text-sm text-muted-foreground">
                        Max readers: {pathDefaults?.maxReaders ?? "không giới hạn"}
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="paths" className="space-y-6">
            <Card className="rounded-3xl border-[#dee1e6] bg-white shadow-none">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Path stream</CardTitle>
                    <CardDescription>Cấu hình path streaming và nguồn phát</CardDescription>
                  </div>
                  <Dialog open={isAddPathDialogOpen} onOpenChange={setIsAddPathDialogOpen}>
                    <DialogTrigger asChild>
                      <Button className="rounded-full bg-[#0052ff] hover:bg-[#003ecc]" disabled={!canUseApi}>
                        <Plus className="w-4 h-4 mr-2" />
                        Thêm path
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>Thêm path mới</DialogTitle>
                        <DialogDescription>Cấu hình một path streaming mới trong MediaMTX</DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label htmlFor="pathName">Tên path *</Label>
                          <Input
                            id="pathName"
                            placeholder="e.g., cam1, camera1"
                            value={newPath.name}
                            onChange={(e) => setNewPath({ ...newPath, name: e.target.value })}
                          />
                          <p className="text-xs text-muted-foreground">Định danh duy nhất cho path này</p>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="source">URL nguồn *</Label>
                          <Input
                            id="source"
                            placeholder="rtsp://admin:password@192.168.50.50"
                            value={newPath.source}
                            onChange={(e) => setNewPath({ ...newPath, source: e.target.value })}
                          />
                          <p className="text-xs text-muted-foreground">
                            URL RTSP, RTMP hoặc HLS. Ví dụ: rtsp://admin:Admin1234@192.168.50.50
                          </p>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="sourceFingerprint">Fingerprint nguồn (tùy chọn)</Label>
                          <Input
                            id="sourceFingerprint"
                            placeholder="SHA-256 fingerprint"
                            value={newPath.sourceFingerprint}
                            onChange={(e) => setNewPath({ ...newPath, sourceFingerprint: e.target.value })}
                          />
                          <p className="text-xs text-muted-foreground">
                            Fingerprint SHA-256 tùy chọn cho nguồn RTSPS
                          </p>
                        </div>

                        <div className="flex items-center space-x-2">
                          <Switch
                            checked={newPath.sourceOnDemand}
                            onCheckedChange={(checked) => setNewPath({ ...newPath, sourceOnDemand: checked })}
                          />
                          <Label>Nguồn theo nhu cầu</Label>
                        </div>
                        <p className="text-xs text-muted-foreground ml-6">
                          Chỉ khởi động nguồn khi có client yêu cầu
                        </p>

                        <Separator />

                        <div className="flex items-center space-x-2">
                          <Switch
                            checked={newPath.record}
                            onCheckedChange={(checked) => setNewPath({ ...newPath, record: checked })}
                          />
                          <Label>Bật ghi hình</Label>
                        </div>

                        {newPath.record && (
                          <>
                            <div className="space-y-2">
                              <Label htmlFor="recordPath">Đường dẫn ghi hình</Label>
                              <Input
                                id="recordPath"
                                value={newPath.recordPath}
                                onChange={(e) => setNewPath({ ...newPath, recordPath: e.target.value })}
                              />
                              <p className="text-xs text-muted-foreground">
                                Biến: %path, %Y %m %d (ngày), %H %M %S (giờ)
                              </p>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label htmlFor="recordFormat">Định dạng</Label>
                                <Select
                                  value={newPath.recordFormat}
                                  onValueChange={(value) => setNewPath({ ...newPath, recordFormat: value })}
                                >
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
                                  value={newPath.recordPartDuration}
                                  onChange={(e) => setNewPath({ ...newPath, recordPartDuration: e.target.value })}
                                />
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label htmlFor="recordSegmentDuration">Thời lượng segment</Label>
                                <Input
                                  id="recordSegmentDuration"
                                  value={newPath.recordSegmentDuration}
                                  onChange={(e) => setNewPath({ ...newPath, recordSegmentDuration: e.target.value })}
                                />
                              </div>

                              <div className="space-y-2">
                                <Label htmlFor="recordDeleteAfter">Xóa sau</Label>
                                <Input
                                  id="recordDeleteAfter"
                                  value={newPath.recordDeleteAfter}
                                  onChange={(e) => setNewPath({ ...newPath, recordDeleteAfter: e.target.value })}
                                />
                              </div>
                            </div>
                          </>
                        )}

                        <Separator />

                        <div className="space-y-2">
                          <Label htmlFor="maxReaders">Số reader tối đa (0 = không giới hạn)</Label>
                          <Input
                            id="maxReaders"
                            type="number"
                            value={newPath.maxReaders}
                            onChange={(e) =>
                              setNewPath({ ...newPath, maxReaders: Number.parseInt(e.target.value) || 0 })
                            }
                          />
                        </div>

                        <div className="flex items-center space-x-2">
                          <Switch
                            checked={newPath.overridePublisher}
                            onCheckedChange={(checked) => setNewPath({ ...newPath, overridePublisher: checked })}
                          />
                          <Label>Cho phép ghi đè publisher</Label>
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setIsAddPathDialogOpen(false)} disabled={isSubmitting}>
                          Hủy
                        </Button>
                        <Button onClick={handleAddPath} disabled={isSubmitting || !canUseApi || !canPublish}>
                          {isSubmitting ? "Đang thêm..." : "Thêm path"}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {isLoadingPaths ? (
                    <LoadingState label="Đang tải path..." />
                  ) : dashboardError ? (
                    <ErrorState message={dashboardError} onRetry={() => polling.refresh().catch(() => undefined)} />
                  ) : !canRead ? (
                    <EmptyState title="Quyền read đang bị tắt" />
                  ) : paths.length === 0 ? (
                    <EmptyState
                      icon={<VideoIcon className="h-12 w-12 opacity-50" />}
                      title="Chưa cấu hình path nào"
                      action={
                        canUseApi && canPublish ? (
                          <Button onClick={() => setIsAddPathDialogOpen(true)}>Thêm path đầu tiên</Button>
                        ) : null
                      }
                    />
                  ) : (
                    paths.map(renderStreamRow)
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="live-players" className="space-y-6">
            <Card className="rounded-3xl border-[#dee1e6] bg-white shadow-none">
              <CardHeader>
                <CardTitle>Live Players</CardTitle>
                <CardDescription>
                  View multiple live streams simultaneously in a configurable grid layout.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <MultiViewPlayer
                  livePaths={livePaths}
                  isWebRTCEnabled={config.webrtc ?? false}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="config" className="space-y-6">
            <GlobalConfigView
              permissions={permissions}
              username={username}
              appendAuditEvent={appendAuditEvent}
            />
          </TabsContent>

          <TabsContent value="hooks" className="space-y-6">
            <HooksView
              permissions={permissions}
              username={username}
              appendAuditEvent={appendAuditEvent}
            />
          </TabsContent>

          <TabsContent value="protocols" className="space-y-6">
            <ProtocolServerManagement
              permissions={permissions}
              username={username}
              paths={paths}
              pathDefaults={pathDefaults}
              appendAuditEvent={appendAuditEvent}
              onChanged={fetchPaths}
            />
          </TabsContent>

          <TabsContent value="auth" className="space-y-6">
            <AuthConfigurationView
              permissions={permissions}
              username={username}
              appendAuditEvent={appendAuditEvent}
            />
          </TabsContent>

          <TabsContent value="recording" className="space-y-6">
            <RecordingSettingsView
              permissions={permissions}
              username={username}
              appendAuditEvent={appendAuditEvent}
            />
            <RecordingStatusView
              permissions={permissions}
              username={username}
              appendAuditEvent={appendAuditEvent}
              pollingRefresh={polling}
            />
            <RemoteUploadConfig
              permissions={permissions}
            />
            <PlaybackView
              permissions={permissions}
              username={username}
              appendAuditEvent={appendAuditEvent}
              pollingRefresh={polling}
            />
          </TabsContent>

          <TabsContent value="monitoring" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Điều khiển refresh</CardTitle>
                <CardDescription>Các màn hình runtime dùng polling có cấu hình và refresh thủ công</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <Switch checked={isPollingEnabled} onCheckedChange={setIsPollingEnabled} />
                  <Label>Bật polling</Label>
                </div>
                <Select value={String(pollingIntervalMs)} onValueChange={(value) => setPollingIntervalMs(Number(value))}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5000">5 giây</SelectItem>
                    <SelectItem value="10000">10 giây</SelectItem>
                    <SelectItem value="30000">30 giây</SelectItem>
                    <SelectItem value="60000">60 giây</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" onClick={() => polling.refresh().catch(() => undefined)}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Refresh ngay
                </Button>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">HLS muxer</CardTitle>
                  <CardDescription>Hoạt động HLS runtime</CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoadingPaths ? (
                    <LoadingState label="Đang tải muxer..." />
                  ) : dashboardError ? (
                    <ErrorState message={dashboardError} onRetry={() => polling.refresh().catch(() => undefined)} />
                  ) : hlsMuxers.length === 0 ? (
                    <EmptyState title="Chưa có HLS muxer" />
                  ) : (
                    <div className="space-y-2">
                      {hlsMuxers.map((muxer) => (
                        <div key={muxer.name} className="rounded-lg border p-3 text-sm">
                          <div className="font-medium">{muxer.name}</div>
                          <div className="text-muted-foreground">{formatMegabytes(muxer.bytesSent || 0)} đã gửi</div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">Tài nguyên protocol</CardTitle>
                  <CardDescription>Connection và session</CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoadingPaths ? (
                    <LoadingState label="Đang tải tài nguyên protocol..." />
                  ) : dashboardError ? (
                    <ErrorState message={dashboardError} onRetry={() => polling.refresh().catch(() => undefined)} />
                  ) : (
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      {Object.entries(protocolCounts).map(([name, count]) => (
                        <div key={name} className="rounded-lg border p-2">
                          <div className="font-mono text-lg">{count}</div>
                          <div className="text-xs text-muted-foreground">{name}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">Metrics</CardTitle>
                  <CardDescription>Endpoint Prometheus</CardDescription>
                </CardHeader>
                <CardContent>
                  {canUseMetrics ? (
                    <Button asChild variant="outline">
                      <a href={buildMediaMtxMetricsUrl()} target="_blank" rel="noreferrer">
                        Mở metrics
                      </a>
                    </Button>
                  ) : (
                    <EmptyState title="Quyền metrics đang bị tắt" />
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">pprof</CardTitle>
                  <CardDescription>Endpoint profiling runtime</CardDescription>
                </CardHeader>
                <CardContent>
                  {canUsePprof ? (
                    <Button asChild variant="outline">
                      <a href={buildMediaMtxPprofUrl()} target="_blank" rel="noreferrer">
                        Mở pprof
                      </a>
                    </Button>
                  ) : (
                    <EmptyState title="Quyền pprof đang bị tắt" />
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">CPU sử dụng</CardTitle>
                  <Activity className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">23%</div>
                  <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                    <div className="bg-blue-600 h-2 rounded-full" style={{ width: "23%" }}></div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Bộ nhớ sử dụng</CardTitle>
                  <Activity className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">1.2GB</div>
                  <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                    <div className="bg-green-600 h-2 rounded-full" style={{ width: "45%" }}></div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Network I/O</CardTitle>
                  <Activity className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">45MB/s</div>
                  <p className="text-xs text-muted-foreground">↑ 25MB/s ↓ 20MB/s</p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>URL dịch vụ</CardTitle>
                <CardDescription>
                  Cấu hình endpoint MediaMTX phía trình duyệt. Proxy Control API phía server vẫn dùng `MEDIAMTX_API_URL`
                  riêng.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  {[
                    ["controlApi", "Control API", "Ví dụ: /api/mediamtx hoặc http://localhost:9997"],
                    ["hls", "HLS", "Ví dụ: http://localhost:8888"],
                    ["playback", "Playback", "Ví dụ: http://localhost:8888"],
                    ["metrics", "Metrics", "Ví dụ: http://localhost:9998"],
                    ["pprof", "pprof", "Ví dụ: http://localhost:9999"],
                  ].map(([key, label, help]) => (
                    <div key={key} className="space-y-2">
                      <Label htmlFor={`service-url-${key}`}>{label}</Label>
                      <Input
                        id={`service-url-${key}`}
                        value={serviceUrlDraft[key as keyof typeof serviceUrlDraft]}
                        onChange={(event) =>
                          setServiceUrlDraft((current) => ({ ...current, [key]: event.target.value }))
                        }
                        className={serviceUrlErrors[key] ? "border-[#cf202f]" : undefined}
                      />
                      <p className="text-xs text-muted-foreground">{help}</p>
                      {serviceUrlErrors[key] && <p className="text-xs text-[#cf202f]">{serviceUrlErrors[key]}</p>}
                    </div>
                  ))}
                </div>
                <div className="grid gap-3 rounded-lg border bg-[#f7f8fa] p-3 text-sm md:grid-cols-2">
                  <div>
                    <div className="font-medium">Control API đã resolve</div>
                    <div className="break-all font-mono text-xs text-muted-foreground">{normalizeMediaMtxApiBaseUrl()}</div>
                  </div>
                  <div>
                    <div className="font-medium">HLS đã resolve</div>
                    <div className="break-all font-mono text-xs text-muted-foreground">{normalizeMediaMtxHlsBaseUrl()}</div>
                  </div>
                  <div>
                    <div className="font-medium">Playback mẫu</div>
                    <div className="break-all font-mono text-xs text-muted-foreground">
                      {buildMediaMtxPlaybackUrl(selectedStreamPath || "stream")}
                    </div>
                  </div>
                  <div>
                    <div className="font-medium">Metrics và pprof đã resolve</div>
                    <div className="break-all font-mono text-xs text-muted-foreground">{buildMediaMtxMetricsUrl()}</div>
                    <div className="break-all font-mono text-xs text-muted-foreground">{buildMediaMtxPprofUrl()}</div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={handleSaveServiceUrls}>Lưu URL dịch vụ</Button>
                  <Button variant="outline" onClick={handleResetServiceUrls}>
                    Đặt lại mặc định
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Log máy chủ</CardTitle>
                <CardDescription>Hoạt động và sự kiện máy chủ gần đây</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-64 w-full border rounded-lg p-4">
                  <div className="space-y-2 text-sm font-mono">
                    <div className="text-blue-600">[INFO] 2024-01-15 14:30:25 - Server started on :8554</div>
                    <div className="text-green-600">[INFO] 2024-01-15 14:30:26 - RTSP server listening on :8554</div>
                    <div className="text-green-600">[INFO] 2024-01-15 14:30:26 - HLS server listening on :8888</div>
                    <div className="text-blue-600">
                      [INFO] 2024-01-15 14:32:15 - New client connected: 192.168.1.100
                    </div>
                    <div className="text-blue-600">[INFO] 2024-01-15 14:32:16 - Stream &apos;camera1&apos; started</div>
                    <div className="text-yellow-600">[WARN] 2024-01-15 14:35:22 - High CPU usage detected: 85%</div>
                    <div className="text-blue-600">
                      [INFO] 2024-01-15 14:40:10 - Recording started for path &apos;camera1&apos;
                    </div>
                    <div className="text-green-600">[INFO] 2024-01-15 14:45:33 - WebRTC connection established</div>
                  </div>
                </ScrollArea>
                <div className="flex justify-between items-center mt-4">
                  <div className="flex items-center space-x-2">
                    <Button size="sm" variant="outline">
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Refresh
                    </Button>
                    <Select defaultValue="info">
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="error">Error</SelectItem>
                        <SelectItem value="warn">Warning</SelectItem>
                        <SelectItem value="info">Info</SelectItem>
                        <SelectItem value="debug">Debug</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button size="sm" variant="outline">
                    Xóa log
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Nhật ký audit</CardTitle>
                <CardDescription>Thao tác quản trị dashboard gần đây</CardDescription>
              </CardHeader>
              <CardContent>
                {auditEvents.length === 0 ? (
                  <EmptyState title="Chưa có bản ghi audit" />
                ) : (
                  <ScrollArea className="h-72 rounded-lg border p-4">
                    <div className="space-y-3">
                      {auditEvents.map((event) => (
                        <div key={event.id} className="rounded-lg border p-3 text-sm">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="font-medium">{event.action}</div>
                            <Badge variant={event.result === "success" ? "default" : "destructive"}>
                              {event.result === "success" ? "Thành công" : "Thất bại"}
                            </Badge>
                          </div>
                          <div className="mt-1 text-muted-foreground">
                            {new Date(event.timestamp).toLocaleString()} bởi {event.actor || "không rõ"} trên {event.target}
                          </div>
                          {event.payloadSummary && (
                            <div className="mt-1 break-all font-mono text-xs text-muted-foreground">
                              {event.payloadSummary}
                            </div>
                          )}
                          {event.errorSummary && <div className="mt-1 text-[#cf202f]">{event.errorSummary}</div>}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Proxy Tab ─────────────────────────────────────────────────────── */}
          <TabsContent value="proxy" className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">Proxy Paths</h2>
                <p className="text-sm text-muted-foreground">
                  Quản lý các path pull từ nguồn upstream qua RTSP, RTMP, HLS, SRT
                </p>
              </div>
              <Button onClick={() => { setProxyNewPathName(""); setProxySource(""); setProxySourceOnDemand(true); setProxySourceOnDemandStartTimeout("10s"); setProxySourceOnDemandCloseAfter("10s"); setProxySourceFingerprint(""); setEditingProxyPath(null); setIsProxyDialogOpen(true); }}>
                <Globe className="w-4 h-4 mr-2" />
                Thêm Proxy Path
              </Button>
            </div>

            <Card>
              <CardContent className="p-6">
                {paths.filter((p) => isUpstreamSourceUrl(p.source)).length === 0 ? (
                  <div className="text-center py-12">
                    <Globe className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
                    <h3 className="text-lg font-medium mb-1">Chưa có proxy path nào</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Thêm path mới kết nối tới nguồn upstream từ RTSP camera, HLS playlist, RTMP server...
                    </p>
                    <Button variant="outline" onClick={() => { setProxyNewPathName(""); setProxySource(""); setProxySourceOnDemand(true); setProxySourceOnDemandStartTimeout("10s"); setProxySourceOnDemandCloseAfter("10s"); setProxySourceFingerprint(""); setEditingProxyPath(null); setIsProxyDialogOpen(true); }}>
                      <Plus className="w-4 h-4 mr-2" />
                      Tạo proxy path
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {paths
                      .filter((p) => isUpstreamSourceUrl(p.source))
                      .sort((a, b) => (a.name || "").localeCompare(b.name || ""))
                      .map((proxyPath) => {
                        const livePath = livePaths.find((lp) => lp.name === proxyPath.name)
                        const isOnline = livePath?.readers && livePath.readers.length > 0
                        return (
                          <div
                            key={proxyPath.name}
                            className="flex items-center justify-between rounded-lg border p-4"
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className={`w-2 h-2 rounded-full ${isOnline ? "bg-green-500" : "bg-gray-300"}`} />
                                <span className="font-medium truncate">{proxyPath.name}</span>
                                {proxyPath.sourceOnDemand && (
                                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                    On Demand
                                  </Badge>
                                )}
                              </div>
                              <code className="mt-1 block text-xs text-muted-foreground truncate">
                                {proxyPath.source}
                              </code>
                            </div>
                            <div className="flex items-center gap-1 ml-4 shrink-0">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8"
                                onClick={() => {
                                  setEditingProxyPath(proxyPath)
                                  setProxyNewPathName(proxyPath.name)
                                  setProxySource(proxyPath.source || "")
                                  setProxySourceOnDemand(proxyPath.sourceOnDemand ?? true)
                                  setProxySourceOnDemandStartTimeout(proxyPath.sourceOnDemandStartTimeout || "10s")
                                  setProxySourceOnDemandCloseAfter(proxyPath.sourceOnDemandCloseAfter || "10s")
                                  setProxySourceFingerprint(proxyPath.sourceFingerprint || "")
                                  setIsProxyDialogOpen(true)
                                }}
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 text-[#cf202f]"
                                onClick={async () => {
                                  try {
                                    requireMediaMtxAction(permissions, "api")
                                    await api.deletePath(proxyPath.name)
                                    await fetchPaths()
                                    notify({ type: "success", title: `Đã xóa proxy path "${proxyPath.name}"` })
                                  } catch (err) {
                                    notifyError("Không thể xóa proxy path", err)
                                  }
                                }}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        )
                      })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="guides" className="space-y-6">
            <GuidesView pathSuggestions={paths.map((p) => p.name).filter(Boolean) as string[]} />
          </TabsContent>
        </Tabs>
      </div>

      {/* ── Proxy Dialog ──────────────────────────────────────────────────────── */}
      <Dialog open={isProxyDialogOpen} onOpenChange={setIsProxyDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingProxyPath ? `Chỉnh sửa proxy: ${editingProxyPath.name}` : "Thêm proxy path mới"}</DialogTitle>
            <DialogDescription>
              Cấu hình path để pull luồng từ nguồn upstream bên ngoài
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="proxyPathName">Tên path</Label>
              <Input
                id="proxyPathName"
                placeholder="e.g., camera/hallway"
                value={proxyNewPathName}
                onChange={(e) => setProxyNewPathName(e.target.value)}
                disabled={!!editingProxyPath}
              />
            </div>
            <ProxyConfig
              source={proxySource}
              sourceOnDemand={proxySourceOnDemand}
              sourceOnDemandStartTimeout={proxySourceOnDemandStartTimeout}
              sourceOnDemandCloseAfter={proxySourceOnDemandCloseAfter}
              sourceFingerprint={proxySourceFingerprint}
              pathName={proxyNewPathName}
              onSourceChange={setProxySource}
              onSourceOnDemandChange={setProxySourceOnDemand}
              onSourceOnDemandStartTimeoutChange={setProxySourceOnDemandStartTimeout}
              onSourceOnDemandCloseAfterChange={setProxySourceOnDemandCloseAfter}
              onSourceFingerprintChange={setProxySourceFingerprint}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsProxyDialogOpen(false)}>
              Hủy
            </Button>
            <Button onClick={handleSaveProxyPath} disabled={!proxyNewPathName.trim() || !proxySource.trim()}>
              {editingProxyPath ? "Cập nhật" : "Tạo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Sửa path: {editingPath?.name}</DialogTitle>
            <DialogDescription>Cập nhật cấu hình cho path streaming này</DialogDescription>
          </DialogHeader>
          {editingPath && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Tên path</Label>
                <div className="flex items-center gap-2">
                  <Input value={editingPath.name} disabled className="flex-1" />
                  {(editingPath.runOnInit || editingPath.runOnDemand) && (
                    <CommandLifecycleBadge
                      config={editingPath}
                      runtime={livePaths.find((lp: LivePath) => lp.name === editingPath.name) || null}
                    />
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="editSource">URL nguồn</Label>
                <Input
                  id="editSource"
                  value={editingPath.source}
                  onChange={(e) => setEditingPath({ ...editingPath, source: e.target.value })}
                />
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  checked={editingPath.sourceOnDemand}
                  onCheckedChange={(checked) => setEditingPath({ ...editingPath, sourceOnDemand: checked })}
                />
                <Label>Nguồn theo nhu cầu</Label>
              </div>

              <Separator />

              <div className="flex items-center space-x-2">
                <Switch
                  checked={editingPath.record}
                  onCheckedChange={(checked) => setEditingPath({ ...editingPath, record: checked })}
                />
                <Label>Bật ghi hình</Label>
              </div>

              {editingPath.record && (
                <div className="space-y-4 ml-6">
                  <div className="space-y-2">
                    <Label>Đường dẫn ghi hình</Label>
                    <Input
                      value={editingPath.recordPath || ""}
                      onChange={(e) => setEditingPath({ ...editingPath, recordPath: e.target.value })}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Định dạng</Label>
                      <Select
                        value={editingPath.recordFormat}
                        onValueChange={(value) => setEditingPath({ ...editingPath, recordFormat: value })}
                      >
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
                      <Label>Thời lượng segment</Label>
                      <Input
                        value={editingPath.recordSegmentDuration || ""}
                        onChange={(e) => setEditingPath({ ...editingPath, recordSegmentDuration: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
              )}

              <Separator />

              <SnapshotConfig
                value={editingPath.runOnReady || ""}
                onChange={(cmd) => setEditingPath({ ...editingPath, runOnReady: cmd, runOnReadyRestart: cmd.length > 0 })}
                pathName={editingPath.name}
              />

              <Separator className="my-2" />

              <ReEncodingConfig
                command={editingPath.runOnReady || ""}
                restart={editingPath.runOnReadyRestart ?? false}
                onCommandChange={(cmd) => setEditingPath({ ...editingPath, runOnReady: cmd })}
                onRestartChange={(restart) => setEditingPath({ ...editingPath, runOnReadyRestart: restart })}
                pathName={editingPath.name}
              />
              {editingPath.runOnReady && editingPath.runOnReady.length > 0 && (
                <p className="text-xs text-amber-600">
                  Lưu ý: Snapshot và Re-Encoding cùng dùng hook runOnReady. Chỉ một lệnh được chạy. 
                  Bạn có thể dùng runOnInit hoặc runOnDemand cho một trong hai nếu cần chạy đồng thời.
                </p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)} disabled={isSubmitting}>
              Hủy
            </Button>
            <Button onClick={handleUpdatePath} disabled={isSubmitting}>
              {isSubmitting ? "Đang cập nhật..." : "Cập nhật path"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Xóa path</DialogTitle>
            <DialogDescription>
              Bạn có chắc muốn xóa path &quot;{pathToDelete}&quot;? Thao tác này không thể hoàn tác.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)} disabled={isSubmitting}>
              Hủy
            </Button>
            <Button variant="destructive" onClick={handleDeletePath} disabled={isSubmitting}>
              {isSubmitting ? "Đang xóa..." : "Xóa"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default function Page() {
  return (
    <ProtectedRoute>
      <MediaMTXDashboard />
    </ProtectedRoute>
  )
}
