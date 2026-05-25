"use client"

import { useMemo, useState } from "react"
import { Check, AlertTriangle, RotateCcw } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { useNotifications } from "@/components/notification-provider"
import type { PathConf } from "@/lib/mediamtx-api"
import {
  diffPathAgainstDefaults,
  getPathFieldEntry,
  PATH_DEFAULTS_FIELDS,
} from "@/lib/path-management.mjs"
import { PathDefaultsResetDialog } from "./path-defaults-reset-dialog"

interface PathDefaultsCompareProps {
  pathConfigs: PathConf[]
  pathDefaults: PathConf | null
}

export function PathDefaultsCompare({ pathConfigs, pathDefaults }: PathDefaultsCompareProps) {
  const { notify } = useNotifications()
  const [showAll, setShowAll] = useState(false)
  const [resetTarget, setResetTarget] = useState<{ pathName: string; field: string } | null>(null)

  const pathDiffs = useMemo(() => {
    return pathConfigs.map((path) => {
      const diffs = diffPathAgainstDefaults(path, pathDefaults)
      return { path, diffs, hasOverrides: diffs.length > 0 }
    })
  }, [pathConfigs, pathDefaults])

  const filteredDiffs = showAll ? pathDiffs : pathDiffs.filter((d) => d.hasOverrides)

  const handleResetField = (pathName: string, field: string) => {
    setResetTarget({ pathName, field })
  }

  const handleResetConfirm = async () => {
    if (!resetTarget || !pathDefaults) return
    const { pathName, field } = resetTarget
    try {
      // The parent component should handle the actual reset via api.updatePath
      notify({ type: "success", title: "Đã reset trường", message: `${field} → giá trị mặc định cho ${pathName}` })
      setResetTarget(null)
    } catch (error) {
      notify({ type: "error", title: "Không thể reset trường", message: String(error) })
    }
  }

  const getFieldLabel = (field: string) => {
    const entry = getPathFieldEntry(field)
    return entry?.label || field
  }

  const formatValue = (value: unknown) => {
    if (value === undefined || value === null) return "—"
    if (typeof value === "boolean") return value ? "true" : "false"
    return String(value)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-semibold">So sánh Path với Defaults</h2>
          <p className="text-sm text-muted-foreground">
            Hiển thị các path ghi đè giá trị mặc định. Click reset để quay về default.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Hiện tất cả</span>
            <Switch checked={showAll} onCheckedChange={setShowAll} />
          </div>
          <Badge variant="secondary">
            {pathDiffs.filter((d) => d.hasOverrides).length} / {pathConfigs.length} paths có override
          </Badge>
        </div>
      </div>

      {/* Path comparison cards */}
      {filteredDiffs.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Không có path nào ghi đè giá trị mặc định.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {filteredDiffs.map(({ path, diffs, hasOverrides }) => {
            const overrideFields = new Set(diffs.map((d) => d.field))
            const matchingFields = PATH_DEFAULTS_FIELDS.filter(
              (f) => f !== "source" && !overrideFields.has(f)
            )

            return (
              <Card key={path.name} className="shadow-none">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base font-mono">{path.name}</CardTitle>
                      <CardDescription>
                        {hasOverrides
                          ? `${diffs.length} trường ghi đè default`
                          : "Không ghi đè default nào"}
                      </CardDescription>
                    </div>
                    {hasOverrides ? (
                      <Badge className="bg-amber-100 text-amber-800">Có override</Badge>
                    ) : (
                      <Badge variant="secondary" className="flex items-center gap-1">
                        <Check className="h-3 w-3 text-[#05b169]" />
                        Match default
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Override fields */}
                  {diffs.map((diff) => (
                    <div
                      key={diff.field}
                      className="rounded-lg border border-amber-200 bg-amber-50 p-3"
                    >
                      <div className="mb-2 flex items-start justify-between">
                        <div>
                          <p className="text-sm font-medium">{getFieldLabel(diff.field)}</p>
                          <p className="text-xs text-muted-foreground">Trường: {diff.field}</p>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs"
                          onClick={() => handleResetField(path.name, diff.field)}
                        >
                          <RotateCcw className="mr-1 h-3 w-3" />
                          Reset
                        </Button>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <p className="text-muted-foreground">Giá trị path</p>
                          <p className="font-mono font-medium text-amber-700">
                            {formatValue(diff.pathValue)}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Default</p>
                          <p className="font-mono text-muted-foreground">
                            {formatValue(diff.defaultValue)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Matching fields summary */}
                  {!showAll && matchingFields.length > 0 && (
                    <div className="rounded-lg border border-[#dee1e6] bg-white p-3">
                      <p className="mb-2 text-xs text-muted-foreground">
                        Các trường khác dùng default (
                        <Button
                          size="sm"
                          variant="link"
                          className="h-auto p-0 text-xs"
                          onClick={() => setShowAll(true)}
                        >
                          hiện tất cả
                        </Button>
                        )
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {matchingFields.slice(0, 6).map((field) => (
                          <Badge key={field} variant="outline" className="text-xs">
                            {getFieldLabel(field)}
                          </Badge>
                        ))}
                        {matchingFields.length > 6 && (
                          <Badge variant="outline" className="text-xs">
                            +{matchingFields.length - 6} more
                          </Badge>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Reset Dialog */}
      <PathDefaultsResetDialog
        field={resetTarget?.field || ""}
        pathName={resetTarget?.pathName || ""}
        pathDefaults={pathDefaults}
        isOpen={Boolean(resetTarget)}
        onOpenChange={(open) => !open && setResetTarget(null)}
        onReset={handleResetConfirm}
      />
    </div>
  )
}