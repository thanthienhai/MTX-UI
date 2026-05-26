"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { CheckCircle2, Eye, EyeOff, RefreshCw } from "lucide-react"
import { LoadingState, ErrorState } from "@/components/module-state"
import { useNotifications } from "@/components/notification-provider"
import * as api from "@/lib/mediamtx-api"
import type { PathConf } from "@/lib/mediamtx-api"
import { requireMediaMtxAction, type MediaMtxPermissionSet } from "@/lib/mediamtx-permissions"
import type { DashboardAuditEvent } from "@/lib/dashboard-audit"

interface RecordingSettingsViewProps {
  permissions: MediaMtxPermissionSet
  username?: string | null
  appendAuditEvent?: (event: Omit<DashboardAuditEvent, "id" | "timestamp">) => void
}

function computeDirtyFields(original: Partial<PathConf>, current: Partial<PathConf>): Partial<PathConf> {
  const patch: Partial<PathConf> = {}
  const keys: (keyof PathConf)[] = [
    "record", "recordPath", "recordFormat", "recordPartDuration",
    "recordSegmentDuration", "recordDeleteAfter", "recordMaxPartSize",
  ]
  for (const key of keys) {
    if (current[key] !== original[key]) {
      patch[key] = current[key]
    }
  }
  return patch
}

