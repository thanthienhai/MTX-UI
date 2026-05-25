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
} from "lucide-react"
import { ProtectedRoute } from "@/components/protected-route"
import { clearAuth, getDashboardSession, getSessionPermissions, getUsername } from "@/lib/auth"
import { StreamPlayer } from "@/components/stream-player"
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
  normalizeMediaMtxApiBaseUrl,
  normalizeMediaMtxHlsBaseUrl,
} from "@/lib/mediamtx-url.mjs"
import { useRefreshPolling } from "@/hooks/use-refresh-polling"
import { GlobalConfigView } from "@/components/global-config-view"
import type { GlobalConf, HLSMuxer, PathConfig, Path as LivePath, Recording } from "@/lib/mediamtx-api"
import {
  buildDashboardOverview,
  calculateBitrate,
  formatBitsPerSecond,
  getTrafficTotals,
} from "@/lib/dashboard-overview.mjs"

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

  const [paths, setPaths] = useState<PathConfig[]>([])
  const [livePaths, setLivePaths] = useState<LivePath[]>([])
  const [isLoadingPaths, setIsLoadingPaths] = useState(false)
  const [dashboardError, setDashboardError] = useState<string | null>(null)
  const [globalConfig, setGlobalConfig] = useState<GlobalConf | null>(null)
  const [pathDefaults, setPathDefaults] = useState<PathConfig | null>(null)
  const [hlsMuxers, setHlsMuxers] = useState<HLSMuxer[]>([])
  const [recordings, setRecordings] = useState<Recording[]>([])
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
  const previousTrafficSampleRef = useRef<{ timestamp: number; bytesReceived: number; bytesSent: number } | null>(null)

  useEffect(() => {
    const events = loadAuditEvents()
    setAuditEvents(events)
    setPermissions(getSessionPermissions(getDashboardSession()))
  }, [])

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
      const [configs, live, global, defaults, muxers, recordingList, ...protocolLists] = await Promise.all([
        api.getPathConfigs(),
        api.getPaths(),
        api.getGlobalConfig(),
        api.getPathDefaults(),
        api.getHlsMuxers(),
        api.getRecordings(),
        api.rtspConnections.list(),
        api.rtspSessions.list(),
        api.rtspsConnections.list(),
        api.rtspsSessions.list(),
        api.rtmpConnections.list(),
        api.rtmpsConnections.list(),
        api.srtConnections.list(),
        api.webrtcSessions.list(),
      ])
      setPaths(configs.filter((p) => p.name !== "all_others"))
      setLivePaths(live)
      setGlobalConfig(global)
      setPathDefaults(defaults)
      setHlsMuxers(muxers)
      setRecordings(recordingList)
      setApiLatencyMs(Math.round(performance.now() - startedAt))
      setLastConfigUpdateAt(new Date().toISOString())
      setProtocolCounts({
        rtspConnections: protocolLists[0]?.length || 0,
        rtspSessions: protocolLists[1]?.length || 0,
        rtspsConnections: protocolLists[2]?.length || 0,
        rtspsSessions: protocolLists[3]?.length || 0,
        rtmpConnections: protocolLists[4]?.length || 0,
        rtmpsConnections: protocolLists[5]?.length || 0,
        srtConnections: protocolLists[6]?.length || 0,
        webrtcSessions: protocolLists[7]?.length || 0,
      })
      const trafficTotals = getTrafficTotals(live, muxers, protocolLists)
      const currentSample = { timestamp: Date.now(), ...trafficTotals }
      const nextBitrate = calculateBitrate(previousTrafficSampleRef.current, currentSample)
      setBitrate({ inboundBps: nextBitrate.inboundBps, outboundBps: nextBitrate.outboundBps })
      previousTrafficSampleRef.current = currentSample

      if (permissions.metrics === false || global.metrics === false) {
        setMetricsStatus({ status: "disabled", checkedAt: new Date().toISOString() })
      } else {
        const metricsStartedAt = performance.now()
        try {
          const response = await fetch(buildMediaMtxMetricsUrl(), { cache: "no-store" })
          setMetricsStatus({
            status: response.ok ? "healthy" : "degraded",
            latencyMs: Math.round(performance.now() - metricsStartedAt),
            checkedAt: new Date().toISOString(),
            message: response.ok ? undefined : `Metrics returned ${response.status}`,
          })
        } catch (error) {
          setMetricsStatus({
            status: "degraded",
            checkedAt: new Date().toISOString(),
            message: error instanceof Error ? error.message : "Metrics scrape failed",
          })
        }
      }
    } catch (error) {
      console.error("Error fetching paths:", error)
      const message = api.getMediaMtxErrorMessage(error)
      setDashboardError(message)
      notify({ type: "error", title: "Failed to load MediaMTX data", message })
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
      notify({ type: "success", title: "Path updated", message: editingPath.name })
      appendAuditEvent({
        actor: username,
        action: "path.update",
        target: editingPath.name,
        payloadSummary: JSON.stringify({ source: editingPath.source, record: editingPath.record }),
        result: "success",
      })
    } catch (error) {
      console.error("Error updating path:", error)
      notifyError("Failed to update path", error)
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
      notify({ type: "success", title: "Path deleted", message: pathToDelete })
      appendAuditEvent({
        actor: username,
        action: "path.delete",
        target: pathToDelete,
        result: "success",
      })
    } catch (error) {
      console.error("Error deleting path:", error)
      notifyError("Failed to delete path", error)
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

  const handleAddPath = async () => {
    if (!newPath.name) {
      notify({ type: "error", title: "Path name is required" })
      return
    }

    if (!newPath.source) {
      notify({ type: "error", title: "Source URL is required" })
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
      notify({ type: "success", title: "Path added", message: newPath.name })
      appendAuditEvent({
        actor: username,
        action: "path.add",
        target: newPath.name,
        payloadSummary: JSON.stringify({ source: newPath.source, record: newPath.record }),
        result: "success",
      })
    } catch (error) {
      console.error("Error adding path:", error)
      notifyError("Failed to add path", error)
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

  const handleRefreshJwks = async () => {
    try {
      requireMediaMtxAction(permissions, "api")
      await api.refreshJwks()
      notify({ type: "success", title: "JWKS refreshed" })
      appendAuditEvent({ actor: username, action: "auth.jwks.refresh", target: "jwks", result: "success" })
    } catch (error) {
      notifyError("Failed to refresh JWKS", error)
      appendAuditEvent({
        actor: username,
        action: "auth.jwks.refresh",
        target: "jwks",
        result: "failure",
        errorSummary: api.getMediaMtxErrorMessage(error),
      })
    }
  }

  const handleDeleteRecordingSegment = async (path: string, start: string) => {
    try {
      requireMediaMtxAction(permissions, "api")
      requireMediaMtxAction(permissions, "read")
      await api.deleteRecordingSegment({ path, start })
      await fetchPaths()
      notify({ type: "success", title: "Recording segment deleted", message: path })
      appendAuditEvent({
        actor: username,
        action: "recording.segment.delete",
        target: path,
        payloadSummary: JSON.stringify({ start }),
        result: "success",
      })
    } catch (error) {
      notifyError("Failed to delete recording segment", error)
      appendAuditEvent({
        actor: username,
        action: "recording.segment.delete",
        target: path,
        payloadSummary: JSON.stringify({ start }),
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
  const formatStatus = (status: string) => status.charAt(0).toUpperCase() + status.slice(1)

  const metricCards = [
    {
      title: "Active Streams",
      value: activeStreamsCount,
      description: `${activeStreamsCount} live, ${idleStreamsCount} idle`,
      icon: Video,
    },
    {
      title: "Total Viewers",
      value: totalViewers,
      description: "Across all streams",
      icon: Users,
    },
    {
      title: "Configured Paths",
      value: paths.length,
      description: "Ready for RTSP, RTMP, HLS",
      icon: Globe,
    },
    {
      title: "Server Status",
      value: dashboardError ? "Error" : "Online",
      description: isPollingEnabled ? `Polling every ${pollingSeconds} seconds` : "Polling paused",
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
      title: "API latency",
      value: overview.health.apiLatencyMs === null ? "n/a" : `${overview.health.apiLatencyMs} ms`,
      description: dashboardError ? "Control API degraded" : "Latest overview refresh",
    },
    {
      title: "Metrics scrape",
      value: formatStatus(overview.health.metricsStatus.status),
      description: overview.health.metricsStatus.message || overview.health.metricsStatus.checkedAt || "Not checked",
    },
    {
      title: "Last config update",
      value: overview.health.lastConfigUpdateAt
        ? new Date(overview.health.lastConfigUpdateAt).toLocaleTimeString()
        : "n/a",
      description: "Latest backend config snapshot",
    },
    {
      title: "Config sync",
      value: overview.health.configMismatch ? "Warning" : "Synced",
      description: overview.health.configMismatch ? "UI values differ from backend" : "UI and backend match",
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
              onClick={() => setSelectedStreamPath(selectedStreamPath === path.name ? null : path.name)}
              disabled={!canPlayback}
              title="Preview stream"
            >
              <Eye className="h-4 w-4" />
            </Button>
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
                {isHeroSummaryHidden ? "Show summary" : "Hide summary"}
              </Button>
              <Button
                size="sm"
                variant="secondary"
                className="rounded-full bg-white text-[#0a0b0d] hover:bg-[#eef0f3]"
                onClick={handleLogout}
              >
                <LogOut className="h-4 w-4" />
                Logout
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
                    Add Path
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
                    <p className="text-sm text-[#a8acb3]">Traffic summary</p>
                    <p className="mt-1 font-mono text-2xl font-medium text-white">{formatMegabytes(totalBytesSent)}</p>
                  </div>
                  <Badge className="rounded-full bg-[#0052ff] text-white hover:bg-[#0052ff]">
                    {isPollingEnabled ? `${pollingSeconds}s refresh` : "manual refresh"}
                  </Badge>
                </div>
                <div className="space-y-3">
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                    <div className="flex items-center justify-between text-sm text-[#a8acb3]">
                      <span>Live streams</span>
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
                      <p className="text-xs text-[#a8acb3]">Received</p>
                      <p className="mt-2 font-mono text-lg text-white">{formatMegabytes(totalBytesReceived)}</p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                      <p className="text-xs text-[#a8acb3]">Viewers</p>
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
          <TabsList className="grid h-auto w-full grid-cols-2 gap-2 rounded-full bg-[#eef0f3] p-1 sm:grid-cols-4 lg:grid-cols-7">
            <TabsTrigger value="overview" className="rounded-full py-2 data-[state=active]:bg-white">
              <Monitor className="w-4 h-4" />
              <span>Overview</span>
            </TabsTrigger>
            <TabsTrigger value="server" className="rounded-full py-2 data-[state=active]:bg-white">
              <Server className="w-4 h-4" />
              <span>Server</span>
            </TabsTrigger>
            <TabsTrigger value="paths" className="rounded-full py-2 data-[state=active]:bg-white">
              <Video className="w-4 h-4" />
              <span>Paths</span>
            </TabsTrigger>
            <TabsTrigger value="config" className="rounded-full py-2 data-[state=active]:bg-white">
              <Settings className="w-4 h-4" />
              <span>Configuration</span>
            </TabsTrigger>
            <TabsTrigger value="auth" className="rounded-full py-2 data-[state=active]:bg-white">
              <Shield className="w-4 h-4" />
              <span>Auth</span>
            </TabsTrigger>
            <TabsTrigger value="recording" className="rounded-full py-2 data-[state=active]:bg-white">
              <Play className="w-4 h-4" />
              <span>Recording</span>
            </TabsTrigger>
            <TabsTrigger value="monitoring" className="rounded-full py-2 data-[state=active]:bg-white">
              <Activity className="w-4 h-4" />
              <span>Monitoring</span>
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
                <CardTitle>Server Service Status</CardTitle>
                <CardDescription>Live capability status from MediaMTX config, service URLs, and permissions</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingPaths ? (
                  <LoadingState label="Loading service status..." />
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
                  <CardTitle>Stream Summary</CardTitle>
                  <CardDescription>Path, protocol, byte, and bitrate totals from runtime data</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-lg border p-3">
                      <p className="text-xs text-muted-foreground">Configured paths</p>
                      <p className="font-mono text-2xl">{overview.streams.configuredPaths}</p>
                    </div>
                    <div className="rounded-lg border p-3">
                      <p className="text-xs text-muted-foreground">Ready/live paths</p>
                      <p className="font-mono text-2xl">{overview.streams.readyPaths}</p>
                    </div>
                    <div className="rounded-lg border p-3">
                      <p className="text-xs text-muted-foreground">Inbound total</p>
                      <p className="font-mono text-lg">{formatMegabytes(totalBytesReceived)}</p>
                      <p className="text-xs text-muted-foreground">{formatBitsPerSecond(overview.streams.bitrate.inboundBps)}</p>
                    </div>
                    <div className="rounded-lg border p-3">
                      <p className="text-xs text-muted-foreground">Outbound total</p>
                      <p className="font-mono text-lg">{formatMegabytes(totalBytesSent)}</p>
                      <p className="text-xs text-muted-foreground">{formatBitsPerSecond(overview.streams.bitrate.outboundBps)}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                    {protocolReaderCards.map(([name, count]) => (
                      <div key={name} className="rounded-lg border p-2 text-center">
                        <p className="font-mono text-xl">{count}</p>
                        <p className="text-xs text-muted-foreground">{name}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-3xl border-[#dee1e6] bg-white shadow-none">
                <CardHeader>
                  <CardTitle>Health</CardTitle>
                  <CardDescription>Operational checks that do not block unrelated dashboard data</CardDescription>
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
                <CardTitle>Quick Actions</CardTitle>
                <CardDescription>Permission-aware shortcuts for common dashboard operations</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-3">
                  <Button onClick={() => setIsAddPathDialogOpen(true)} disabled={!canUseApi || !canPublish}>
                  <Plus className="h-4 w-4" />
                  Add path
                </Button>
                <Button
                  variant="outline"
                  disabled={!canPlayback || !selectedStreamPath}
                  onClick={() => window.open(buildMediaMtxPlaybackUrl(selectedStreamPath || "stream"), "_blank", "noreferrer")}
                >
                  <Play className="h-4 w-4" />
                  Open playback
                </Button>
                <Button
                  variant="outline"
                  disabled={!canUseMetrics || overview.serviceStatus.metrics !== "enabled"}
                  onClick={() => window.open(buildMediaMtxMetricsUrl(), "_blank", "noreferrer")}
                >
                  <Activity className="h-4 w-4" />
                  Open metrics
                </Button>
                <Button variant="secondary" onClick={() => polling.refresh().catch(() => undefined)}>
                  <RefreshCw className="h-4 w-4" />
                  Refresh data
                </Button>
              </CardContent>
            </Card>

            <Card className="rounded-3xl border-[#dee1e6] bg-white shadow-none">
              <CardHeader>
                <CardTitle>Active Streams</CardTitle>
                <CardDescription>Currently active streaming paths and their status</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingPaths ? (
                  <LoadingState label="Loading streams..." />
                ) : dashboardError ? (
                  <ErrorState message={dashboardError} onRetry={() => polling.refresh().catch(() => undefined)} />
                ) : !canRead ? (
                  <EmptyState title="Read permission disabled" />
                ) : paths.length === 0 ? (
                  <EmptyState
                    icon={<VideoIcon className="h-12 w-12 opacity-50" />}
                    title="No paths configured"
                    action={
                      canUseApi && canPublish ? (
                        <Button onClick={() => setIsAddPathDialogOpen(true)}>Add Your First Path</Button>
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
                  <CardTitle>General Settings</CardTitle>
                  <CardDescription>Basic server configuration</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="logLevel">Log Level</Label>
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
                    <Label htmlFor="readTimeout">Read Timeout</Label>
                    <Input id="readTimeout" defaultValue="10s" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="writeTimeout">Write Timeout</Label>
                    <Input id="writeTimeout" defaultValue="10s" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Protocol Settings</CardTitle>
                  <CardDescription>Enable/disable streaming protocols</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>RTSP Server</Label>
                      <p className="text-sm text-muted-foreground">Real Time Streaming Protocol</p>
                    </div>
                    <Switch
                      checked={config.rtsp}
                      onCheckedChange={(checked) => setConfig({ ...config, rtsp: checked })}
                    />
                  </div>
                  {config.rtsp && (
                    <div className="space-y-2 ml-4">
                      <Label htmlFor="rtspAddress">RTSP Address</Label>
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
                      <Label>RTMP Server</Label>
                      <p className="text-sm text-muted-foreground">Real Time Messaging Protocol</p>
                    </div>
                    <Switch
                      checked={config.rtmp}
                      onCheckedChange={(checked) => setConfig({ ...config, rtmp: checked })}
                    />
                  </div>
                  {config.rtmp && (
                    <div className="space-y-2 ml-4">
                      <Label htmlFor="rtmpAddress">RTMP Address</Label>
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
                      <Label>HLS Server</Label>
                      <p className="text-sm text-muted-foreground">HTTP Live Streaming</p>
                    </div>
                    <Switch
                      checked={config.hls}
                      onCheckedChange={(checked) => setConfig({ ...config, hls: checked })}
                    />
                  </div>
                  {config.hls && (
                    <div className="space-y-2 ml-4">
                      <Label htmlFor="hlsAddress">HLS Address</Label>
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
                      <Label>WebRTC Server</Label>
                      <p className="text-sm text-muted-foreground">Web Real-Time Communication</p>
                    </div>
                    <Switch
                      checked={config.webrtc}
                      onCheckedChange={(checked) => setConfig({ ...config, webrtc: checked })}
                    />
                  </div>
                  {config.webrtc && (
                    <div className="space-y-2 ml-4">
                      <Label htmlFor="webrtcAddress">WebRTC Address</Label>
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
                <CardTitle>API & Monitoring</CardTitle>
                <CardDescription>Control API and metrics endpoints</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Control API</Label>
                        <p className="text-sm text-muted-foreground">Enable REST API</p>
                      </div>
                      <Switch
                        checked={config.api}
                        onCheckedChange={(checked) => setConfig({ ...config, api: checked })}
                      />
                    </div>
                    {config.api && (
                      <div className="space-y-2 ml-4">
                        <Label htmlFor="apiAddress">API Address</Label>
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
                        <Label htmlFor="metricsAddress">Metrics Address</Label>
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
                <CardTitle>Control API Snapshot</CardTitle>
                <CardDescription>Global configuration and path defaults loaded from MediaMTX</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingPaths ? (
                  <LoadingState label="Loading configuration..." />
                ) : dashboardError ? (
                  <ErrorState message={dashboardError} onRetry={() => polling.refresh().catch(() => undefined)} />
                ) : (
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-lg border p-4">
                      <p className="text-sm font-medium">Global config</p>
                      <p className="mt-2 text-sm text-muted-foreground">
                        Log level: {String(globalConfig?.logLevel || config.logLevel)}
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
                        Max readers: {pathDefaults?.maxReaders ?? "unlimited"}
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
                    <CardTitle>Stream Paths</CardTitle>
                    <CardDescription>Configure streaming paths and sources</CardDescription>
                  </div>
                  <Dialog open={isAddPathDialogOpen} onOpenChange={setIsAddPathDialogOpen}>
                    <DialogTrigger asChild>
                      <Button className="rounded-full bg-[#0052ff] hover:bg-[#003ecc]" disabled={!canUseApi}>
                        <Plus className="w-4 h-4 mr-2" />
                        Add Path
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>Add New Path</DialogTitle>
                        <DialogDescription>Configure a new streaming path in MediaMTX</DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label htmlFor="pathName">Path Name *</Label>
                          <Input
                            id="pathName"
                            placeholder="e.g., cam1, camera1"
                            value={newPath.name}
                            onChange={(e) => setNewPath({ ...newPath, name: e.target.value })}
                          />
                          <p className="text-xs text-muted-foreground">Unique identifier for this path</p>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="source">Source URL *</Label>
                          <Input
                            id="source"
                            placeholder="rtsp://admin:password@192.168.50.50"
                            value={newPath.source}
                            onChange={(e) => setNewPath({ ...newPath, source: e.target.value })}
                          />
                          <p className="text-xs text-muted-foreground">
                            RTSP, RTMP, or HLS URL. Example: rtsp://admin:Admin1234@192.168.50.50
                          </p>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="sourceFingerprint">Source Fingerprint (Optional)</Label>
                          <Input
                            id="sourceFingerprint"
                            placeholder="SHA-256 fingerprint"
                            value={newPath.sourceFingerprint}
                            onChange={(e) => setNewPath({ ...newPath, sourceFingerprint: e.target.value })}
                          />
                          <p className="text-xs text-muted-foreground">
                            Optional SHA-256 fingerprint for RTSPS sources
                          </p>
                        </div>

                        <div className="flex items-center space-x-2">
                          <Switch
                            checked={newPath.sourceOnDemand}
                            onCheckedChange={(checked) => setNewPath({ ...newPath, sourceOnDemand: checked })}
                          />
                          <Label>Source On Demand</Label>
                        </div>
                        <p className="text-xs text-muted-foreground ml-6">
                          Start source only when requested by a client
                        </p>

                        <Separator />

                        <div className="flex items-center space-x-2">
                          <Switch
                            checked={newPath.record}
                            onCheckedChange={(checked) => setNewPath({ ...newPath, record: checked })}
                          />
                          <Label>Enable Recording</Label>
                        </div>

                        {newPath.record && (
                          <>
                            <div className="space-y-2">
                              <Label htmlFor="recordPath">Recording Path</Label>
                              <Input
                                id="recordPath"
                                value={newPath.recordPath}
                                onChange={(e) => setNewPath({ ...newPath, recordPath: e.target.value })}
                              />
                              <p className="text-xs text-muted-foreground">
                                Variables: %path, %Y %m %d (date), %H %M %S (time)
                              </p>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label htmlFor="recordFormat">Format</Label>
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
                                <Label htmlFor="recordPartDuration">Part Duration</Label>
                                <Input
                                  id="recordPartDuration"
                                  value={newPath.recordPartDuration}
                                  onChange={(e) => setNewPath({ ...newPath, recordPartDuration: e.target.value })}
                                />
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label htmlFor="recordSegmentDuration">Segment Duration</Label>
                                <Input
                                  id="recordSegmentDuration"
                                  value={newPath.recordSegmentDuration}
                                  onChange={(e) => setNewPath({ ...newPath, recordSegmentDuration: e.target.value })}
                                />
                              </div>

                              <div className="space-y-2">
                                <Label htmlFor="recordDeleteAfter">Delete After</Label>
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
                          <Label htmlFor="maxReaders">Max Readers (0 = unlimited)</Label>
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
                          <Label>Override Publisher</Label>
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setIsAddPathDialogOpen(false)} disabled={isSubmitting}>
                          Cancel
                        </Button>
                        <Button onClick={handleAddPath} disabled={isSubmitting || !canUseApi || !canPublish}>
                          {isSubmitting ? "Adding..." : "Add Path"}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {isLoadingPaths ? (
                    <LoadingState label="Loading paths..." />
                  ) : dashboardError ? (
                    <ErrorState message={dashboardError} onRetry={() => polling.refresh().catch(() => undefined)} />
                  ) : !canRead ? (
                    <EmptyState title="Read permission disabled" />
                  ) : paths.length === 0 ? (
                    <EmptyState
                      icon={<VideoIcon className="h-12 w-12 opacity-50" />}
                      title="No paths configured"
                      action={
                        canUseApi && canPublish ? (
                          <Button onClick={() => setIsAddPathDialogOpen(true)}>Add Your First Path</Button>
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

          <TabsContent value="config" className="space-y-6">
            <GlobalConfigView
              permissions={permissions}
              username={username}
              appendAuditEvent={appendAuditEvent}
            />
          </TabsContent>

          <TabsContent value="auth" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Current Session Permissions</CardTitle>
                <CardDescription>Effective MediaMTX action categories resolved for this dashboard session</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-3">
                {(["api", "metrics", "pprof", "publish", "read", "playback"] as const).map((action) => (
                  <div key={action} className="flex items-center justify-between rounded-lg border p-3">
                    <Label className="font-mono text-sm">{action}</Label>
                    <Badge variant={permissions[action] !== false ? "default" : "secondary"}>
                      {permissions[action] !== false ? "Granted" : "Unavailable"}
                    </Badge>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <CardTitle>Authentication Method</CardTitle>
                    <CardDescription>Configure how users authenticate with the server</CardDescription>
                  </div>
                  <Button variant="outline" onClick={handleRefreshJwks} disabled={!canUseApi}>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Refresh JWKS
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Authentication Method</Label>
                  <Select defaultValue="internal">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="internal">Internal (Configuration File)</SelectItem>
                      <SelectItem value="http">HTTP (External URL)</SelectItem>
                      <SelectItem value="jwt">JWT (Identity Server)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Internal Users</CardTitle>
                    <CardDescription>Manage users stored in configuration</CardDescription>
                  </div>
                  <Button disabled={!canUseApi}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add User
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-medium">Default User (any)</h3>
                      <Badge variant="secondary">Unprivileged</Badge>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Username</Label>
                        <Input value="any" readOnly />
                      </div>
                      <div className="space-y-2">
                        <Label>Password</Label>
                        <Input type="password" placeholder="No password required" readOnly />
                      </div>
                    </div>
                    <div className="mt-4">
                      <Label>Permissions</Label>
                      <div className="flex flex-wrap gap-2 mt-2">
                        <Badge>publish</Badge>
                        <Badge>read</Badge>
                        <Badge>playback</Badge>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-medium">Administrator</h3>
                      <Badge>Admin</Badge>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Username</Label>
                        <Input value="admin" readOnly />
                      </div>
                      <div className="space-y-2">
                        <Label>Password</Label>
                        <Input type="password" value="adminpass" readOnly />
                      </div>
                    </div>
                    <div className="mt-4">
                      <Label>Permissions</Label>
                      <div className="flex flex-wrap gap-2 mt-2">
                        <Badge>api</Badge>
                        <Badge>metrics</Badge>
                        <Badge>pprof</Badge>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="recording" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Recording Settings</CardTitle>
                <CardDescription>Configure stream recording options</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="recordFormat">Recording Format</Label>
                      <Select defaultValue="fmp4">
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
                      <Label htmlFor="recordPath">Recording Path</Label>
                      <Input defaultValue="./recordings/%path/%Y-%m-%d_%H-%M-%S-%f" />
                      <p className="text-xs text-muted-foreground">
                        Variables: %path, %Y %m %d (date), %H %M %S (time)
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="segmentDuration">Segment Duration</Label>
                      <Input defaultValue="1h" />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="partDuration">Part Duration</Label>
                      <Input defaultValue="1s" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="maxPartSize">Max Part Size</Label>
                      <Input defaultValue="50M" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="deleteAfter">Delete After</Label>
                      <Input defaultValue="1d" />
                      <p className="text-xs text-muted-foreground">Set to 0s to disable automatic deletion</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recording Status</CardTitle>
                <CardDescription>Current recording sessions</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingPaths ? (
                  <LoadingState label="Loading recordings..." />
                ) : dashboardError ? (
                  <ErrorState message={dashboardError} onRetry={() => polling.refresh().catch(() => undefined)} />
                ) : recordings.length === 0 ? (
                  <EmptyState icon={<Play className="h-12 w-12 opacity-50" />} title="No recordings available" />
                ) : (
                  <div className="space-y-4">
                    {recordings.map((recording) => {
                      const firstSegmentStart = recording.segments?.[0]?.start
                      return (
                      <div key={recording.name} className="flex items-center justify-between rounded-lg border p-4">
                        <div className="flex items-center space-x-4">
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100">
                            <Play className="h-5 w-5 text-red-600" />
                          </div>
                          <div>
                            <h3 className="font-medium">{recording.name}</h3>
                            <p className="text-sm text-gray-500">{recording.segments?.length || 0} segments</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary">Recorded</Badge>
                          {firstSegmentStart && (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={!canUseApi || !canRead}
                              onClick={() => handleDeleteRecordingSegment(recording.name, firstSegmentStart)}
                            >
                              Delete first segment
                            </Button>
                          )}
                        </div>
                      </div>
                    )})}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="monitoring" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Refresh Controls</CardTitle>
                <CardDescription>Runtime views use configurable polling and manual refresh</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <Switch checked={isPollingEnabled} onCheckedChange={setIsPollingEnabled} />
                  <Label>Polling enabled</Label>
                </div>
                <Select value={String(pollingIntervalMs)} onValueChange={(value) => setPollingIntervalMs(Number(value))}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5000">5 seconds</SelectItem>
                    <SelectItem value="10000">10 seconds</SelectItem>
                    <SelectItem value="30000">30 seconds</SelectItem>
                    <SelectItem value="60000">60 seconds</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" onClick={() => polling.refresh().catch(() => undefined)}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Refresh now
                </Button>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">HLS Muxers</CardTitle>
                  <CardDescription>Runtime HLS activity</CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoadingPaths ? (
                    <LoadingState label="Loading muxers..." />
                  ) : dashboardError ? (
                    <ErrorState message={dashboardError} onRetry={() => polling.refresh().catch(() => undefined)} />
                  ) : hlsMuxers.length === 0 ? (
                    <EmptyState title="No HLS muxers" />
                  ) : (
                    <div className="space-y-2">
                      {hlsMuxers.map((muxer) => (
                        <div key={muxer.name} className="rounded-lg border p-3 text-sm">
                          <div className="font-medium">{muxer.name}</div>
                          <div className="text-muted-foreground">{formatMegabytes(muxer.bytesSent || 0)} sent</div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">Protocol Resources</CardTitle>
                  <CardDescription>Connections and sessions</CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoadingPaths ? (
                    <LoadingState label="Loading protocol resources..." />
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
                  <CardDescription>Prometheus endpoint</CardDescription>
                </CardHeader>
                <CardContent>
                  {canUseMetrics ? (
                    <Button asChild variant="outline">
                      <a href={buildMediaMtxMetricsUrl()} target="_blank" rel="noreferrer">
                        Open metrics
                      </a>
                    </Button>
                  ) : (
                    <EmptyState title="Metrics permission disabled" />
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">pprof</CardTitle>
                  <CardDescription>Runtime profiling endpoint</CardDescription>
                </CardHeader>
                <CardContent>
                  {canUsePprof ? (
                    <Button asChild variant="outline">
                      <a href={buildMediaMtxPprofUrl()} target="_blank" rel="noreferrer">
                        Open pprof
                      </a>
                    </Button>
                  ) : (
                    <EmptyState title="pprof permission disabled" />
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">CPU Usage</CardTitle>
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
                  <CardTitle className="text-sm font-medium">Memory Usage</CardTitle>
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
                <CardTitle>Service URLs</CardTitle>
                <CardDescription>Resolved browser-side MediaMTX service endpoints</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 text-sm md:grid-cols-2">
                <div className="rounded-lg border p-3">
                  <div className="font-medium">Control API</div>
                  <div className="break-all font-mono text-xs text-muted-foreground">{normalizeMediaMtxApiBaseUrl()}</div>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="font-medium">HLS</div>
                  <div className="break-all font-mono text-xs text-muted-foreground">{normalizeMediaMtxHlsBaseUrl()}</div>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="font-medium">Playback sample</div>
                  <div className="break-all font-mono text-xs text-muted-foreground">
                    {buildMediaMtxPlaybackUrl(selectedStreamPath || "stream")}
                  </div>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="font-medium">Metrics and pprof</div>
                  <div className="break-all font-mono text-xs text-muted-foreground">{buildMediaMtxMetricsUrl()}</div>
                  <div className="break-all font-mono text-xs text-muted-foreground">{buildMediaMtxPprofUrl()}</div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Server Logs</CardTitle>
                <CardDescription>Recent server activity and events</CardDescription>
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
                    Clear Logs
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Audit Log</CardTitle>
                <CardDescription>Recent dashboard administrative operations</CardDescription>
              </CardHeader>
              <CardContent>
                {auditEvents.length === 0 ? (
                  <EmptyState title="No audit entries yet" />
                ) : (
                  <ScrollArea className="h-72 rounded-lg border p-4">
                    <div className="space-y-3">
                      {auditEvents.map((event) => (
                        <div key={event.id} className="rounded-lg border p-3 text-sm">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="font-medium">{event.action}</div>
                            <Badge variant={event.result === "success" ? "default" : "destructive"}>{event.result}</Badge>
                          </div>
                          <div className="mt-1 text-muted-foreground">
                            {new Date(event.timestamp).toLocaleString()} by {event.actor || "unknown"} on {event.target}
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
        </Tabs>
      </div>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Path: {editingPath?.name}</DialogTitle>
            <DialogDescription>Update the configuration for this streaming path</DialogDescription>
          </DialogHeader>
          {editingPath && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Path Name</Label>
                <Input value={editingPath.name} disabled />
              </div>

              <div className="space-y-2">
                <Label htmlFor="editSource">Source URL</Label>
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
                <Label>Source On Demand</Label>
              </div>

              <Separator />

              <div className="flex items-center space-x-2">
                <Switch
                  checked={editingPath.record}
                  onCheckedChange={(checked) => setEditingPath({ ...editingPath, record: checked })}
                />
                <Label>Enable Recording</Label>
              </div>

              {editingPath.record && (
                <div className="space-y-4 ml-6">
                  <div className="space-y-2">
                    <Label>Recording Path</Label>
                    <Input
                      value={editingPath.recordPath || ""}
                      onChange={(e) => setEditingPath({ ...editingPath, recordPath: e.target.value })}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Format</Label>
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
                      <Label>Segment Duration</Label>
                      <Input
                        value={editingPath.recordSegmentDuration || ""}
                        onChange={(e) => setEditingPath({ ...editingPath, recordSegmentDuration: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button onClick={handleUpdatePath} disabled={isSubmitting}>
              {isSubmitting ? "Updating..." : "Update Path"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Path</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the path &quot;{pathToDelete}&quot;? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeletePath} disabled={isSubmitting}>
              {isSubmitting ? "Deleting..." : "Delete"}
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
