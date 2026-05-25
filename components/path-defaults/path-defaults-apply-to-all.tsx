"use client"

import { useCallback, useState } from "react"
import { CheckCircle2, RefreshCw, Shield, XCircle } from "lucide-react"

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
import { ScrollArea } from "@/components/ui/scroll-area"
import { useNotifications } from "@/components/notification-provider"
import type { DashboardAuditEvent } from "@/lib/dashboard-audit"
import * as api from "@/lib/mediamtx-api"
import type { PathConf } from "@/lib/mediamtx-api"
import { requireMediaMtxAction, type MediaMtxPermissionSet } from "@/lib/mediamtx-permissions"
import { buildApplyDefaultsPayloads, PATH_DEFAULTS_FIELDS } from "@/lib/path-management.mjs"

interface ApplyPreview {
  pathName: string
  patch: Record<string, unknown>
}

interface ApplyResult {
  pathName: string
  success: boolean
  error?: string
}

interface PathDefaultsApplyToAllProps {
  configuredPaths: PathConf[]
  pathDefaults: PathConf | null
  permissions: MediaMtxPermissionSet
  username?: string | null
  appendAuditEvent?: (event: Omit<DashboardAuditEvent, "id" | "timestamp">) => void
  onChanged?: () => void
}

export function PathDefaultsApplyToAll({
  configuredPaths,
  pathDefaults,
  permissions,
  username,
  appendAuditEvent,
  onChanged,
}: PathDefaultsApplyToAllProps) {
  const { notify } = useNotifications()
  const canUseApi = permissions.api !== false

  const [preview, setPreview] = useState<ApplyPreview[] | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isApplying, setIsApplying] = useState(false)
  const [results, setResults] = useState<ApplyResult[] | null>(null)

  const generatePreview = useCallback(() => {
    if (!pathDefaults) return

    const payloads = buildApplyDefaultsPayloads(configuredPaths, pathDefaults)
    const items = payloads.map((p) => ({
      pathName: p.pathName,
      patch: p.patch as Record<string, unknown>,
    }))
    setPreview(items)
    setResults(null)
    setIsDialogOpen(true)
  }, [configuredPaths, pathDefaults])

  const executeApply = useCallback(async () => {
    if (!preview || preview.length === 0) return

    setIsApplying(true)
    const resultsList: ApplyResult[] = []
    let allSucceeded = true

    for (const item of preview) {
      try {
        requireMediaMtxAction(permissions, "api")
        await api.updatePath(item.pathName, item.patch as Partial<PathConf>)
        resultsList.push({ pathName: item.pathName, success: true })
        appendAuditEvent?.({
          actor: username,
          action: "path-defaults.apply-to-all",
          target: item.pathName,
          payloadSummary: JSON.stringify(item.patch),
          result: "success",
        })
      } catch (error) {
        allSucceeded = false
        const errorMsg = api.getMediaMtxErrorMessage(error)
        resultsList.push({ pathName: item.pathName, success: false, error: errorMsg })
        appendAuditEvent?.({
          actor: username,
          action: "path-defaults.apply-to-all",
          target: item.pathName,
          payloadSummary: JSON.stringify(item.patch),
          result: "failure",
          errorSummary: errorMsg,
        })
      }
    }

    setResults(resultsList)

    const successCount = resultsList.filter((r) => r.success).length
    const failCount = resultsList.filter((r) => !r.success).length

    if (allSucceeded) {
      notify({
        type: "success",
        title: "Đã áp dụng defaults cho tất cả path",
        message: `${successCount}/${preview.length} path đã được cập nhật`,
      })
    } else {
      notify({
        type: "error",
        title: "Một số path chưa được cập nhật",
        message: `${successCount} thành công, ${failCount} thất bại`,
      })
    }

    setIsApplying(false)
    await onChanged?.()
  }, [preview, permissions, username, appendAuditEvent, notify, onChanged])

  const handleClose = () => {
    setIsDialogOpen(false)
    setPreview(null)
    setResults(null)
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="text-base">Apply Defaults to All Paths</CardTitle>
              <CardDescription>
                Áp dụng giá trị path defaults hiện tại cho tất cả path đã cấu hình.
                Thao tác này sẽ patch từng path với giá trị defaults tương ứng.
              </CardDescription>
            </div>
            <Button
              onClick={generatePreview}
              disabled={!canUseApi || !pathDefaults || configuredPaths.length === 0}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Xem trước & áp dụng
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {!canUseApi
              ? "Cần quyền api để áp dụng defaults."
              : !pathDefaults
                ? "Chưa có path defaults để áp dụng."
                : configuredPaths.length === 0
                  ? "Chưa có path nào được cấu hình."
                  : `${configuredPaths.length} path sẽ được kiểm tra.`}
          </p>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={(open) => !open && handleClose()}>
        <DialogContent className="max-h-[80vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {results ? "Kết quả áp dụng defaults" : "Xem trước áp dụng defaults"}
            </DialogTitle>
            <DialogDescription>
              {results
                ? `${results.filter((r) => r.success).length} thành công, ${results.filter((r) => !r.success).length} thất bại`
                : preview
                  ? `${preview.length} path sẽ được cập nhật`
                  : "Đang tạo preview..."}
            </DialogDescription>
          </DialogHeader>

          {!results && preview && (
            <ScrollArea className="max-h-[50vh]">
              <div className="space-y-4">
                {preview.map((item) => (
                  <div key={item.pathName} className="rounded-lg border p-4">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="font-medium">{item.pathName}</span>
                      <Badge variant="outline">{Object.keys(item.patch).length} fields</Badge>
                    </div>
                    <pre className="max-h-40 overflow-auto rounded bg-[#0a0b0d] p-3 text-xs text-white">
                      {JSON.stringify(item.patch, null, 2)}
                    </pre>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}

          {results && (
            <ScrollArea className="max-h-[50vh]">
              <div className="space-y-3">
                {results.map((result) => (
                  <div
                    key={result.pathName}
                    className={`flex items-center justify-between rounded-lg border p-3 ${
                      result.success ? "border-[#05b169]/30" : "border-[#cf202f]/30"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {result.success ? (
                        <CheckCircle2 className="h-5 w-5 text-[#05b169]" />
                      ) : (
                        <XCircle className="h-5 w-5 text-[#cf202f]" />
                      )}
                      <div>
                        <p className="font-medium">{result.pathName}</p>
                        {result.error && (
                          <p className="text-sm text-[#cf202f]">{result.error}</p>
                        )}
                      </div>
                    </div>
                    <Badge variant={result.success ? "default" : "destructive"}>
                      {result.success ? "Đã cập nhật" : "Thất bại"}
                    </Badge>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}

          <DialogFooter>
            {!results ? (
              <>
                <Button variant="outline" onClick={handleClose} disabled={isApplying}>
                  Hủy
                </Button>
                <Button onClick={executeApply} disabled={isApplying || !preview || preview.length === 0}>
                  {isApplying
                    ? "Đang áp dụng..."
                    : `Áp dụng cho ${preview?.length || 0} path`}
                </Button>
              </>
            ) : (
              <Button onClick={handleClose}>Đóng</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
