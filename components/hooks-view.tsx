"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  AlertTriangle,
  CheckCircle2,
  Eye,
  EyeOff,
  Info,
  RefreshCw,
  Save,
  ChevronDown,
  ChevronRight,
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { LoadingState, ErrorState } from "@/components/module-state"
import { useNotifications } from "@/components/notification-provider"
import { HookCommandEditor, HOOK_ENV_VARS, type HookContext } from "@/components/hook-command-editor"
import { CommandLifecycleBadge } from "@/components/command-lifecycle-badge"
import * as api from "@/lib/mediamtx-api"
import type { GlobalConf, PathConf, Path } from "@/lib/mediamtx-api"
import { requireMediaMtxAction, type MediaMtxPermissionSet } from "@/lib/mediamtx-permissions"
import type { DashboardAuditEvent } from "@/lib/dashboard-audit"

// ── Types ────────────────────────────────────────────────────────

interface HooksViewProps {
  permissions: MediaMtxPermissionSet
  username?: string | null
  appendAuditEvent?: (event: Omit<DashboardAuditEvent, "id" | "timestamp">) => void
}

interface PathOption {
  name: string
  source: string
}

// ── Helpers ──────────────────────────────────────────────────────

function formatTimestamp(iso: string | null): string {
  if (!iso) return "Chưa có"
  try {
    return new Date(iso).toLocaleTimeString()
  } catch {
    return "Không rõ"
  }
}

function computeDirtyFields<T extends Record<string, unknown>>(
  original: T,
  current: T,
  keys: (keyof T)[],
): Partial<T> {
  const patch: Partial<T> = {}
  for (const key of keys) {
    if (current[key] !== original[key]) {
      patch[key] = current[key]
    }
  }
  return patch
}

/**
 * Filter out undefined values — MediaMTX patch rejects `undefined` fields
 */
function cleanPatch<T extends Record<string, unknown>>(patch: Partial<T>): Partial<T> {
  const cleaned: Partial<T> = {}
  for (const [key, value] of Object.entries(patch)) {
    if (value !== undefined) {
      ;(cleaned as Record<string, unknown>)[key] = value
    }
  }
  return cleaned
}

// ── Constants ────────────────────────────────────────────────────

const GLOBAL_HOOK_KEYS: (keyof GlobalConf)[] = [
  "runOnConnect",
  "runOnConnectRestart",
  "runOnDisconnect",
]

const PATH_LIFECYCLE_HOOK_KEYS: (keyof PathConf)[] = [
  "runOnInit",
  "runOnInitRestart",
  "runOnReady",
  "runOnReadyRestart",
  "runOnNotReady",
]

const PATH_ON_DEMAND_HOOK_KEYS: (keyof PathConf)[] = [
  "runOnDemand",
  "runOnDemandRestart",
  "runOnDemandStartTimeout",
  "runOnDemandCloseAfter",
  "runOnUnDemand",
]

const PATH_READ_EVENT_HOOK_KEYS: (keyof PathConf)[] = [
  "runOnRead",
  "runOnReadRestart",
  "runOnUnread",
]

const PATH_RECORDING_HOOK_KEYS: (keyof PathConf)[] = [
  "runOnRecordSegmentCreate",
  "runOnRecordSegmentComplete",
]

const ALL_PATH_HOOK_KEYS: (keyof PathConf)[] = [
  ...PATH_LIFECYCLE_HOOK_KEYS,
  ...PATH_ON_DEMAND_HOOK_KEYS,
  ...PATH_READ_EVENT_HOOK_KEYS,
  ...PATH_RECORDING_HOOK_KEYS,
]

// ── Component ────────────────────────────────────────────────────

