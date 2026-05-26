"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { AlertTriangle, Download, Upload, FileText } from "lucide-react"
import { useNotifications } from "@/components/notification-provider"
import * as api from "@/lib/mediamtx-api"
import type { GlobalConf, PathConf } from "@/lib/mediamtx-api"
import { requireMediaMtxAction, type MediaMtxPermissionSet } from "@/lib/mediamtx-permissions"

interface ConfigImportExportProps {
  permissions: MediaMtxPermissionSet
}

interface ExportBundle {
  exportedAt: string
  mediamtxDashboardVersion: 1
  global?: GlobalConf
  pathDefaults?: PathConf
  paths?: PathConf[]
}

interface DiffEntry {
  scope: "global" | "pathDefaults" | "path"
  pathName?: string
  field: string
  current: unknown
  incoming: unknown
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function diffObjects(
  current: Record<string, unknown> | undefined,
  incoming: Record<string, unknown> | undefined,
  scope: DiffEntry["scope"],
  pathName?: string,
): DiffEntry[] {
  const result: DiffEntry[] = []
  const keys = new Set<string>([...Object.keys(current || {}), ...Object.keys(incoming || {})])
  for (const key of keys) {
    const a = current?.[key]
    const b = incoming?.[key]
    if (JSON.stringify(a) !== JSON.stringify(b)) {
      result.push({ scope, pathName, field: key, current: a, incoming: b })
    }
  }
  return result
}

export function ConfigImportExport({ permissions }: ConfigImportExportProps) {
  const { notify } = useNotifications()
  const [busy, setBusy] = useState(false)

  // export selection
  const [exportGlobal, setExportGlobal] = useState(true)
  const [exportPathDefaults, setExportPathDefaults] = useState(true)
  const [exportPaths, setExportPaths] = useState(true)

  // import state
  const [importJson, setImportJson] = useState("")
  const [parsedBundle, setParsedBundle] = useState<ExportBundle | null>(null)
  const [parseError, setParseError] = useState<string | null>(null)
  const [diffs, setDiffs] = useState<DiffEntry[] | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const canRead = requireMediaMtxAction(permissions, "api")

  function diffKey(d: DiffEntry) {
    return `${d.scope}::${d.pathName ?? ""}::${d.field}`
  }

  async function handleExport() {
    if (!canRead) {
      notify({ type: "error", title: "Thiếu quyền", message: "Cần quyền `api`." })
      return
    }
    setBusy(true)
    try {
      const bundle: ExportBundle = {
        exportedAt: new Date().toISOString(),
        mediamtxDashboardVersion: 1,
      }
      if (exportGlobal) bundle.global = await api.getGlobalConfig()
      if (exportPathDefaults) bundle.pathDefaults = await api.getPathDefaults()
      if (exportPaths) bundle.paths = await api.getPathConfigs()

      const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `mediamtx-config-${new Date().toISOString().replace(/[:.]/g, "-")}.json`
      a.click()
      URL.revokeObjectURL(url)
      notify({ type: "success", title: "Đã export config" })
    } catch (e) {
      notify({ type: "error", title: "Export thất bại", message: api.getMediaMtxErrorMessage(e) })
    } finally {
      setBusy(false)
    }
  }

  async function handleParseAndDiff() {
    setParseError(null)
    setDiffs(null)
    setParsedBundle(null)
    let bundle: ExportBundle
    try {
      const parsed = JSON.parse(importJson)
      if (!isObject(parsed)) throw new Error("Root phải là object JSON")
      bundle = parsed as ExportBundle
    } catch (e) {
      setParseError(e instanceof Error ? e.message : String(e))
      return
    }
    setParsedBundle(bundle)

    setBusy(true)
    try {
      const entries: DiffEntry[] = []

      if (bundle.global && isObject(bundle.global)) {
        const current = await api.getGlobalConfig()
        entries.push(...diffObjects(current as Record<string, unknown>, bundle.global as Record<string, unknown>, "global"))
      }
      if (bundle.pathDefaults && isObject(bundle.pathDefaults)) {
        const current = await api.getPathDefaults()
        entries.push(
          ...diffObjects(current as Record<string, unknown>, bundle.pathDefaults as Record<string, unknown>, "pathDefaults"),
        )
      }
      if (Array.isArray(bundle.paths)) {
        const current = await api.getPathConfigs()
        const currentByName = new Map(current.map((p) => [p.name, p]))
        for (const incoming of bundle.paths) {
          if (!incoming?.name) continue
          const existing = currentByName.get(incoming.name)
          entries.push(
            ...diffObjects(
              existing as Record<string, unknown> | undefined,
              incoming as Record<string, unknown>,
              "path",
              incoming.name,
            ),
          )
        }
      }

      setDiffs(entries)
      setSelected(new Set(entries.map(diffKey))) // pre-select all
      if (entries.length === 0) notify({ type: "info", title: "Không có khác biệt" })
    } catch (e) {
      notify({ type: "error", title: "Lỗi tải config hiện tại", message: api.getMediaMtxErrorMessage(e) })
    } finally {
      setBusy(false)
    }
  }

  async function handleApplySelected() {
    if (!diffs || !parsedBundle) return
    if (selected.size === 0) {
      notify({ type: "info", title: "Chưa chọn field nào" })
      return
    }
    setBusy(true)
    try {
      const globalPatch: Record<string, unknown> = {}
      const defaultsPatch: Record<string, unknown> = {}
      const pathPatches = new Map<string, Record<string, unknown>>()

      for (const d of diffs) {
        if (!selected.has(diffKey(d))) continue
        if (d.scope === "global") globalPatch[d.field] = d.incoming
        else if (d.scope === "pathDefaults") defaultsPatch[d.field] = d.incoming
        else if (d.scope === "path" && d.pathName) {
          const patch = pathPatches.get(d.pathName) ?? {}
          patch[d.field] = d.incoming
          pathPatches.set(d.pathName, patch)
        }
      }

      if (Object.keys(globalPatch).length > 0) {
        await api.patchGlobalConfig(globalPatch as Partial<GlobalConf>)
      }
      if (Object.keys(defaultsPatch).length > 0) {
        await api.patchPathDefaults(defaultsPatch as Partial<PathConf>)
      }
      for (const [name, patch] of pathPatches.entries()) {
        const existing = (parsedBundle.paths ?? []).find((p) => p.name === name)
        const current = await api.getPathConfig(name).catch(() => null)
        if (!current && existing) {
          await api.addPath(existing)
        } else {
          await api.updatePath(name, patch as Partial<PathConf>)
        }
      }

      notify({ type: "success", title: "Đã áp dụng config", message: `${selected.size} field` })
      setDiffs(null)
      setParsedBundle(null)
      setImportJson("")
    } catch (e) {
      notify({ type: "error", title: "Apply thất bại", message: api.getMediaMtxErrorMessage(e) })
    } finally {
      setBusy(false)
    }
  }

  function toggle(key: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    file.text().then((text) => {
      setImportJson(text)
    })
  }

  function renderValue(v: unknown) {
    if (v === undefined) return <span className="text-muted-foreground italic">undefined</span>
    if (v === null) return <span className="text-muted-foreground italic">null</span>
    if (typeof v === "string") return <span className="font-mono">"{v}"</span>
    if (typeof v === "number" || typeof v === "boolean") return <span className="font-mono">{String(v)}</span>
    return <span className="font-mono text-xs">{JSON.stringify(v)}</span>
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Download className="h-4 w-4" /> Export config
          </CardTitle>
          <CardDescription>Tải toàn bộ config dashboard (global, path defaults, paths) ra một file JSON.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Switch checked={exportGlobal} onCheckedChange={setExportGlobal} />
              <Label className="text-sm">Global config</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={exportPathDefaults} onCheckedChange={setExportPathDefaults} />
              <Label className="text-sm">Path defaults</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={exportPaths} onCheckedChange={setExportPaths} />
              <Label className="text-sm">Paths</Label>
            </div>
          </div>
          <Button onClick={handleExport} disabled={busy || !canRead}>
            <Download className="mr-2 h-4 w-4" /> Tải JSON
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Upload className="h-4 w-4" /> Import config
          </CardTitle>
          <CardDescription>Nạp JSON và xem khác biệt với config hiện tại trước khi apply.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              Khuyến nghị <strong>Export</strong> backup config hiện tại trước khi apply import — để có thể rollback nếu cần.
            </p>
          </div>

          <div className="space-y-2">
            <Label className="text-sm">File JSON</Label>
            <Input type="file" accept="application/json,.json" onChange={handleFile} />
          </div>
          <div className="space-y-2">
            <Label className="text-sm">Hoặc dán JSON</Label>
            <Textarea
              value={importJson}
              onChange={(e) => setImportJson(e.target.value)}
              className="min-h-[140px] font-mono text-xs"
              placeholder='{ "global": {...}, "paths": [...] }'
            />
          </div>

          {parseError && (
            <div className="rounded-md border border-red-200 bg-red-50 p-2 text-sm text-red-800">
              JSON không hợp lệ: {parseError}
            </div>
          )}

          <div className="flex gap-2">
            <Button onClick={handleParseAndDiff} disabled={busy || !importJson.trim() || !canRead} variant="outline">
              <FileText className="mr-2 h-4 w-4" /> Diff
            </Button>
            <Button onClick={handleApplySelected} disabled={busy || !diffs || diffs.length === 0 || !canRead}>
              Apply {selected.size} field đã chọn
            </Button>
          </div>

          {diffs && diffs.length > 0 && (
            <>
              <Separator />
              <div className="space-y-2 max-h-[420px] overflow-y-auto">
                <div className="text-sm font-medium">
                  {diffs.length} field khác biệt
                </div>
                {diffs.map((d) => {
                  const key = diffKey(d)
                  const isChecked = selected.has(key)
                  return (
                    <div
                      key={key}
                      className="rounded-md border p-2 text-xs"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggle(key)}
                            className="h-3.5 w-3.5"
                          />
                          <Badge variant="outline" className="text-[10px]">
                            {d.scope}
                            {d.pathName ? ` · ${d.pathName}` : ""}
                          </Badge>
                          <span className="font-mono">{d.field}</span>
                        </div>
                      </div>
                      <div className="mt-1 grid grid-cols-2 gap-2 pl-6">
                        <div>
                          <div className="text-[10px] uppercase text-muted-foreground">hiện tại</div>
                          {renderValue(d.current)}
                        </div>
                        <div>
                          <div className="text-[10px] uppercase text-muted-foreground">import</div>
                          {renderValue(d.incoming)}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default ConfigImportExport