export function RecordingSettingsView({ permissions, username, appendAuditEvent }: RecordingSettingsViewProps) {
  const { notify } = useNotifications()
  const canUseApi = permissions.api !== false

  const [pathDefaults, setPathDefaults] = useState<Partial<PathConf> | null>(null)
  const [originalDefaults, setOriginalDefaults] = useState<Partial<PathConf> | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [previewPatch, setPreviewPatch] = useState<Record<string, unknown> | null>(null)
  const [isPreviewExpanded, setIsPreviewExpanded] = useState(false)

  const RECORDING_FIELDS = useMemo(() => ["record", "recordPath", "recordFormat", "recordPartDuration", "recordSegmentDuration", "recordMaxPartSize", "recordDeleteAfter"] as const, [])

  const fetchDefaults = useCallback(async () => {
    setIsLoading(true)
    setLoadError(null)
    try {
      const defaults = await api.getPathDefaults()
      const recordingPart: Partial<PathConf> = {}
      for (const field of RECORDING_FIELDS) {
        if (field in defaults) {
          recordingPart[field] = defaults[field as keyof PathConf] as PathConf[keyof PathConf]
        }
      }
      setPathDefaults(recordingPart)
      setOriginalDefaults(JSON.parse(JSON.stringify(recordingPart)) as Partial<PathConf>)
      setFieldErrors({})
      setPreviewPatch(null)
    } catch (error) {
      setLoadError(api.getMediaMtxErrorMessage(error))
      notify({ type: "error", title: "Không thể tải cài đặt ghi hình", message: api.getMediaMtxErrorMessage(error) })
    } finally {
      setIsLoading(false)
    }
  }, [notify, RECORDING_FIELDS])

  useEffect(() => {
    fetchDefaults()
  }, [fetchDefaults])

  const updateField = useCallback((field: string, value: unknown) => {
    setPathDefaults((prev) => (prev ? { ...prev, [field]: value } : prev))
    setFieldErrors((prev) => {
      const next = { ...prev }
      delete next[field]
      return next
    })
    setPreviewPatch(null)
    setIsPreviewExpanded(false)
  }, [])

  const validateSize = (value: string): boolean => {
    return /^\d+(M|G)$/.test(value)
  }

  const showPreview = () => {
    if (!pathDefaults || !originalDefaults) return

    const errors: Record<string, string> = {}
    if (pathDefaults.recordMaxPartSize && !validateSize(pathDefaults.recordMaxPartSize)) {
      errors.recordMaxPartSize = "Phải có định dạng số + đơn vị (vd: 50M, 100M, 1G)"
    }
    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) {
      notify({ type: "error", title: "Cài đặt chưa hợp lệ", message: "Kiểm tra các trường được đánh dấu." })
      return
    }

    const dirty = computeDirtyFields(originalDefaults, pathDefaults)
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
      await api.patchPathDefaults(previewPatch as Partial<PathConf>)
      setOriginalDefaults((prev) => (prev ? { ...prev, ...previewPatch } : prev))
      setPreviewPatch(null)
      setIsPreviewExpanded(false)
      notify({ type: "success", title: "Đã lưu cài đặt ghi hình", message: `${Object.keys(previewPatch).length} trường đã thay đổi` })
      appendAuditEvent?.({
        actor: username,
        action: "recording.settings.patch",
        target: "pathDefaults",
        payloadSummary: JSON.stringify(Object.keys(previewPatch)),
        result: "success",
      })
    } catch (error) {
      const errMessage = api.getMediaMtxErrorMessage(error)
      if (error instanceof api.MediaMtxApiError && error.body && typeof error.body === "object") {
        const body = error.body as Record<string, unknown>
        const parsedErrors: Record<string, string> = {}
        for (const key of RECORDING_FIELDS) {
          if (body[key] && typeof body[key] === "string") {
            parsedErrors[key] = body[key] as string
          }
        }
        if (Object.keys(parsedErrors).length > 0) {
          setFieldErrors(parsedErrors)
          notify({ type: "error", title: "Một số trường bị lỗi", message: "Kiểm tra lỗi ở từng trường" })
        } else {
          notify({ type: "error", title: "Không thể lưu cài đặt ghi hình", message: errMessage })
        }
      } else {
        notify({ type: "error", title: "Không thể lưu cài đặt ghi hình", message: errMessage })
      }
      appendAuditEvent?.({
        actor: username,
        action: "recording.settings.patch",
        target: "pathDefaults",
        payloadSummary: JSON.stringify(Object.keys(previewPatch)),
        result: "failure",
        errorSummary: errMessage,
      })
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading && !pathDefaults) {
    return <LoadingState label="Đang tải cài đặt ghi hình..." />
  }

  if (loadError && !pathDefaults) {
    return <ErrorState message={loadError} onRetry={fetchDefaults} />
  }

  if (!pathDefaults) {
    return <ErrorState message="Không có dữ liệu cài đặt ghi hình" onRetry={fetchDefaults} />
  }

  const recordEnabled = pathDefaults.record === true
  const dirtyCount = computeDirtyFields(originalDefaults || {}, pathDefaults)

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Cài đặt ghi hình</CardTitle>
            <CardDescription>Cấu hình tùy chọn ghi hình stream qua path defaults</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {!canUseApi && (
              <p className="text-sm text-[#cf202f]">Cần quyền api để chỉnh sửa</p>
            )}
            <Button variant="outline" size="sm" onClick={fetchDefaults} disabled={isLoading || isSaving}>
              <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between rounded-lg border p-3">
          <div className="space-y-0.5">
            <Label>Bật ghi hình</Label>
            <p className="text-xs text-muted-foreground">Cho phép ghi hình stream cho tất cả path</p>
          </div>
          <Switch
            checked={recordEnabled}
            onCheckedChange={(checked) => updateField("record", checked)}
            disabled={!canUseApi || isSaving}
          />
        </div>

        <div className={`space-y-4 ${recordEnabled ? "" : "opacity-50 pointer-events-none"}`}>
          <Separator />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="recordFormat">Định dạng ghi hình</Label>
                <Select
                  value={typeof pathDefaults.recordFormat === "string" ? pathDefaults.recordFormat : ""}
                  onValueChange={(v) => updateField("recordFormat", v)}
                  disabled={!canUseApi || isSaving}
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
                <Label htmlFor="recordPath">Đường dẫn ghi hình</Label>
                <Input
                  id="recordPath"
                  value={typeof pathDefaults.recordPath === "string" ? pathDefaults.recordPath : ""}
                  onChange={(e) => updateField("recordPath", e.target.value)}
                  disabled={!canUseApi || isSaving}
                  className={fieldErrors.recordPath ? "border-[#cf202f]" : ""}
                />
                <p className="text-xs text-muted-foreground">
                  Biến: %path, %Y %m %d (ngày), %H %M %S (giờ)
                </p>
                {fieldErrors.recordPath && <p className="text-xs text-[#cf202f]">{fieldErrors.recordPath}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="recordPartDuration">Thời lượng part</Label>
                <Input
                  id="recordPartDuration"
                  value={typeof pathDefaults.recordPartDuration === "string" ? pathDefaults.recordPartDuration : ""}
                  onChange={(e) => updateField("recordPartDuration", e.target.value)}
                  disabled={!canUseApi || isSaving}
                  className={fieldErrors.recordPartDuration ? "border-[#cf202f]" : ""}
                />
                {fieldErrors.recordPartDuration && <p className="text-xs text-[#cf202f]">{fieldErrors.recordPartDuration}</p>}
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="recordSegmentDuration">Thời lượng segment</Label>
                <Input
                  id="recordSegmentDuration"
                  value={typeof pathDefaults.recordSegmentDuration === "string" ? pathDefaults.recordSegmentDuration : ""}
                  onChange={(e) => updateField("recordSegmentDuration", e.target.value)}
                  disabled={!canUseApi || isSaving}
                  className={fieldErrors.recordSegmentDuration ? "border-[#cf202f]" : ""}
                />
                {fieldErrors.recordSegmentDuration && <p className="text-xs text-[#cf202f]">{fieldErrors.recordSegmentDuration}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="recordMaxPartSize">Kích thước part tối đa</Label>
                <Input
                  id="recordMaxPartSize"
                  value={typeof pathDefaults.recordMaxPartSize === "string" ? pathDefaults.recordMaxPartSize : ""}
                  onChange={(e) => updateField("recordMaxPartSize", e.target.value)}
                  disabled={!canUseApi || isSaving}
                  placeholder="50M"
                  className={fieldErrors.recordMaxPartSize ? "border-[#cf202f]" : ""}
                />
                <p className="text-xs text-muted-foreground">Định dạng: số + đơn vị (vd: 50M, 100M, 1G)</p>
                {fieldErrors.recordMaxPartSize && <p className="text-xs text-[#cf202f]">{fieldErrors.recordMaxPartSize}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="recordDeleteAfter">Xóa sau</Label>
                <Input
                  id="recordDeleteAfter"
                  value={typeof pathDefaults.recordDeleteAfter === "string" ? pathDefaults.recordDeleteAfter : ""}
                  onChange={(e) => updateField("recordDeleteAfter", e.target.value)}
                  disabled={!canUseApi || isSaving}
                  className={fieldErrors.recordDeleteAfter ? "border-[#cf202f]" : ""}
                />
                <p className="text-xs text-muted-foreground">Đặt 0s để tắt tự động xóa</p>
                {fieldErrors.recordDeleteAfter && <p className="text-xs text-[#cf202f]">{fieldErrors.recordDeleteAfter}</p>}
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <Button
            onClick={showPreview}
            disabled={!canUseApi || isSaving || Object.keys(dirtyCount).length === 0}
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
                  <CardTitle className="text-sm font-medium">Xem trước path defaults patch</CardTitle>
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
              <CardDescription>Payload gửi tới PATCH /v3/config/pathdefaults/patch</CardDescription>
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
