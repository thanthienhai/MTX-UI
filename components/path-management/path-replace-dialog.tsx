"use client"

import { useCallback, useMemo, useState } from "react"
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  RefreshCw,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
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
import * as api from "@/lib/mediamtx-api"
import type { PathConf } from "@/lib/mediamtx-api"
import { requireMediaMtxAction, type MediaMtxPermissionSet } from "@/lib/mediamtx-permissions"
import { buildReplacePayload } from "@/lib/path-management.mjs"

interface PathReplaceDialogProps {
  path: PathConf
  permissions: MediaMtxPermissionSet
  username?: string | null
  isOpen: boolean
  onClose: () => void
  onSuccess: () => Promise<void>
  appendAuditEvent?: (event: { actor: string; action: string; target: string; payloadSummary: string; result: string; errorSummary?: string }) => void
}

export function PathReplaceDialog({
  path,
  permissions,
  username,
  isOpen,
  onClose,
  onSuccess,
  appendAuditEvent,
}: PathReplaceDialogProps) {
  const { notify } = useNotifications()
  const canUseApi = permissions.api !== false
  const canPublish = permissions.publish !== false
  const [isReplacing, setIsReplacing] = useState(false)

  // Build the replace payload from the current path config
  const payload = useMemo(() => buildReplacePayload(path), [path])

  const handleReplace = useCallback(async () => {
    if (!path?.name) return

    setIsReplacing(true)
    try {
      requireMediaMtxAction(permissions, "api")
      requireMediaMtxAction(permissions, "publish")
      await api.replacePath(path.name, payload as PathConf)
      notify({ type: "success", title: "Đã thay thế path", message: path.name })
      appendAuditEvent?.({
        actor: username || "unknown",
        action: "path.replace",
        target: path.name,
        payloadSummary: JSON.stringify(payload),
        result: "success",
      })
      await onSuccess()
      onClose()
    } catch (error) {
      const message = api.getMediaMtxErrorMessage(error)
      notify({ type: "error", title: "Không thể thay thế path", message })
      appendAuditEvent?.({
        actor: username || "unknown",
        action: "path.replace",
        target: path.name,
        payloadSummary: JSON.stringify(payload),
        result: "failure",
        errorSummary: message,
      })
    } finally {
      setIsReplacing(false)
    }
  }, [path, payload, permissions, username, notify, appendAuditEvent, onSuccess, onClose])

  const handleClose = () => {
    if (!isReplacing) {
      onClose()
    }
  }

  // Format the payload for display
  const formattedPayload = useMemo(() => {
    return JSON.stringify(payload, null, 2)
  }, [payload])

  // Count the fields in the payload
  const fieldCount = Object.keys(payload).length

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5 text-[#0052ff]" />
            Thay thế path
          </DialogTitle>
          <DialogDescription>
            Xem trước payload sẽ được gửi để thay thế path &quot;{path?.name}&quot;.
            Thao tác này sẽ ghi đè toàn bộ cấu hình hiện tại.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden space-y-4">
          {/* Path Info */}
          <div className="rounded-lg border bg-[#f7f7f7] p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Path sẽ được thay thế:</p>
                <p className="font-mono text-lg font-semibold">{path?.name}</p>
              </div>
              <Badge variant="outline" className="text-xs">
                {fieldCount} field{fieldCount !== 1 ? "s" : ""}
              </Badge>
            </div>
          </div>

          {/* Warning */}
          <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
            <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-sm text-amber-800">
              <p className="font-medium">Lưu ý quan trọng</p>
              <ul className="mt-1 list-disc list-inside space-y-1">
                <li>Replace operation ghi đè toàn bộ cấu hình path</li>
                <li>Tất cả các trường không được include sẽ được reset về mặc định</li>
                <li>Các reader đang kết nối có thể bị ngắt tạm thời</li>
              </ul>
            </div>
          </div>

          {/* Payload Preview */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Payload Preview</Label>
              <Badge variant="secondary" className="text-xs">JSON</Badge>
            </div>
            <ScrollArea className="h-[300px] w-full rounded-lg border bg-[#0a0b0d] p-4">
              <pre className="text-xs text-white font-mono whitespace-pre-wrap break-all">
                {formattedPayload}
              </pre>
            </ScrollArea>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isReplacing}>
            Hủy
          </Button>
          <Button
            onClick={handleReplace}
            disabled={isReplacing || !canUseApi || !canPublish}
            className="bg-[#0052ff] hover:bg-[#003ecc]"
          >
            {isReplacing ? (
              <>
                <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Đang thay thế...
              </>
            ) : (
              <>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Thay thế path
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// Label component helper
function Label({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-sm font-medium text-[#0a0b0d]">{children}</span>
  )
}