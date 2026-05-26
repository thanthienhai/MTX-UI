"use client"

import { useState, useCallback, useEffect } from "react"
import { AlertTriangle } from "lucide-react"
import { Switch } from "@/components/ui/switch"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"

interface SnapshotConfigProps {
  value: string
  onChange: (command: string) => void
  pathName: string
}

export function SnapshotConfig({ value, onChange, pathName }: SnapshotConfigProps) {
  const enabled = value.length > 0
  const [interval, setInterval] = useState(extractInterval(value) || 10)
  const [outputPath, setOutputPath] = useState(extractOutputPath(value) || "./snapshots/")

  // Parse interval from command on external value change
  useEffect(() => {
    const inv = extractInterval(value)
    if (inv) setInterval(inv)
    const out = extractOutputPath(value)
    if (out) setOutputPath(out)
  }, [value])

  const handleEnabledChange = useCallback(
    (isEnabled: boolean) => {
      if (!isEnabled) {
        onChange("")
      } else {
        onChange(
          `ffmpeg -i rtsp://localhost:8554/${pathName} -vf fps=1/${interval} -q:v 3 ${outputPath}${pathName}-%04d.jpg`,
        )
      }
    },
    [onChange, interval, outputPath, pathName],
  )

  const handleIntervalChange = useCallback(
    (val: number) => {
      setInterval(val)
      if (enabled) {
        onChange(
          `ffmpeg -i rtsp://localhost:8554/${pathName} -vf fps=1/${val} -q:v 3 ${outputPath}${pathName}-%04d.jpg`,
        )
      }
    },
    [enabled, onChange, outputPath, pathName],
  )

  const handleOutputPathChange = useCallback(
    (val: string) => {
      setOutputPath(val)
      if (enabled) {
        onChange(
          `ffmpeg -i rtsp://localhost:8554/${pathName} -vf fps=1/${interval} -q:v 3 ${val}${pathName}-%04d.jpg`,
        )
      }
    },
    [enabled, onChange, interval, pathName],
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center space-x-2">
        <Switch checked={enabled} onCheckedChange={handleEnabledChange} />
        <Label>Bật snapshot (FFmpeg)</Label>
      </div>

      {enabled && (
        <div className="ml-6 space-y-4">
          {/* Security warning */}
          <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-medium">Yêu cầu FFmpeg</p>
              <p className="mt-1 text-amber-700">
                Snapshot cần FFmpeg trên server. Command chạy với quyền của process MediaMTX. Đảm
                bảo output path an toàn.
              </p>
            </div>
          </div>

          {/* Interval */}
          <div className="space-y-2">
            <Label htmlFor="snapshotInterval">Interval (giây)</Label>
            <Input
              id="snapshotInterval"
              type="number"
              min={1}
              max={3600}
              value={interval}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10)
                if (!isNaN(val) && val >= 1) handleIntervalChange(val)
              }}
            />
            <p className="text-xs text-muted-foreground">
              Mỗi {interval} giây sẽ chụp một khung hình.
            </p>
          </div>

          {/* Output path */}
          <div className="space-y-2">
            <Label htmlFor="snapshotOutputPath">Đường dẫn đầu ra</Label>
            <Input
              id="snapshotOutputPath"
              value={outputPath}
              onChange={(e) => handleOutputPathChange(e.target.value)}
              placeholder="./snapshots/%path/"
            />
            <p className="text-xs text-muted-foreground">
              Sử dụng <code className="rounded bg-muted px-1">%path</code> làm biến cho tên path.
            </p>
          </div>

          {/* Editable command */}
          <div className="space-y-2">
            <Label htmlFor="snapshotCommand">FFmpeg command (runOnReady)</Label>
            <Textarea
              id="snapshotCommand"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              className="min-h-[60px] font-mono text-xs"
              placeholder="ffmpeg -i rtsp://localhost:8554/..."
            />
            <p className="text-xs text-muted-foreground">
              Bạn có thể chỉnh sửa trực tiếp command này.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

function extractInterval(command: string): number | null {
  const match = command.match(/fps=1\/(\d+)/)
  return match ? parseInt(match[1], 10) : null
}

function extractOutputPath(command: string): string | null {
  const match = command.match(/-q:v \d+\s+(\S+\/)/)
  return match ? match[1] : null
}

