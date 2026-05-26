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
import { AlertTriangle, Download, Upload, FileText, Info } from "lucide-react"
import { useNotifications } from "@/components/notification-provider"
import * as api from "@/lib/mediamtx-api"
import type { GlobalConf, PathConf } from "@/lib/mediamtx-api"
import { requireMediaMtxAction, type MediaMtxPermissionSet } from "@/lib/mediamtx-permissions"
import { isObject, diffObjects, buildApplyPlan } from "@/lib/config-diff.mjs"

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
  /** True if the entry belongs to a path that does NOT exist locally yet. */
  newPath?: boolean
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

      // Fetch all three scopes in parallel; only what bundle actually contains
      const [currentGlobal, currentDefaults, currentPaths] = await Promise.all([
        bundle.global && isObject(bundle.global) ? api.getGlobalConfig() : Promise.resolve(null),
        bundle.pathDefaults && isObject(bundle.pathDefaults) ? api.getPathDefaults() : Promise.resolve(null),
        Array.isArray(bundle.paths) ? api.getPathConfigs() : Promise.resolve([] as PathConf[]),
      ])

      if (bundle.global && isObject(bundle.global) && currentGlobal) {
        entries.push(...diffObjects(currentGlobal as Record<string, unknown>, bundle.global as Record<string, unknown>, "global"))
      }
      if (bundle.pathDefaults && isObject(bundle.pathDefaults) && currentDefaults) {
        entries.push(
          ...diffObjects(currentDefaults as Record<string, unknown>, bundle.pathDefaults as Record<string, unknown>, "pathDefaults"),
        )
      }
      if (Array.isArray(bundle.paths)) {
        const currentByName = new Map(currentPaths.map((p) => [p.name, p]))
        for (const incoming of bundle.paths) {
          if (!incoming?.name) continue
          const existing = currentByName.get(incoming.name)
          const isNew = !existing
          const pathEntries = diffObjects(
            existing as Record<string, unknown> | undefined,
            incoming as Record<string, unknown>,
            "path",
            incoming.name,
          )
          for (const e of pathEntries) e.newPath = isNew
          entries.push(...pathEntries)
        }
      }

      setDiffs(entries)
      // Pre-select all. New-path entries are forced selected (path is added
      // atomically below) but the UI shows them as disabled checkboxes.
      setSelected(new Set(entries.map(diffKey)))
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
      const plan = buildApplyPlan(diffs, selected, diffKey)

      if (Object.keys(plan.globalPatch).length > 0) {
        await api.patchGlobalConfig(plan.globalPatch as Partial<GlobalConf>)
      }
      if (Object.keys(plan.defaultsPatch).length > 0) {
        await api.patchPathDefaults(plan.defaultsPatch as Partial<PathConf>)
      }
      for (const [name, patch] of plan.pathPatches.entries()) {
        if (plan.newPaths.has(name)) {
          const incoming = (parsedBundle.paths ?? []).find((p) => p.name === name)
          if (!incoming) continue
          await api.addPath(incoming)
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
                {diffs.some((d) => d.newPath) && (
                  <div className="flex items-start gap-2 rounded-md border border-blue-200 bg-blue-50 p-2 text-xs text-blue-800">
                    <Info className="mt-0.5 h-3.5 w-3.5" />
                    <span>
                      Các entry được tag <strong>NEW</strong> thuộc path chưa tồn tại — sẽ được add nguyên vẹn (`addPath`),
                      không thể chọn từng field. Path đã tồn tại vẫn cho phép apply chọn lọc qua `updatePath`.
                    </span>
                  </div>
                )}
                {diffs.some((d) => d.incoming === undefined) && (
                  <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5" />
                    <span>
                      Một số field có ở config hiện tại nhưng thiếu trong import. Apply <strong>không xoá</strong> các field
                      này khỏi backend — MediaMTX PATCH bỏ qua key không gửi. Để reset, dùng UI tương ứng (Path Edit, Global
                      Config) hoặc Replace path.
                    </span>
                  </div>
                )}
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
                            checked={d.newPath ? true : isChecked}
                            onChange={() => toggle(key)}
                            disabled={!!d.newPath}
                            title={d.newPath ? "Path mới được add nguyên vẹn, không thể chọn từng field" : undefined}
                            className="h-3.5 w-3.5 disabled:opacity-50"
                          />
                          <Badge variant="outline" className="text-[10px]">
                            {d.scope}
                            {d.pathName ? ` · ${d.pathName}` : ""}
                          </Badge>
                          {d.newPath && (
                            <Badge variant="outline" className="bg-blue-50 text-blue-700 text-[10px]">NEW</Badge>
                          )}
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
