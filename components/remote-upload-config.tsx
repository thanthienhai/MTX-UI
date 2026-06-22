"use client"

import { useCallback, useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Copy, Save, AlertTriangle, Info } from "lucide-react"
import { copyToClipboard } from "@/lib/clipboard"
import { useNotifications } from "@/components/notification-provider"
import type { MediaMtxPermissionSet } from "@/lib/mediamtx-permissions"

const STORAGE_KEY = "mtx-ui-remote-upload-command"

const DEFAULT_COMMAND = `# Upload segment lên remote storage bằng rclone
# Biến môi trường MediaMTX có sẵn:
#   $MTX_PATH - tên path
#   $MTX_RECORD_PATH - đường dẫn file ghi hình
#   $MTX_RECORD_FORMAT - định dạng ghi hình
#   $MTX_RECORD_SEGMENT_DURATION - thời lượng segment

rclone copy "$MTX_RECORD_PATH" "remote:stream-recordings/$MTX_PATH"`

interface RemoteUploadConfigProps {
  permissions: MediaMtxPermissionSet
}

export function RemoteUploadConfig({ permissions }: RemoteUploadConfigProps) {
  const { notify } = useNotifications()
  const [command, setCommand] = useState("")
  const [savedCommand, setSavedCommand] = useState("")
  const [isCopied, setIsCopied] = useState(false)
  const canUseApi = permissions.api !== false

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      setCommand(stored)
      setSavedCommand(stored)
    } else {
      setCommand(DEFAULT_COMMAND)
      setSavedCommand(DEFAULT_COMMAND)
    }
  }, [])

  const handleSave = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, command)
    setSavedCommand(command)
    notify({ type: "success", title: "Đã lưu command upload", message: "Command upload từ xa đã được lưu (local)." })
  }, [command, notify])

  const handleCopy = useCallback(async () => {
    const ok = await copyToClipboard(command)
    if (ok) {
      setIsCopied(true)
      notify({ type: "success", title: "Đã sao chép", message: "Command đã được sao chép vào clipboard." })
      setTimeout(() => setIsCopied(false), 2000)
    } else {
      notify({ type: "error", title: "Không thể sao chép", message: "Trình duyệt không hỗ trợ sao chép." })
    }
  }, [command, notify])

  const handleReset = useCallback(() => {
    setCommand(DEFAULT_COMMAND)
    localStorage.removeItem(STORAGE_KEY)
    setSavedCommand("")
    notify({ type: "info", title: "Đã đặt lại", message: "Command upload đã được đặt về mặc định." })
  }, [notify])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Upload từ xa (rclone)</CardTitle>
        <CardDescription>
          Cấu hình command cho hook <code className="text-xs bg-gray-100 px-1 rounded">runOnRecordSegmentComplete</code> để upload segment lên remote storage.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <div className="space-y-1 text-sm text-amber-800">
              <p><strong>Cảnh báo filesystem:</strong> MediaMTX cần quyền ghi filesystem để tạo file ghi hình. Hook <code className="text-xs bg-amber-100 px-1 rounded">runOnRecordSegmentComplete</code> chạy với quyền của process MediaMTX.</p>
              <p><strong>Cảnh báo bảo mật:</strong> Hook command chạy với quyền MediaMTX. Không nhúng secret/password trực tiếp vào command. Sử dụng environment variables hoặc file cấu hình riêng.</p>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Info className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              Biến môi trường MediaMTX có sẵn trong hook:
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <code className="bg-gray-100 px-2 py-1 rounded text-xs">$MTX_PATH</code>
            <span className="text-xs text-muted-foreground">Tên path</span>
            <code className="bg-gray-100 px-2 py-1 rounded text-xs">$MTX_RECORD_PATH</code>
            <span className="text-xs text-muted-foreground">Đường dẫn file ghi hình</span>
            <code className="bg-gray-100 px-2 py-1 rounded text-xs">$MTX_RECORD_FORMAT</code>
            <span className="text-xs text-muted-foreground">Định dạng ghi hình (fmp4/mpegts)</span>
            <code className="bg-gray-100 px-2 py-1 rounded text-xs">$MTX_RECORD_SEGMENT_DURATION</code>
            <span className="text-xs text-muted-foreground">Thời lượng segment</span>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="upload-command">Command</Label>
          <Textarea
            id="upload-command"
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            className="min-h-[160px] font-mono text-xs"
            placeholder={DEFAULT_COMMAND}
            disabled={!canUseApi}
          />
          <p className="text-xs text-muted-foreground">
            Lưu command vào localStorage trình duyệt. Command này không được đồng bộ lên máy chủ.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={handleSave} disabled={!canUseApi}>
            <Save className="mr-2 h-4 w-4" />
            Lưu command
          </Button>
          <Button variant="outline" onClick={handleCopy}>
            <Copy className="mr-2 h-4 w-4" />
            {isCopied ? "Đã sao chép" : "Sao chép command"}
          </Button>
          <Button variant="ghost" size="sm" onClick={handleReset}>
            Đặt lại mặc định
          </Button>
          {savedCommand && (
            <span className="text-xs text-green-600">Đã lưu (local)</span>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function Label({ children, htmlFor }: { children: import("react").ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
      {children}
    </label>
  )
}
