"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { CheckCircle2, Eye, RefreshCw, Shield } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { useNotifications } from "@/components/notification-provider"
import type { DashboardAuditEvent } from "@/lib/dashboard-audit"
import * as api from "@/lib/mediamtx-api"
import type { PathConf } from "@/lib/mediamtx-api"
import { requireMediaMtxAction, type MediaMtxPermissionSet } from "@/lib/mediamtx-permissions"
import {
  getPathFieldEntry,
  getFieldsForSourceType,
  PATH_FIELD_REGISTRY,
  PATH_DEFAULTS_FIELDS,
  PATH_FIELD_CATEGORIES,
  diffPathAgainstDefaults,
  validateDefaultsPatch,
  buildMinimalPatch,
} from "@/lib/path-management.mjs"

interface PathDefaultsEditorProps {
  permissions: MediaMtxPermissionSet
  username?: string | null
  pathDefaults: PathConf | null
  configuredPaths: PathConf[]
  appendAuditEvent?: (event: Omit<DashboardAuditEvent, "id" | "timestamp">) => void
  onChanged?: () => void
  onDefaultsChange?: (defaults: PathConf) => void
}

type FieldCategory = keyof typeof PATH_FIELD_CATEGORIES

export function PathDefaultsEditor({
  permissions,
  username,
  pathDefaults,
  configuredPaths,
  appendAuditEvent,
  onChanged,
  onDefaultsChange,
}: PathDefaultsEditorProps) {
  const { notify } = useNotifications()
  const canUseApi = permissions.api !== false

  const [config, setConfig] = useState<PathConf | null>(null)
  const [originalConfig, setOriginalConfig] = useState<PathConf | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [previewPatch, setPreviewPatch] = useState<Record<string, unknown> | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  // Sync with prop changes
  useEffect(() => {
    if (pathDefaults) {
      setConfig({ ...pathDefaults } as PathConf)
      setOriginalConfig(JSON.parse(JSON.stringify(pathDefaults)) as PathConf)
      setFieldErrors({})
      setPreviewPatch(null)
    }
  }, [pathDefaults])

  const updateField = useCallback((field: string, value: unknown) => {
    setConfig((current) => (current ? { ...current, [field]: value } : current))
    setFieldErrors((current) => {
      const next = { ...current }
      delete next[field]
      return next
    })
    setPreviewPatch(null)
  }, [])

  const dirtyPatch = useMemo(() => {
    if (!originalConfig || !config) return {}
    return buildMinimalPatch(originalConfig, config, PATH_DEFAULTS_FIELDS)
  }, [config, originalConfig])

  const showPreview = () => {
    const errors = validateDefaultsPatch(dirtyPatch) as Record<string, string>
    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) {
      notify({ type: "error", title: "Cấu hình path defaults chưa hợp lệ", message: "Kiểm tra các trường được đánh dấu." })
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
      await api.patchPathDefaults(previewPatch as Partial<PathConf>)
      setOriginalConfig((current) => (current ? { ...current, ...previewPatch } : current))
      setPreviewPatch(null)
      notify({ type: "success", title: "Đã cập nhật path defaults", message: `${Object.keys(previewPatch).length} trường đã thay đổi` })
      appendAuditEvent?.({
        actor: username,
        action: "pathdefaults.patch",
        target: "pathDefaults",
        payloadSummary: JSON.stringify(Object.keys(previewPatch)),
        result: "success",
      })
      onDefaultsChange?.({ ...originalConfig!, ...previewPatch } as PathConf)
      await onChanged?.()
    } catch (error) {
      notify({ type: "error", title: "Không thể cập nhật path defaults", message: api.getMediaMtxErrorMessage(error) })
      appendAuditEvent?.({
        actor: username,
        action: "pathdefaults.patch",
        target: "pathDefaults",
        payloadSummary: JSON.stringify(Object.keys(previewPatch)),
        result: "failure",
        errorSummary: api.getMediaMtxErrorMessage(error),
      })
    } finally {
      setIsSaving(false)
    }
  }

  const fieldsByCategory = useMemo(() => {
    const result: Record<string, typeof PATH_FIELD_REGISTRY> = {}
    for (const entry of getFieldsForSourceType()) {
      if (!entry.appliesToDefaults) continue
      const cat = entry.category as string
      if (!result[cat]) result[cat] = []
      result[cat].push(entry)
    }
    return result
  }, [])

  const renderField = (entry: ReturnType<typeof getPathFieldEntry>) => {
    if (!entry || !config) return null
    const field = entry.field
    const value = config[field as keyof PathConf]
    const error = fieldErrors[field]
    const disabled = !canUseApi || isSaving

    const common = {
      id: `path-default-${field}`,
      disabled,
      className: error ? "border-[#cf202f]" : undefined,
    }

    if (entry.type === "boolean") {
      return (
        <div key={field} className="flex items-center justify-between rounded-lg border p-3">
          <div className="space-y-0.5">
            <Label>{entry.label}</Label>
            {entry.description && <p className="text-xs text-muted-foreground">{entry.description}</p>}
          </div>
          <Switch
            checked={value === true}
            onCheckedChange={(checked) => updateField(field, checked)}
            disabled={disabled}
          />
        </div>
      )
    }

    if (entry.type === "number") {
      return (
        <div key={field} className="space-y-2">
          <Label htmlFor={common.id}>{entry.label}</Label>
          <Input
            {...common}
            type="number"
            value={typeof value === "number" ? value : ""}
            onChange={(e) => updateField(field, e.target.value ? Number(e.target.value) : undefined)}
            placeholder={entry.placeholder}
          />
          {entry.description && <p className="text-xs text-muted-foreground">{entry.description}</p>}
          {error && <p className="text-xs text-[#cf202f]">{error}</p>}
        </div>
      )
    }

    if (entry.type === "duration" || entry.type === "size") {
      return (
        <div key={field} className="space-y-2">
          <Label htmlFor={common.id}>{entry.label}</Label>
          <Input
            {...common}
            type="text"
            value={typeof value === "string" ? value : ""}
            onChange={(e) => updateField(field, e.target.value)}
            placeholder={entry.placeholder || (entry.type === "duration" ? "10s" : "50M")}
          />
          {entry.description && <p className="text-xs text-muted-foreground">{entry.description}</p>}
          {error && <p className="text-xs text-[#cf202f]">{error}</p>}
        </div>
      )
    }

    if (entry.options && entry.options.length > 0) {
      return (
        <div key={field} className="space-y-2">
          <Label htmlFor={common.id}>{entry.label}</Label>
          <Select
            value={typeof value === "string" ? value : ""}
            onValueChange={(next) => updateField(field, next)}
            disabled={disabled}
          >
            <SelectTrigger className={error ? "border-[#cf202f]" : undefined}>
              <SelectValue placeholder={entry.placeholder || "Chọn giá trị"} />
            </SelectTrigger>
            <SelectContent>
              {entry.options.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {entry.description && <p className="text-xs text-muted-foreground">{entry.description}</p>}
          {error && <p className="text-xs text-[#cf202f]">{error}</p>}
        </div>
      )
    }

    // Default: string or url
    return (
      <div key={field} className="space-y-2">
        <Label htmlFor={common.id}>{entry.label}</Label>
        <Input
          {...common}
          type="text"
          value={typeof value === "string" ? value : ""}
          onChange={(e) => updateField(field, e.target.value)}
          placeholder={entry.placeholder}
        />
        {entry.description && <p className="text-xs text-muted-foreground">{entry.description}</p>}
        {error && <p className="text-xs text-[#cf202f]">{error}</p>}
      </div>
    )
  }

  const categoryLabels = PATH_FIELD_CATEGORIES as Record<string, string>

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Path Defaults</h2>
          <p className="text-sm text-muted-foreground">Chỉnh sửa các trường mặc định cho tất cả paths mới.</p>
        </div>
        <div className="flex items-center gap-2">
          {!canUseApi && (
            <div className="flex items-center gap-2 rounded-lg border border-[#cf202f]/30 bg-[#cf202f]/5 p-2 text-sm text-[#cf202f]">
              <Shield className="h-4 w-4" />
              Cần quyền api để chỉnh sửa
            </div>
          )}
          <Button
            variant="outline"
            onClick={() => {
              if (pathDefaults) {
                setConfig({ ...pathDefaults } as PathConf)
                setOriginalConfig(JSON.parse(JSON.stringify(pathDefaults)) as PathConf)
                setFieldErrors({})
                setPreviewPatch(null)
              }
            }}
            disabled={!canUseApi || isSaving}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Reset
          </Button>
        </div>
      </div>

      {/* Fields by category */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <CardTitle>Các trường path defaults</CardTitle>
              <CardDescription>PATCH /v3/config/pathdefaults/patch chỉ gửi các trường đã thay đổi.</CardDescription>
            </div>
            <Button
              onClick={showPreview}
              disabled={!canUseApi || isSaving || Object.keys(dirtyPatch).length === 0}
            >
              <Eye className="mr-2 h-4 w-4" />
              Xem trước & lưu
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {Object.entries(fieldsByCategory).map(([category, entries]) => {
            const label = categoryLabels[category] || category
            return (
              <div key={category}>
                <h3 className="mb-3 text-sm font-medium text-muted-foreground">{label}</h3>
                <div className="grid gap-4 md:grid-cols-2">
                  {entries.map((entry) => renderField(entry))}
                </div>
                <Separator className="mt-6" />
              </div>
            )
          })}
        </CardContent>
      </Card>

      {/* Patch Preview */}
      {previewPatch && (
        <Card className="border-[#0052ff]/30 bg-[#0052ff]/5">
          <CardHeader>
            <CardTitle className="text-base">Xem trước path defaults patch</CardTitle>
            <CardDescription>Payload gửi tới PATCH /v3/config/pathdefaults/patch.</CardDescription>
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
    </div>
  )
}