"use client"

import { RotateCcw } from "lucide-react"

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
import type { PathConf } from "@/lib/mediamtx-api"
import { getPathFieldEntry } from "@/lib/path-management.mjs"

interface PathDefaultsResetDialogProps {
  field: string
  pathName: string
  pathDefaults: PathConf | null
  onReset: (field: string) => void
  isOpen: boolean
  onOpenChange: (open: boolean) => void
}

export function PathDefaultsResetDialog({
  field,
  pathName,
  pathDefaults,
  onReset,
  isOpen,
  onOpenChange,
}: PathDefaultsResetDialogProps) {
  const { notify } = useNotifications()

  const entry = getPathFieldEntry(field)
  const defaultValue = pathDefaults?.[field as keyof PathConf]
  const fieldLabel = entry?.label || field

  const handleReset = () => {
    if (!field || !pathName) return
    try {
      onReset(field)
      notify({
        type: "success",
        title: "Đã reset trường",
        message: `${fieldLabel} của ${pathName} đã reset về default`,
      })
      onOpenChange(false)
    } catch (error) {
      notify({
        type: "error",
        title: "Không thể reset trường",
        message: String(error),
      })
    }
  }

  const formatValue = (value: unknown) => {
    if (value === undefined || value === null) return "—"
    if (typeof value === "boolean") return value ? "true" : "false"
    return String(value)
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RotateCcw className="h-5 w-5" />
            Reset trường về default
          </DialogTitle>
          <DialogDescription>
            Đặt lại trường <strong>{fieldLabel}</strong> của path <strong>{pathName}</strong> về giá trị
            mặc định.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="rounded-lg border bg-muted/50 p-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Trường</p>
                <p className="font-medium">{fieldLabel}</p>
                <p className="text-xs text-muted-foreground">{field}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Giá trị mặc định</p>
                <p className="font-mono font-medium">{formatValue(defaultValue)}</p>
              </div>
            </div>
          </div>

          <p className="text-sm text-muted-foreground">
            Sau khi reset, trường này sẽ dùng giá trị mặc định thay vì giá trị riêng của path.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Hủy
          </Button>
          <Button onClick={handleReset}>
            <RotateCcw className="mr-2 h-4 w-4" />
            Reset về default
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}