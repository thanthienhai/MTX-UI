"use client"

import { useCallback, useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { AlertCircle, CheckCircle2, Eye, EyeOff, RefreshCw } from "lucide-react"
import { LoadingState, ErrorState } from "@/components/module-state"
import { useNotifications } from "@/components/notification-provider"
import * as api from "@/lib/mediamtx-api"
import type { GlobalConf } from "@/lib/mediamtx-api"
import type { MediaMtxPermissionSet } from "@/lib/mediamtx-permissions"
import type { DashboardAuditEvent } from "@/lib/dashboard-audit"

interface GlobalConfigViewProps {
  permissions: MediaMtxPermissionSet
  username?: string | null
  appendAuditEvent?: (event: Omit<DashboardAuditEvent, "id" | "timestamp">) => void
}

function computeDirtyFields<T extends Record<string, unknown>>(
  original: T,
  current: T,
  allowedKeys: (keyof T)[],
): Partial<T> {
  const patch: Partial<T> = {}
  for (const key of allowedKeys) {
    if (current[key] !== original[key]) {
      patch[key] = current[key]
    }
  }
  return patch
}

function formatTimestamp(iso: string | null): string {
  if (!iso) return "Never"
  try {
    return new Date(iso).toLocaleTimeString()
  } catch {
    return "Unknown"
  }
}

export function GlobalConfigView({ permissions, username, appendAuditEvent }: GlobalConfigViewProps) {
  const { notify } = useNotifications()
  const canUseApi = permissions.api !== false

  // --- State ---
  const [globalConfig, setGlobalConfig] = useState<GlobalConf | null>(null)
  const [originalConfig, setOriginalConfig] = useState<GlobalConf | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null)
  const [isPatchInFlight, setIsPatchInFlight] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  // Patch preview state
  const [pendingPatchPreview, setPendingPatchPreview] = useState<Record<string, unknown> | null>(null)
  const [patchPreviewSection, setPatchPreviewSection] = useState<"general" | "hooks" | null>(null)
  const [isPreviewExpanded, setIsPreviewExpanded] = useState(false)

  // --- General settings keys ---
  const generalKeys: (keyof GlobalConf)[] = [
    "logLevel",
    "logDestinations",
    "logStructured",
    "logFile",
    "sysLogPrefix",
    "dumpPackets",
    "readTimeout",
    "writeTimeout",
    "writeQueueSize",
    "udpMaxPayloadSize",
    "udpReadBufferSize",
  ]

  const hookKeys: (keyof GlobalConf)[] = ["runOnConnect", "runOnConnectRestart", "runOnDisconnect"]

  // --- Fetch ---
  const fetchConfig = useCallback(async () => {
    setIsLoading(true)
    setLoadError(null)
    try {
      const config = await api.getGlobalConfig()
      setGlobalConfig(config)
      setOriginalConfig(JSON.parse(JSON.stringify(config)) as GlobalConf)
      setLastSyncedAt(new Date().toISOString())
      setFieldErrors({})
    } catch (error) {
      const message = api.getMediaMtxErrorMessage(error)
      setLoadError(message)
      notify({ type: "error", title: "Failed to load global config", message })
    } finally {
      setIsLoading(false)
    }
  }, [notify])

  useEffect(() => {
    fetchConfig()
  }, [fetchConfig])

  // --- Helpers ---
  const updateField = useCallback(
    <K extends keyof GlobalConf>(key: K, value: GlobalConf[K]) => {
      setGlobalConfig((prev) => (prev ? { ...prev, [key]: value } : prev))
      setFieldErrors((prev) => {
        const next = { ...prev }
        delete next[key as string]
        return next
      })
    },
    [],
  )

  const notifyError = useCallback(
    (title: string, error: unknown) => {
      notify({ type: "error", title, message: api.getMediaMtxErrorMessage(error) })
    },
    [notify],
  )

  // --- Patch helpers ---
  const showPreview = (section: "general" | "hooks") => {
    if (!globalConfig || !originalConfig) return

    const keys = section === "general" ? generalKeys : hookKeys
    const dirty = computeDirtyFields(originalConfig, globalConfig, keys)
    setPendingPatchPreview(dirty)
    setPatchPreviewSection(section)
    setIsPreviewExpanded(true)
  }

  const executePatch = async (section: "general" | "hooks") => {
    if (!globalConfig || !originalConfig) return

    const keys = section === "general" ? generalKeys : hookKeys
    const dirty = computeDirtyFields(originalConfig, globalConfig, keys)
    if (Object.keys(dirty).length === 0) {
      notify({ type: "info", title: "No changes to save" })
      return
    }

    setIsPatchInFlight(true)
    setFieldErrors({})
    setPendingPatchPreview(null)
    setIsPreviewExpanded(false)

    try {
      await api.patchGlobalConfig(dirty as Partial<GlobalConf>)

      // Update original to match current
      setOriginalConfig((prev) => (prev ? { ...prev, ...dirty } : prev))
      setLastSyncedAt(new Date().toISOString())
      notify({
        type: "success",
        title: `${section === "general" ? "General settings" : "Global hooks"} updated`,
        message: "Configuration patched via hot-reload",
      })

      appendAuditEvent?.({
        actor: username,
        action: `global-config.${section}.patch`,
        target: "global",
        payloadSummary: JSON.stringify(dirty),
        result: "success",
      })
    } catch (error) {
      const errMessage = api.getMediaMtxErrorMessage(error)

      // Try to extract per-field errors from the error body
      if (error instanceof api.MediaMtxApiError && error.body && typeof error.body === "object") {
        const body = error.body as Record<string, unknown>
        // MediaMTX may return field-level errors in the response body
        const parsedErrors: Record<string, string> = {}
        for (const key of keys) {
          const keyStr = key as string
          if (body[keyStr] && typeof body[keyStr] === "string") {
            parsedErrors[keyStr] = body[keyStr] as string
          }
        }
        if (Object.keys(parsedErrors).length > 0) {
          setFieldErrors(parsedErrors)
          notify({ type: "error", title: "Some fields have errors", message: "Check field-level error messages" })
        } else {
          notifyError(`Failed to update ${section}`, error)
        }
      } else {
        notifyError(`Failed to update ${section}`, error)
      }

      appendAuditEvent?.({
        actor: username,
        action: `global-config.${section}.patch`,
        target: "global",
        payloadSummary: JSON.stringify(dirty),
        result: "failure",
        errorSummary: errMessage,
      })
    } finally {
      setIsPatchInFlight(false)
    }
  }

  // --- Render helpers ---
  const renderFieldError = (fieldName: string) => {
    if (!fieldErrors[fieldName]) return null
    return <p className="mt-1 text-xs text-[#cf202f]">{fieldErrors[fieldName]}</p>
  }

  const renderSwitch = (label: string, description: string, key: keyof GlobalConf) => {
    const value = globalConfig?.[key]
    return (
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label>{label}</Label>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <Switch
          checked={value === true}
          onCheckedChange={(checked) => updateField(key, checked)}
          disabled={!canUseApi || isPatchInFlight}
        />
      </div>
    )
  }

  const renderTextInput = (label: string, key: keyof GlobalConf, placeholder?: string, disabled?: boolean) => {
    const value = globalConfig?.[key]
    return (
      <div className="space-y-2">
        <Label htmlFor={key as string}>{label}</Label>
        <Input
          id={key as string}
          value={typeof value === "string" ? value : ""}
          onChange={(e) => updateField(key, e.target.value)}
          placeholder={placeholder}
          disabled={disabled ?? (!canUseApi || isPatchInFlight)}
          className={fieldErrors[key as string] ? "border-[#cf202f]" : undefined}
        />
        {renderFieldError(key as string)}
      </div>
    )
  }

  const renderNumberInput = (label: string, key: keyof GlobalConf, placeholder?: string) => {
    const value = globalConfig?.[key]
    return (
      <div className="space-y-2">
        <Label htmlFor={key as string}>{label}</Label>
        <Input
          id={key as string}
          type="number"
          value={typeof value === "number" ? value : ""}
          onChange={(e) => updateField(key, e.target.value ? Number(e.target.value) : undefined)}
          placeholder={placeholder}
          disabled={!canUseApi || isPatchInFlight}
          className={fieldErrors[key as string] ? "border-[#cf202f]" : undefined}
        />
        {renderFieldError(key as string)}
      </div>
    )
  }

  const renderSelect = (
    label: string,
    key: keyof GlobalConf,
    options: { value: string; label: string }[],
    placeholder?: string,
  ) => {
    const value = globalConfig?.[key]
    return (
      <div className="space-y-2">
        <Label htmlFor={key as string}>{label}</Label>
        <Select
          value={typeof value === "string" ? value : ""}
          onValueChange={(v) => updateField(key, v)}
          disabled={!canUseApi || isPatchInFlight}
        >
          <SelectTrigger className={fieldErrors[key as string] ? "border-[#cf202f]" : undefined}>
            <SelectValue placeholder={placeholder} />
          </SelectTrigger>
          <SelectContent>
            {options.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {renderFieldError(key as string)}
      </div>
    )
  }

  // --- Loading / Error states ---
  if (isLoading && !globalConfig) {
    return <LoadingState label="Loading global configuration..." />
  }

  if (loadError && !globalConfig) {
    return <ErrorState message={loadError} onRetry={fetchConfig} />
  }

  if (!globalConfig) {
    return <ErrorState message="No configuration data available" onRetry={fetchConfig} />
  }

  const generalDirtyCount = computeDirtyFields(originalConfig || {}, globalConfig, generalKeys)
  const hooksDirtyCount = computeDirtyFields(originalConfig || {}, globalConfig, hookKeys)

  return (
    <div className="space-y-6">
      {/* Header with last synced */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">Global Server Configuration</h2>
          <p className="text-sm text-muted-foreground">
            Last synced: {formatTimestamp(lastSyncedAt)}
            {Object.keys(generalDirtyCount).length + Object.keys(hooksDirtyCount).length > 0 && (
              <span className="ml-2 text-amber-600">(unsaved changes)</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!canUseApi && (
            <p className="text-sm text-[#cf202f]">API permission required to edit</p>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={fetchConfig}
            disabled={isLoading || isPatchInFlight}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Patch Preview */}
      {pendingPatchPreview && isPreviewExpanded && (
        <Card className="border-[#0052ff]/30 bg-[#0052ff]/5">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Eye className="h-4 w-4 text-[#0052ff]" />
                <CardTitle className="text-sm font-medium">Payload Preview</CardTitle>
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
            <CardDescription>
              Review the JSON payload that will be sent to PATCH /v3/config/global/patch
            </CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="max-h-48 overflow-auto rounded-lg border bg-[#0a0b0d] p-4 text-xs text-white">
              {JSON.stringify(pendingPatchPreview, null, 2)}
            </pre>
            <div className="mt-4 flex items-center gap-3">
              <Button
                size="sm"
                onClick={() => executePatch(patchPreviewSection!)}
                disabled={isPatchInFlight}
              >
                <CheckCircle2 className="mr-2 h-4 w-4" />
                {isPatchInFlight ? "Applying..." : "Apply changes"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setPendingPatchPreview(null)
                  setIsPreviewExpanded(false)
                }}
                disabled={isPatchInFlight}
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* General Settings Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>General Settings</CardTitle>
              <CardDescription>Server-wide logging and network configuration</CardDescription>
            </div>
            {!pendingPatchPreview && (
              <Button
                onClick={() => showPreview("general")}
                disabled={!canUseApi || isPatchInFlight || Object.keys(generalDirtyCount).length === 0}
              >
                <Eye className="mr-2 h-4 w-4" />
                Preview & Save
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="space-y-4">
              {renderSelect("Log Level", "logLevel", [
                { value: "error", label: "Error" },
                { value: "warn", label: "Warning" },
                { value: "info", label: "Info" },
                { value: "debug", label: "Debug" },
              ])}

              {renderSelect("Log Destinations", "logDestinations", [
                { value: "stdout", label: "stdout" },
                { value: "file", label: "File" },
                { value: "syslog", label: "Syslog" },
                { value: "stdout,file", label: "stdout + File" },
                { value: "stdout,syslog", label: "stdout + Syslog" },
                { value: "file,syslog", label: "File + Syslog" },
                { value: "stdout,file,syslog", label: "All destinations" },
              ])}

              {renderSwitch("Structured Logging", "Output logs as structured JSON", "logStructured")}

              {renderTextInput("Log File Path", "logFile", "/var/log/mediamtx.log")}

              {renderTextInput("Syslog Prefix", "sysLogPrefix", "mediamtx")}
            </div>

            <div className="space-y-4">
              {renderSwitch("Dump Packets", "Log raw packet dumps", "dumpPackets")}

              {renderTextInput("Read Timeout", "readTimeout", "10s")}

              {renderTextInput("Write Timeout", "writeTimeout", "10s")}

              {renderNumberInput("Write Queue Size", "writeQueueSize", "512")}

              {renderNumberInput("UDP Max Payload Size", "udpMaxPayloadSize", "1472")}

              {renderNumberInput("UDP Read Buffer Size", "udpReadBufferSize", "65536")}
            </div>
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* Global Hooks Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Global Hooks</CardTitle>
              <CardDescription>Commands triggered by connection lifecycle events</CardDescription>
            </div>
            {!pendingPatchPreview && (
              <Button
                onClick={() => showPreview("hooks")}
                disabled={!canUseApi || isPatchInFlight || Object.keys(hooksDirtyCount).length === 0}
              >
                <Eye className="mr-2 h-4 w-4" />
                Preview & Save
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="space-y-4">
              {renderTextInput("On Connect", "runOnConnect", "/path/to/connect-hook.sh")}

              {renderSwitch(
                "On Connect Restart",
                "Restart the connect hook command when it exits",
                "runOnConnectRestart",
              )}
            </div>

            <div className="space-y-4">
              {renderTextInput("On Disconnect", "runOnDisconnect", "/path/to/disconnect-hook.sh")}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Inline success feedback after patch applied */}
      {lastSyncedAt && !isPatchInFlight && !pendingPatchPreview && (
        <p className="text-xs text-muted-foreground text-right">
          <CheckCircle2 className="mr-1 inline h-3 w-3 text-[#05b169]" />
          Configuration synced at {formatTimestamp(lastSyncedAt)}
        </p>
      )}
    </div>
  )
}
