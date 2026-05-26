"use client"

import { useState, useCallback, useEffect } from "react"
import { AlertTriangle } from "lucide-react"
import { Switch } from "@/components/ui/switch"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

type ForwardTarget = "rtsp" | "rtmp" | "srt" | "hls"

interface ForwardingConfigProps {
  command: string
  restart: boolean
  onCommandChange: (command: string) => void
  onRestartChange: (restart: boolean) => void
  pathName: string
}

const TARGET_OPTIONS: Array<{ value: ForwardTarget; label: string; placeholder: string }> = [
  { value: "rtsp", label: "RTSP", placeholder: "rtsp://target-server:8554/stream" },
  { value: "rtmp", label: "RTMP", placeholder: "rtmp://target-server/live/stream" },
  { value: "srt", label: "SRT", placeholder: "srt://target-server:9000?streamid=publish:stream" },
  { value: "hls", label: "HLS/HTTP", placeholder: "http://target-server:8888/stream.m3u8" },
]

function generateForwardCommand(protocol: ForwardTarget, targetUrl: string, pathName: string): string {
  const inputUrl = `rtsp://localhost:8554/${pathName}`
  switch (protocol) {
    case "rtsp":
      return `ffmpeg -i ${inputUrl} -c copy -f rtsp "${targetUrl}"`
    case "rtmp":
      return `ffmpeg -i ${inputUrl} -c copy -f flv "${targetUrl}"`
    case "srt":
      return `ffmpeg -i ${inputUrl} -c copy -f mpegts "${targetUrl}"`
    case "hls":
      return `ffmpeg -i ${inputUrl} -c copy -f hls -hls_time 6 -hls_list_size 4 "${targetUrl}"`
  }
}

function extractTargetProtocol(command: string): ForwardTarget | null {
  if (command.includes("-f rtsp")) return "rtsp"
  if (command.includes("-f flv")) return "rtmp"
  if (command.includes("-f mpegts")) return "srt"
  if (command.includes("-f hls")) return "hls"
  return null
}

function extractTargetUrl(command: string): string {
  // Try to find a quoted URL at the end of the command
  const quotedMatch = command.match(/"([^"]+)"$/)
  if (quotedMatch) return quotedMatch[1]

  // Try to find an unquoted URL at the end (after the last space)
  const parts = command.trim().split(/\s+/)
  const last = parts[parts.length - 1]
  if (last && (last.startsWith("rtsp://") || last.startsWith("rtmp://") || last.startsWith("srt://") || last.startsWith("http://") || last.startsWith("https://"))) {
    return last
  }

  return ""
}

