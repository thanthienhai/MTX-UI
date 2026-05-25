"use client"

import { useCallback, useState } from "react"
import {
  AlertTriangle,
  Trash2,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useNotifications } from "@/components/notification-provider"
import * as api from "@/lib/mediamtx-api"
import { requireMediaMtxAction, type MediaMtxPermissionSet } from "@/lib/mediamtx-permissions"

interface PathDeleteDialogProps {
  pathName: string
  permissions: MediaMtxPermissionSet
  username?: string | null
  isOpen: boolean
  onClose: () => void
  onSuccess: () => Promise<void>
  appendAuditEvent?: (event: { actor: string; action: string; target: string; payloadSummary: string; result: string; errorSummary?: string }) => void
}

export function PathDeleteDialog({
  pathName,
  permissions,
  username,
  isOpen,
  onClose,
  onSuccess,
  appendAuditEvent,
}: PathDeleteDialogProps) {
  const { notify } = useNotifications()
  const canUseApi = permissions.api !== false
  const [isDeleting, setIsDeleting] = useState(false)

  const handleDelete = useCallback(async () => {
    if (!pathName) return

    setIsDeleting(true)
    try {
      requireMediaMtxAction(permissions, "api")
      await api.deletePath(pathName)
      notify({ type: "success", title: "Đã xóa path", message: pathName })
      appendAuditEvent?.({
        actor: username || "unknown",
        action: "path.delete",
        target: pathName,
        payloadSummary: JSON.stringify({ name: pathName }),
        result: "success",
      })
      await onSuccess()
      onClose()
    } catch (error) {
      const message = api.getMediaMtxErrorMessage(error)
      notify({ type: "error", title: "Không thể xóa path", message })
      appendAuditEvent?.({
        actor: username || "unknown",
        action: "path.delete",
        target: pathName,
        payloadSummary: JSON.stringify({ name: pathName }),
        result: "failure",
        errorSummary: message,
      })
    } finally {
      setIsDeleting(false)
    }
  }, [pathName, permissions, username, notify, appendAuditEvent, onSuccess, onClose])

  const handleClose = () => {
    if (!isDeleting) {
      onClose()
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-[#cf202f]" />
            Xóa path
          </DialogTitle>
          <DialogDescription>
            Bạn có chắc muốn xóa path &quot;{pathName}&quot;? Thao tác này không thể hoàn tác.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border border-[#cf202f]/30 bg-[#cf202f]/5 p-4">
          <div className="flex items-start gap-3">
            <Trash2 className="h-5 w-5 text-[#cf202f] shrink-0 mt-0.5" />
            <div className="text-sm text-[#cf202f]">
              <p className="font-medium">Cảnh báo: Thao tác nguy hiểm</p>
              <p className="mt-1">
                Việc xóa path sẽ ngay lập tức ngắt tất cả các reader và publisher đang kết nối.
                Tất cả dữ liệu cấu hình cho path này sẽ bị mất vĩnh viễn.
              </p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isDeleting}>
            Hủy
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={isDeleting || !canUseApi}
            className="bg-[#cf202f] hover:bg-[#a81925]"
          >
            {isDeleting ? (
              <>
                <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Đang xóa...
              </>
            ) : (
              <>
                <Trash2 className="mr-2 h-4 w-4" />
                Xóa path
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}