export function HooksView({ permissions, username, appendAuditEvent }: HooksViewProps) {
  const { notify } = useNotifications()
  const canUseApi = permissions.api !== false

  // ── Global state ──
  const [globalConfig, setGlobalConfig] = useState<GlobalConf | null>(null)
  const [originalGlobalConfig, setOriginalGlobalConfig] = useState<GlobalConf | null>(null)
  const [lastGlobalSync, setLastGlobalSync] = useState<string | null>(null)

  // ── Path list state ──
  const [pathOptions, setPathOptions] = useState<PathOption[]>([])
  const [isPathsLoading, setIsPathsLoading] = useState(false)
  const [pathsLoadError, setPathsLoadError] = useState<string | null>(null)

  // ── Selected path state ──
  const [selectedPathName, setSelectedPathName] = useState<string>("")
  const [pathConfig, setPathConfig] = useState<PathConf | null>(null)
  const [originalPathConfig, setOriginalPathConfig] = useState<PathConf | null>(null)
  const [isPathConfigLoading, setIsPathConfigLoading] = useState(false)
  const [pathConfigLoadError, setPathConfigLoadError] = useState<string | null>(null)
  const [runtimePaths, setRuntimePaths] = useState<Path[]>([])
  const [lastPathSync, setLastPathSync] = useState<string | null>(null)

  // ── Global save state ──
  const [isGlobalPatchInFlight, setIsGlobalPatchInFlight] = useState(false)
  const [pendingGlobalPatch, setPendingGlobalPatch] = useState<Partial<GlobalConf> | null>(null)

  // ── Path save state ──
  const [isPathPatchInFlight, setIsPathPatchInFlight] = useState(false)
  const [pendingPathPatch, setPendingPathPatch] = useState<Partial<PathConf> | null>(null)

  // ── Dirty tracking for path switch guard ──
  const hasPathDirtyChanges = useMemo(() => {
    if (!originalPathConfig || !pathConfig) return false
    return ALL_PATH_HOOK_KEYS.some((key) => pathConfig[key] !== originalPathConfig[key])
  }, [originalPathConfig, pathConfig])

  const hasGlobalDirtyChanges = useMemo(() => {
    if (!originalGlobalConfig || !globalConfig) return false
    return GLOBAL_HOOK_KEYS.some((key) => globalConfig[key] !== originalGlobalConfig[key])
  }, [originalGlobalConfig, globalConfig])

  // ── Fetch global config ──
  const fetchGlobalConfig = useCallback(async () => {
    try {
      const config = await api.getGlobalConfig()
      setGlobalConfig(config)
      setOriginalGlobalConfig(JSON.parse(JSON.stringify(config)) as GlobalConf)
      setLastGlobalSync(new Date().toISOString())
    } catch (error) {
      notify({ type: "error", title: "Không thể tải global config", message: api.getMediaMtxErrorMessage(error) })
    }
  }, [notify])

  // ── Fetch path list ──
  const fetchPathOptions = useCallback(async () => {
    setIsPathsLoading(true)
    setPathsLoadError(null)
    try {
      const configs = await api.getPathConfigs()
      setPathOptions(configs.map((c) => ({ name: c.name, source: c.source || "" })))
    } catch (error) {
      const message = api.getMediaMtxErrorMessage(error)
      setPathsLoadError(message)
      notify({ type: "error", title: "Không thể tải danh sách path", message })
    } finally {
      setIsPathsLoading(false)
    }
  }, [notify])

  // ── Fetch runtime paths for lifecycle badges ──
  const fetchRuntimePaths = useCallback(async () => {
    try {
      const paths = await api.getPaths()
      setRuntimePaths(paths)
    } catch {
      // Runtime data is optional for badges — silently fail
    }
  }, [])

  // ── Load path config by name ──
  const loadPathConfig = useCallback(
    async (name: string) => {
      setIsPathConfigLoading(true)
      setPathConfigLoadError(null)
      setPathConfig(null)
      setOriginalPathConfig(null)
      setPendingPathPatch(null)
      try {
        const config = await api.getPathConfig(name)
        setPathConfig(config)
        setOriginalPathConfig(JSON.parse(JSON.stringify(config)) as PathConf)
        setLastPathSync(new Date().toISOString())
      } catch (error) {
        const message = api.getMediaMtxErrorMessage(error)
        setPathConfigLoadError(message)
        notify({ type: "error", title: `Không thể tải cấu hình path "${name}"`, message })
      } finally {
        setIsPathConfigLoading(false)
      }
    },
    [notify],
  )

  // ── Initial load ──
  useEffect(() => {
    fetchGlobalConfig()
    fetchPathOptions()
    fetchRuntimePaths()
  }, [fetchGlobalConfig, fetchPathOptions, fetchRuntimePaths])

  // ── Handle path selection ──
  const handlePathSelect = useCallback(
    (name: string) => {
      if (hasPathDirtyChanges) {
        notify({
          type: "info",
          title: "Có thay đổi chưa lưu",
          message: "Vui lòng lưu hoặc hủy thay đổi trước khi chuyển path khác",
        })
        return
      }
      setSelectedPathName(name)
      if (name) {
        loadPathConfig(name)
      } else {
        setPathConfig(null)
        setOriginalPathConfig(null)
        setLastPathSync(null)
      }
    },
    [hasPathDirtyChanges, loadPathConfig, notify],
  )

  // ── Refresh all data ──
  const refreshAll = useCallback(async () => {
    await Promise.all([fetchGlobalConfig(), fetchPathOptions(), fetchRuntimePaths()])
    if (selectedPathName) {
      await loadPathConfig(selectedPathName)
    }
  }, [fetchGlobalConfig, fetchPathOptions, fetchRuntimePaths, loadPathConfig, selectedPathName])

  // ── Helpers ──
  const updateGlobalField = useCallback(<K extends keyof GlobalConf>(key: K, value: GlobalConf[K]) => {
    setGlobalConfig((prev) => (prev ? { ...prev, [key]: value } : prev))
  }, [])

  const updatePathField = useCallback(<K extends keyof PathConf>(key: K, value: PathConf[K]) => {
    setPathConfig((prev) => (prev ? { ...prev, [key]: value } : prev))
  }, [])

  // ── Save global hooks ──
  const saveGlobalHooks = useCallback(async () => {
    if (!globalConfig || !originalGlobalConfig) return

    const dirty = computeDirtyFields(originalGlobalConfig, globalConfig, GLOBAL_HOOK_KEYS)
    if (Object.keys(dirty).length === 0) {
      notify({ type: "info", title: "Không có thay đổi để lưu" })
      return
    }

    const cleaned = cleanPatch(dirty) as Partial<GlobalConf>

    setIsGlobalPatchInFlight(true)
    setPendingGlobalPatch(null)

    try {
      requireMediaMtxAction(permissions, "api")
      await api.patchGlobalConfig(cleaned)

      setOriginalGlobalConfig((prev) => (prev ? { ...prev, ...cleaned } : prev))
      setLastGlobalSync(new Date().toISOString())
      notify({ type: "success", title: "Đã cập nhật global hooks", message: "Cấu hình đã được patch qua hot-reload" })

      appendAuditEvent?.({
        actor: username,
        action: "global-config.hooks.patch",
        target: "global",
        payloadSummary: JSON.stringify(cleaned),
        result: "success",
      })
    } catch (error) {
      const errMessage = api.getMediaMtxErrorMessage(error)
      notify({ type: "error", title: "Không thể cập nhật global hooks", message: errMessage })

      appendAuditEvent?.({
        actor: username,
        action: "global-config.hooks.patch",
        target: "global",
        payloadSummary: JSON.stringify(cleaned),
        result: "failure",
        errorSummary: errMessage,
      })
    } finally {
      setIsGlobalPatchInFlight(false)
    }
  }, [globalConfig, originalGlobalConfig, permissions, notify, username, appendAuditEvent])

  // ── Save path hooks ──
  const savePathHooks = useCallback(async () => {
    if (!pathConfig || !originalPathConfig || !selectedPathName) return

    const dirty = computeDirtyFields(originalPathConfig, pathConfig, ALL_PATH_HOOK_KEYS)
    if (Object.keys(dirty).length === 0) {
      notify({ type: "info", title: "Không có thay đổi để lưu" })
      return
    }

    const cleaned = cleanPatch(dirty) as Partial<PathConf>

    setIsPathPatchInFlight(true)
    setPendingPathPatch(null)

    try {
      requireMediaMtxAction(permissions, "api")
      await api.updatePath(selectedPathName, cleaned)

      setOriginalPathConfig((prev) => (prev ? { ...prev, ...cleaned } : prev))
      setLastPathSync(new Date().toISOString())
      notify({ type: "success", title: `Đã cập nhật hooks cho "${selectedPathName}"`, message: "Cấu hình path đã được patch" })

      appendAuditEvent?.({
        actor: username,
        action: `path-config.${selectedPathName}.hooks.patch`,
        target: selectedPathName,
        payloadSummary: JSON.stringify(cleaned),
        result: "success",
      })
    } catch (error) {
      const errMessage = api.getMediaMtxErrorMessage(error)
      notify({ type: "error", title: `Không thể cập nhật hooks cho "${selectedPathName}"`, message: errMessage })

      appendAuditEvent?.({
        actor: username,
        action: `path-config.${selectedPathName}.hooks.patch`,
        target: selectedPathName,
        payloadSummary: JSON.stringify(cleaned),
        result: "failure",
        errorSummary: errMessage,
      })
    } finally {
      setIsPathPatchInFlight(false)
    }
  }, [pathConfig, originalPathConfig, selectedPathName, permissions, notify, username, appendAuditEvent])

  // ── Resolve runtime path for lifecycle badges ──
  const currentRuntimePath = useMemo(() => {
    if (!selectedPathName) return null
    return runtimePaths.find((p) => p.name === selectedPathName) || null
  }, [runtimePaths, selectedPathName])

  // ── Render: Global Hooks ──
  const renderGlobalHooks = () => {
    if (!globalConfig) return null

    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Global hooks</CardTitle>
              <CardDescription>Lệnh chạy theo vòng đời connection cấp máy chủ</CardDescription>
            </div>
            <Button
              onClick={saveGlobalHooks}
              disabled={!canUseApi || isGlobalPatchInFlight || !hasGlobalDirtyChanges}
              size="sm"
            >
              <Save className="mr-2 h-4 w-4" />
              {isGlobalPatchInFlight ? "Đang lưu..." : "Lưu global hooks"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="space-y-6">
              <HookCommandEditor
                hookName="runOnConnect"
                label="Khi connect (runOnConnect)"
                description="Lệnh chạy khi có client mới kết nối"
                placeholder="/path/to/connect-hook.sh"
                value={globalConfig.runOnConnect ?? ""}
                onChange={(v) => updateGlobalField("runOnConnect", v || undefined)}
                envVars={HOOK_ENV_VARS.global}
                disabled={!canUseApi || isGlobalPatchInFlight}
              />

              <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="space-y-0.5">
                  <Label>Restart khi connect</Label>
                  <p className="text-xs text-muted-foreground">Tự động khởi động lại connect hook khi lệnh thoát</p>
                </div>
                <Switch
                  checked={globalConfig.runOnConnectRestart ?? false}
                  onCheckedChange={(v) => updateGlobalField("runOnConnectRestart", v)}
                  disabled={!canUseApi || isGlobalPatchInFlight}
                />
              </div>
            </div>

            <div className="space-y-6">
              <HookCommandEditor
                hookName="runOnDisconnect"
                label="Khi disconnect (runOnDisconnect)"
                description="Lệnh chạy khi client ngắt kết nối"
                placeholder="/path/to/disconnect-hook.sh"
                value={globalConfig.runOnDisconnect ?? ""}
                onChange={(v) => updateGlobalField("runOnDisconnect", v || undefined)}
                envVars={HOOK_ENV_VARS.global}
                disabled={!canUseApi || isGlobalPatchInFlight}
              />
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  // ── Render: Global card with save preview ──
  const renderGlobalSection = () => {
    if (!globalConfig) {
      return <LoadingState label="Đang tải global configuration..." />
    }

    // Show pending global patch preview instead of the normal card
    if (pendingGlobalPatch) {
      return (
        <Card className="border-[#0052ff]/30 bg-[#0052ff]/5">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Eye className="h-4 w-4 text-[#0052ff]" />
                <CardTitle className="text-sm font-medium">Xem trước payload — global hooks</CardTitle>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => setPendingGlobalPatch(null)}
              >
                <EyeOff className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <pre className="max-h-48 overflow-auto rounded-lg border bg-[#0a0b0d] p-4 text-xs text-white">
              {JSON.stringify(pendingGlobalPatch, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )
    }

    return renderGlobalHooks()
  }

  // ── Render: Path hooks ──

  const renderPathHookField = (
    key: keyof PathConf,
    label: string,
    description: string,
    context: HookContext,
    placeholder?: string,
    hasRestart?: boolean,
    restartKey?: keyof PathConf,
  ) => {
    if (!pathConfig) return null
    const value = (pathConfig[key] ?? "") as string
    const restartValue = restartKey ? (pathConfig[restartKey] ?? false) as boolean : undefined

    return (
      <HookCommandEditor
        key={key as string}
        hookName={key as string}
        label={label}
        description={description}
        placeholder={placeholder}
        value={value}
        onChange={(v) => updatePathField(key, v || (undefined as unknown as PathConf[keyof PathConf]))}
        envVars={HOOK_ENV_VARS[context]}
        restartEnabled={hasRestart && !!restartKey}
        restart={restartValue}
        onRestartChange={restartKey ? (v) => updatePathField(restartKey, v as unknown as PathConf[keyof PathConf]) : undefined}
        disabled={!canUseApi || isPathPatchInFlight}
        pathName={selectedPathName}
      />
    )
  }

  const renderLifecycleSection = () => {
    if (!pathConfig) return null
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Lifecycle</CardTitle>
          <CardDescription>Lệnh chạy theo vòng đời path</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="space-y-6">
            <div className="flex items-center gap-2">
              <div className="flex-1">
                {renderPathHookField("runOnInit", "Khởi tạo (runOnInit)", "Chạy khi path được khởi tạo, trước khi source kết nối", "lifecycle", "/path/to/init-hook.sh")}
              </div>
              {currentRuntimePath && (pathConfig.runOnInit || pathConfig.runOnDemand) && (
                <CommandLifecycleBadge config={pathConfig} runtime={currentRuntimePath} />
              )}
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="space-y-0.5">
                <Label>Restart runOnInit</Label>
                <p className="text-xs text-muted-foreground">Tự động khởi động lại lệnh khi thoát</p>
              </div>
              <Switch
                checked={!!pathConfig.runOnInitRestart}
                onCheckedChange={(v) => updatePathField("runOnInitRestart", v)}
                disabled={!canUseApi || isPathPatchInFlight}
              />
            </div>
          </div>

          <div className="space-y-6">
            {renderPathHookField("runOnReady", "Sẵn sàng (runOnReady)", "Chạy khi path sẵn sàng nhận dữ liệu", "lifecycle", "/path/to/ready-hook.sh", true, "runOnReadyRestart")}

            {renderPathHookField("runOnNotReady", "Không sẵn sàng (runOnNotReady)", "Chạy khi path không còn sẵn sàng", "lifecycle")}
          </div>
        </CardContent>
      </Card>
    )
  }

  const renderOnDemandSection = () => {
    if (!pathConfig) return null
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">On-Demand</CardTitle>
          <CardDescription>Lệnh chạy khi có reader yêu cầu</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="space-y-6">
            {renderPathHookField("runOnDemand", "Khi có reader (runOnDemand)", "Chạy khi có reader đầu tiên yêu cầu path", "onDemand", "/path/to/ondemand-hook.sh", true, "runOnDemandRestart")}

            {renderPathHookField("runOnDemandStartTimeout", "Timeout khởi động (runOnDemandStartTimeout)", "Thời gian chờ tối đa cho lệnh on-demand", "onDemand", "30s")}
          </div>

          <div className="space-y-6">
            {renderPathHookField("runOnDemandCloseAfter", "Đóng sau (runOnDemandCloseAfter)", "Đóng source sau khoảng thời gian không có reader", "onDemand", "60s")}

            {renderPathHookField("runOnUnDemand", "Không còn reader (runOnUnDemand)", "Chạy khi reader cuối cùng ngắt kết nối", "onDemand")}
          </div>
        </CardContent>
      </Card>
    )
  }

  const renderReadEventSection = () => {
    if (!pathConfig) return null
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Read Events</CardTitle>
          <CardDescription>Lệnh chạy khi có reader đọc stream</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="space-y-6">
            {renderPathHookField("runOnRead", "Khi đọc (runOnRead)", "Chạy khi reader bắt đầu đọc", "readEvent", "/path/to/read-hook.sh", true, "runOnReadRestart")}
          </div>

          <div className="space-y-6">
            {renderPathHookField("runOnUnread", "Ngừng đọc (runOnUnread)", "Chạy khi reader ngừng đọc", "readEvent")}
          </div>
        </CardContent>
      </Card>
    )
  }

  const renderRecordingSection = () => {
    if (!pathConfig) return null
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recording</CardTitle>
          <CardDescription>Lệnh chạy khi ghi hình</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="space-y-6">
            {renderPathHookField("runOnRecordSegmentCreate", "Segment mới (runOnRecordSegmentCreate)", "Chạy khi segment ghi hình mới được tạo", "recording")}
          </div>

          <div className="space-y-6">
            {renderPathHookField("runOnRecordSegmentComplete", "Segment hoàn tất (runOnRecordSegmentComplete)", "Chạy khi segment ghi hình hoàn tất", "recording")}
          </div>
        </CardContent>
      </Card>
    )
  }

  // ── Render: Path selector section ──
  const renderPathSelector = () => {
    // Determine status display
    const hasPaths = pathOptions.length > 0
    const selectedPathRuntime = currentRuntimePath

    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Path hooks (theo path)</CardTitle>
              <CardDescription>Cấu hình hook theo từng path streaming</CardDescription>
            </div>
            {!canUseApi && <p className="text-sm text-[#cf202f]">Cần quyền api để chỉnh sửa</p>}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Path selector */}
          <div className="flex items-end gap-3">
            <div className="flex-1 space-y-2">
              <Label>Chọn path</Label>
              <Select
                value={selectedPathName}
                onValueChange={handlePathSelect}
                disabled={isPathsLoading || !hasPaths}
              >
                <SelectTrigger>
                  <SelectValue placeholder={isPathsLoading ? "Đang tải..." : hasPaths ? "Chọn path để cấu hình hooks" : "Chưa có path nào"} />
                </SelectTrigger>
                <SelectContent>
                  {pathOptions.map((p) => (
                    <SelectItem key={p.name} value={p.name}>
                      {p.name}
                      {p.source ? ` (${p.source})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={refreshAll}
              disabled={isPathsLoading || isPathConfigLoading || isGlobalPatchInFlight || isPathPatchInFlight}
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${isPathsLoading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>

          {/* No paths configured */}
          {!isPathsLoading && !hasPaths && !pathsLoadError && (
            <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-muted-foreground">
              <AlertTriangle className="h-4 w-4" />
              <span>Chưa có path nào được cấu hình. Thêm path từ tab Paths để cấu hình hooks.</span>
            </div>
          )}

          {/* Paths load error */}
          {pathsLoadError && (
            <ErrorState message={pathsLoadError} onRetry={fetchPathOptions} />
          )}
        </CardContent>
      </Card>
    )
  }

  // ── Render: Path config sections (shown only when a path is selected) ──
  const renderPathConfigSections = () => {
    if (!selectedPathName) return null

    if (isPathConfigLoading) {
      return <LoadingState label={`Đang tải cấu hình path "${selectedPathName}"...`} />
    }

    if (pathConfigLoadError) {
      return <ErrorState message={pathConfigLoadError} onRetry={() => loadPathConfig(selectedPathName)} />
    }

    if (!pathConfig) {
      return null
    }

    return (
      <div className="space-y-6">
        {/* Path info bar */}
        <div className="flex items-center justify-between rounded-lg border p-3 text-sm">
          <div className="flex items-center gap-3">
            <span className="font-medium">{selectedPathName}</span>
            {currentRuntimePath && (
              <CommandLifecycleBadge config={pathConfig} runtime={currentRuntimePath} />
            )}
            {lastPathSync && (
              <span className="text-xs text-muted-foreground">
                Đồng bộ: {formatTimestamp(lastPathSync)}
              </span>
            )}
          </div>
          <Button
            onClick={savePathHooks}
            disabled={!canUseApi || isPathPatchInFlight || !hasPathDirtyChanges}
            size="sm"
          >
            <Save className="mr-2 h-4 w-4" />
            {isPathPatchInFlight ? "Đang lưu..." : "Lưu path hooks"}
          </Button>
        </div>

        {/* Pending path patch preview */}
        {pendingPathPatch && (
          <Card className="border-[#0052ff]/30 bg-[#0052ff]/5">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Eye className="h-4 w-4 text-[#0052ff]" />
                  <CardTitle className="text-sm font-medium">Xem trước payload — path hooks</CardTitle>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={() => setPendingPathPatch(null)}
                >
                  <EyeOff className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <pre className="max-h-48 overflow-auto rounded-lg border bg-[#0a0b0d] p-4 text-xs text-white">
                {JSON.stringify(pendingPathPatch, null, 2)}
              </pre>
            </CardContent>
          </Card>
        )}

        {/* Hook sections by lifecycle category */}
        {renderLifecycleSection()}
        {renderOnDemandSection()}
        {renderReadEventSection()}
        {renderRecordingSection()}

        {/* Empty state — no hooks configured */}
        {!ALL_PATH_HOOK_KEYS.some((key) => pathConfig[key]) && (
          <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-muted-foreground">
            <Info className="h-4 w-4" />
            <span>Path này chưa có hook nào được cấu hình. Sử dụng các section trên để thêm hook.</span>
          </div>
        )}
      </div>
    )
  }

  // ── Main render ──
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">Quản lý hooks</h2>
          <p className="text-sm text-muted-foreground">
            Cấu hình hook commands cho global và từng path
            {(hasGlobalDirtyChanges || hasPathDirtyChanges) && (
              <span className="ml-2 text-amber-600">(có thay đổi chưa lưu)</span>
            )}
          </p>
        </div>
        {lastGlobalSync && (
          <p className="text-xs text-muted-foreground">
            <CheckCircle2 className="mr-1 inline h-3 w-3 text-[#05b169]" />
            Global đồng bộ: {formatTimestamp(lastGlobalSync)}
          </p>
        )}
      </div>

      <Separator />

      {/* Global hooks section */}
      {renderGlobalSection()}

      <Separator />

      {/* Path selector section */}
      {renderPathSelector()}

      {/* Path hook sections */}
      {renderPathConfigSections()}
    </div>
  )
}