export function ForwardingConfig({
  command,
  restart,
  onCommandChange,
  onRestartChange,
  pathName,
}: ForwardingConfigProps) {
  const enabled = command.length > 0

  const [targetProtocol, setTargetProtocol] = useState<ForwardTarget>(() => extractTargetProtocol(command) || "rtsp")
  const [targetUrl, setTargetUrl] = useState(() => extractTargetUrl(command))

  // Sync UI fields from command on external change
  useEffect(() => {
    const proto = extractTargetProtocol(command)
    if (proto) setTargetProtocol(proto)
    const url = extractTargetUrl(command)
    if (url) setTargetUrl(url)
  }, [command])

  const handleEnabledChange = useCallback(
    (isEnabled: boolean) => {
      if (!isEnabled) {
        onCommandChange("")
      } else {
        onCommandChange(generateForwardCommand(targetProtocol, targetUrl || TARGET_OPTIONS[0].placeholder, pathName))
      }
    },
    [onCommandChange, targetProtocol, targetUrl, pathName],
  )

  const handleProtocolChange = useCallback(
    (protocol: ForwardTarget) => {
      setTargetProtocol(protocol)
      if (enabled) {
        const url = targetUrl || TARGET_OPTIONS.find((o) => o.value === protocol)?.placeholder || ""
        onCommandChange(generateForwardCommand(protocol, url, pathName))
      }
    },
    [enabled, onCommandChange, targetUrl, pathName],
  )

  const handleTargetUrlChange = useCallback(
    (url: string) => {
      setTargetUrl(url)
      if (enabled && url) {
        onCommandChange(generateForwardCommand(targetProtocol, url, pathName))
      }
    },
    [enabled, onCommandChange, targetProtocol, pathName],
  )

  const currentPlaceholder = TARGET_OPTIONS.find((o) => o.value === targetProtocol)?.placeholder || ""

  return (
    <div className="space-y-4">
      <div className="flex items-center space-x-2">
        <Switch checked={enabled} onCheckedChange={handleEnabledChange} />
        <Label>Bật forward stream (FFmpeg)</Label>
      </div>

      {enabled && (
        <div className="ml-6 space-y-4">
          {/* Security warning */}
          <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-medium">Yêu cầu FFmpeg</p>
              <p className="mt-1 text-amber-700">
                Forward cần FFmpeg trên server MediaMTX. Command chạy với quyền của process MediaMTX.
                Không sử dụng command từ nguồn không tin cậy.
              </p>
            </div>
          </div>

          {/* Target protocol */}
          <div className="space-y-2">
            <Label htmlFor="forwardProtocol">Giao thức đích</Label>
            <Select value={targetProtocol} onValueChange={(v) => handleProtocolChange(v as ForwardTarget)}>
              <SelectTrigger id="forwardProtocol" className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TARGET_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {targetProtocol === "rtsp" && "Tối ưu cho server MediaMTX hoặc RTSP khác. Độ trễ thấp nhất."}
              {targetProtocol === "rtmp" && "Tương thích với Facebook Live, YouTube, Twitch, và RTMP server."}
              {targetProtocol === "srt" && "Phù hợp mạng không ổn định. Hỗ trợ truyền lại gói tin."}
              {targetProtocol === "hls" && "Phân phối qua HTTP. Độ trễ cao hơn nhưng tương thích trình duyệt."}
            </p>
          </div>

          {/* Target URL */}
          <div className="space-y-2">
            <Label htmlFor="forwardTargetUrl">URL đích</Label>
            <Input
              id="forwardTargetUrl"
              value={targetUrl}
              onChange={(e) => handleTargetUrlChange(e.target.value)}
              placeholder={currentPlaceholder}
            />
            <p className="text-xs text-muted-foreground">
              Địa chỉ server đích. Protocol phải khớp với giao thức đã chọn.
            </p>
          </div>

          {/* runOnReadyRestart */}
          <div className="flex items-center space-x-2">
            <Switch checked={restart} onCheckedChange={onRestartChange} />
            <Label>Tự động khởi động lại nếu lệnh thoát</Label>
          </div>
          <p className="text-xs text-muted-foreground ml-6">
            MediaMTX sẽ khởi động lại FFmpeg nếu process bị thoát hoặc gặp lỗi.
          </p>

          {/* Editable command */}
          <div className="space-y-2">
            <Label htmlFor="forwardCommand">FFmpeg command (runOnReady)</Label>
            <Textarea
              id="forwardCommand"
              value={command}
              onChange={(e) => onCommandChange(e.target.value)}
              className="min-h-[60px] font-mono text-xs"
              placeholder={`ffmpeg -i rtsp://localhost:8554/${pathName} -c copy -f ${targetProtocol} "${currentPlaceholder}"`}
            />
            <p className="text-xs text-muted-foreground">
              Bạn có thể chỉnh sửa trực tiếp command này. Thay đổi ở các trường trên sẽ cập nhật lại command.
            </p>
          </div>

          {/* Environment variables helper */}
          <div className="rounded-lg border border-blue-100 bg-blue-50 p-3 text-xs text-blue-700">
            <p className="font-medium mb-1">Biến môi trường có sẵn trong runOnReady:</p>
            <code className="block mt-1 text-blue-600">
              MTX_PATH - Tên path hiện tại
            </code>
            <code className="block text-blue-600">
              RTSP_PORT - Cổng RTSP server
            </code>
            <code className="block text-blue-600">
              MTX_SOURCE_TYPE - Loại nguồn (rtspSession, rtmpConn...)
            </code>
            <code className="block text-blue-600">
              G1, G2... - Regex capture groups (nếu path là regex)
            </code>
          </div>
        </div>
      )}
    </div>
  )
}
