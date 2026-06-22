"use client"

import { useCallback, useRef, useState } from "react"
import { Copy, Download, Shield, Upload } from "lucide-react"

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
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { useNotifications } from "@/components/notification-provider"
import type { DashboardAuditEvent } from "@/lib/dashboard-audit"
import * as api from "@/lib/mediamtx-api"
import type { PathConf } from "@/lib/mediamtx-api"
import { requireMediaMtxAction, type MediaMtxPermissionSet } from "@/lib/mediamtx-permissions"
import { copyToClipboard } from "@/lib/clipboard"
import {
  exportDefaultsAsJson,
  exportDefaultsAsYaml,
  parseDefaultsJson,
  parseDefaultsYaml,
  validateImportedDefaults,
  buildImportPreviewPayload,
} from "@/lib/path-management.mjs"

interface PathDefaultsImportExportProps {
  pathDefaults: PathConf | null
  permissions: MediaMtxPermissionSet
  username?: string | null
  appendAuditEvent?: (event: Omit<DashboardAuditEvent, "id" | "timestamp">) => void
  onChanged?: () => void
}

export function PathDefaultsImportExport({
  pathDefaults,
  permissions,
  username,
  appendAuditEvent,
  onChanged,
}: PathDefaultsImportExportProps) {
  const { notify } = useNotifications()
  const canUseApi = permissions.api !== false
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [importMode, setImportMode] = useState<"json" | "yaml">("json")
  const [importText, setImportText] = useState("")
  const [importPreview, setImportPreview] = useState<{
    changed: Record<string, { from: unknown; to: unknown }>
    unchanged: string[]
  } | null>(null)
  const [importErrors, setImportErrors] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string> | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isApplying, setIsApplying] = useState(false)

  const handleExportJson = useCallback(() => {
    if (!pathDefaults) {
      notify({ type: "info", title: "Chưa có path defaults để export" })
      return
    }
    const json = exportDefaultsAsJson(pathDefaults, true)
    const blob = new Blob([json], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "path-defaults.json"
    a.click()
    URL.revokeObjectURL(url)
    notify({ type: "success", title: "Đã export JSON", message: "path-defaults.json" })
  }, [pathDefaults, notify])

  const handleExportYaml = useCallback(() => {
    if (!pathDefaults) {
      notify({ type: "info", title: "Chưa có path defaults để export" })
      return
    }
    const yaml = exportDefaultsAsYaml(pathDefaults)
    const blob = new Blob([yaml], { type: "text/yaml" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "path-defaults.yaml"
    a.click()
    URL.revokeObjectURL(url)
    notify({ type: "success", title: "Đã export YAML", message: "path-defaults.yaml" })
  }, [pathDefaults, notify])

  const handleCopyJson = useCallback(async () => {
    if (!pathDefaults) return
    const json = exportDefaultsAsJson(pathDefaults, true)
    const ok = await copyToClipboard(json)
    if (ok) {
      notify({ type: "success", title: "Đã copy JSON", message: "Path defaults copied to clipboard" })
    } else {
      notify({ type: "error", title: "Không thể copy", message: "Clipboard API không khả dụng" })
    }
  }, [pathDefaults, notify])

  const handlePreviewImport = useCallback(() => {
    if (!importText.trim()) {
      setImportErrors("Vui lòng nhập dữ liệu cần import")
      return
    }

    setImportErrors(null)
    setFieldErrors(null)

    const parse = importMode === "json" ? parseDefaultsJson : parseDefaultsYaml
    const result = parse(importText.trim())

    if (!result.ok) {
      setImportErrors(result.error)
      return
    }

    const validated = validateImportedDefaults(result.data)
    if (!validated.ok) {
      setImportErrors(validated.error)
      setFieldErrors(validated.fieldErrors || null)
      return
    }

    const preview = buildImportPreviewPayload(result.data, pathDefaults ?? ({} as PathConf))
    setImportPreview(preview)
    setImportErrors(null)
  }, [importText, importMode, pathDefaults])

  const handleApplyImport = useCallback(async () => {
    if (!importPreview) return

    setIsApplying(true)
    try {
      requireMediaMtxAction(permissions, "api")

      const patch: Record<string, unknown> = {}
      for (const [field, change] of Object.entries(importPreview.changed)) {
        patch[field] = change.to
      }

      await api.patchPathDefaults(patch as Partial<PathConf>)
      notify({ type: "success", title: "Đã import path defaults", message: `${Object.keys(patch).length} fields updated` })
      appendAuditEvent?.({
        actor: username,
        action: "path-defaults.import",
        target: "pathDefaults",
        payloadSummary: JSON.stringify(patch),
        result: "success",
      })
      setIsDialogOpen(false)
      setImportPreview(null)
      setImportText("")
      await onChanged?.()
    } catch (error) {
      const errorMsg = api.getMediaMtxErrorMessage(error)
      notify({ type: "error", title: "Import thất bại", message: errorMsg })
      appendAuditEvent?.({
        actor: username,
        action: "path-defaults.import",
        target: "pathDefaults",
        result: "failure",
        errorSummary: errorMsg,
      })
    } finally {
      setIsApplying(false)
    }
  }, [importPreview, permissions, username, appendAuditEvent, notify, onChanged])

  const handleFileImport = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return

      const reader = new FileReader()
      reader.onload = (event) => {
        const content = event.target?.result as string
        if (file.name.endsWith(".json")) {
          setImportMode("json")
        } else if (file.name.endsWith(".yaml") || file.name.endsWith(".yml")) {
          setImportMode("yaml")
        }
        setImportText(content)
        setIsDialogOpen(true)
      }
      reader.readAsText(file)
      // Reset input so same file can be re-selected
      if (fileInputRef.current) fileInputRef.current.value = ""
    },
    [],
  )

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Import/Export Path Defaults</CardTitle>
          <CardDescription>
            Xuất hoặc nhập path defaults dưới dạng JSON hoặc YAML.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Export */}
          <div>
            <Label className="mb-2 block text-sm font-medium">Export</Label>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={handleExportJson}
                disabled={!pathDefaults}
              >
                <Download className="mr-2 h-4 w-4" />
                Export JSON
              </Button>
              <Button
                variant="outline"
                onClick={handleExportYaml}
                disabled={!pathDefaults}
              >
                <Download className="mr-2 h-4 w-4" />
                Export YAML
              </Button>
              <Button
                variant="outline"
                onClick={handleCopyJson}
                disabled={!pathDefaults}
              >
                <Copy className="mr-2 h-4 w-4" />
                Copy JSON
              </Button>
            </div>
          </div>

          <div className="border-t pt-4">
            <Label className="mb-2 block text-sm font-medium">Import</Label>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setImportText("")
                  setImportErrors(null)
                  setImportPreview(null)
                  setIsDialogOpen(true)
                }}
                disabled={!canUseApi}
              >
                <Upload className="mr-2 h-4 w-4" />
                Import từ text
              </Button>
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={!canUseApi}
              >
                <Upload className="mr-2 h-4 w-4" />
                Import từ file
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,.yaml,.yml"
                className="hidden"
                onChange={handleFileImport}
              />
            </div>
            {!canUseApi && (
              <p className="mt-2 text-sm text-[#cf202f]">
                <Shield className="mr-1 inline h-3 w-3" />
                Cần quyền api để import path defaults.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={(open) => !open && (setIsDialogOpen(false), setImportPreview(null), setImportErrors(null), setFieldErrors(null))}>
        <DialogContent className="max-h-[80vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Import Path Defaults</DialogTitle>
            <DialogDescription>
              Dán JSON hoặc YAML path defaults vào ô bên dưới để xem trước và áp dụng.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <Tabs value={importMode} onValueChange={(v) => setImportMode(v as "json" | "yaml")}>
              <TabsList>
                <TabsTrigger value="json">JSON</TabsTrigger>
                <TabsTrigger value="yaml">YAML</TabsTrigger>
              </TabsList>
              <TabsContent value="json" className="space-y-2">
                <Textarea
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                  placeholder='{"maxReaders": 10, "record": true}'
                  className="min-h-[150px] font-mono text-sm"
                />
              </TabsContent>
              <TabsContent value="yaml" className="space-y-2">
                <Textarea
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                  placeholder="maxReaders: 10\nrecord: true"
                  className="min-h-[150px] font-mono text-sm"
                />
              </TabsContent>
            </Tabs>

            {importErrors && (
              <div className="rounded-lg border border-[#cf202f]/30 bg-[#cf202f]/5 p-3 text-sm text-[#cf202f]">
                {importErrors}
                {fieldErrors && (
                  <ul className="mt-2 list-inside list-disc">
                    {Object.entries(fieldErrors).map(([field, msg]) => (
                      <li key={field}>
                        <span className="font-medium">{field}:</span> {msg}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {importPreview && (
              <div className="space-y-4">
                {Object.keys(importPreview.changed).length > 0 ? (
                  <div>
                    <Label className="mb-2 block text-sm font-medium">Fields sẽ thay đổi</Label>
                    <ScrollArea className="max-h-60">
                      <div className="space-y-2">
                        {Object.entries(importPreview.changed).map(([field, change]) => (
                          <div
                            key={field}
                            className="flex items-center justify-between rounded-lg border p-2 text-sm"
                          >
                            <span className="font-medium">{field}</span>
                            <div className="flex items-center gap-2 text-xs">
                              <span className="text-muted-foreground line-through">
                                {JSON.stringify(change.from)}
                              </span>
                              <span className="text-[#0052ff]">→</span>
                              <span className="font-mono text-[#05b169]">
                                {JSON.stringify(change.to)}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Không có thay đổi nào so với path defaults hiện tại.
                  </p>
                )}

                {importPreview.unchanged.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {importPreview.unchanged.length} field(s) giống với defaults hiện tại (bỏ qua).
                  </p>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsDialogOpen(false)
                setImportPreview(null)
                setImportErrors(null)
                setFieldErrors(null)
              }}
            >
              Hủy
            </Button>
            {!importPreview ? (
              <Button onClick={handlePreviewImport} disabled={!importText.trim()}>
                Xem trước
              </Button>
            ) : (
              <Button
                onClick={handleApplyImport}
                disabled={isApplying || Object.keys(importPreview.changed).length === 0}
              >
                {isApplying ? "Đang áp dụng..." : "Áp dụng import"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
