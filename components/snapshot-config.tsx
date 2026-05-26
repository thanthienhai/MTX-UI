"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { AlertTriangle } from "lucide-react"
import { Switch } from "@/components/ui/switch"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

type SnapshotEngine = "ffmpeg" | "gstreamer"

interface SnapshotConfigProps {
  value: string
  onChange: (command: string) => void
  pathName: string
}

function detectEngine(command: string): SnapshotEngine {
  if (command.includes("gst-launch") || command.includes("videorate") || command.includes("nvarguscamerasrc")) {
    return "gstreamer"
  }
  return "ffmpeg"
}

function generateFFmpegCommand(pathName: string, interval: number, outputPath: string): string {
  return `ffmpeg -i rtsp://localhost:8554/${pathName} -vf fps=1/${interval} -q:v 3 ${outputPath}${pathName}-%04d.jpg`
}

function generateGStreamerCommand(pathName: string, interval: number, outputPath: string): string {
  return `gst-launch-1.0 rtspsrc location=rtsp://localhost:8554/${pathName} ! decodebin ! videorate ! video/x-raw,framerate=1/${interval} ! jpegenc ! multifilesink location=${outputPath}${pathName}-%04d.jpg`
}

function extractFFmpegInterval(command: string): number | null {
  const match = command.match(/fps=1\/(\d+)/)
  return match ? parseInt(match[1], 10) : null
}

function extractFFmpegOutputPath(command: string): string | null {
  const match = command.match(/-q:v \d+\s+(\S+\/)/)
  return match ? match[1] : null
}

function extractGStreamerInterval(command: string): number | null {
  const match = command.match(/framerate=1\/(\d+)/)
  return match ? parseInt(match[1], 10) : null
}

function extractGStreamerOutputPath(command: string): string | null {
  const match = command.match(/multifilesink location=(\S+\/)/)
  return match ? match[1] : null
}

export function SnapshotConfig({ value, onChange, pathName }: SnapshotConfigProps) {
  const enabled = value.length > 0

  const initialEngine = useMemo(() => detectEngine(value), [value])
  const [engine, setEngine] = useState<SnapshotEngine>(initialEngine)
  const [interval, setInterval] = useState(10)
  const [outputPath, setOutputPath] = useState("./snapshots/")

  // Sync UI fields from command on external value change
  useEffect(() => {
    const detected = detectEngine(value)
    setEngine(detected)

    if (detected === "ffmpeg") {
      const inv = extractFFmpegInterval(value)
      if (inv) setInterval(inv)
      const out = extractFFmpegOutputPath(value)
      if (out) setOutputPath(out)
    } else {
      const inv = extractGStreamerInterval(value)
      if (inv) setInterval(inv)
      const out = extractGStreamerOutputPath(value)
      if (out) setOutputPath(out)
    }
  }, [value])

  const generateCommand = useCallback(
    (eng: SnapshotEngine, inv: number, outPath: string) => {
      if (eng === "ffmpeg") {
        return generateFFmpegCommand(pathName, inv, outPath)
      }
      return generateGStreamerCommand(pathName, inv, outPath)
    },
    [pathName],
  )

  const handleEnabledChange = useCallback(
    (isEnabled: boolean) => {
      if (!isEnabled) {
        onChange("")
      } else {
        onChange(generateCommand(engine, interval, outputPath))
      }
    },
    [onChange, engine, interval, outputPath, generateCommand],
  )

  const handleEngineChange = useCallback(
    (eng: string) => {
      const newEngine = eng as SnapshotEngine
      setEngine(newEngine)
      if (enabled) {
        onChange(generateCommand(newEngine, interval, outputPath))
      }
    },
    [enabled, onChange, interval, outputPath, generateCommand],
  )

  const handleIntervalChange = useCallback(
    (val: number) => {
      setInterval(val)
      if (enabled) {
        onChange(generateCommand(engine, val, outputPath))
      }
    },
    [enabled, onChange, engine, outputPath, generateCommand],
  )

  const handleOutputPathChange = useCallback(
    (val: string) => {
      setOutputPath(val)
      if (enabled) {
        onChange(generateCommand(engine, interval, val))
      }
    },
    [enabled, onChange, engine, interval, generateCommand],
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center space-x-2">
        <Switch checked={enabled} onCheckedChange={handleEnabledChange} />
        <Label>Bật snapshot</Label>
      </div>

      {enabled && (
        <div className="ml-6 space-y-4">
          {/* Engine selector */}
          <div className="space-y-2">
            <Label>Engine</Label>
            <Tabs value={engine} onValueChange={handleEngineChange}>
              <TabsList className="h-9">
                <TabsTrigger value="ffmpeg" className="px-4 text-xs">FFmpeg</TabsTrigger>
                <TabsTrigger value="gstreamer" className="px-4 text-xs">GStreamer</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {/* Security warning */}
          <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-medium">Yêu cầu {engine === "ffmpeg" ? "FFmpeg" : "GStreamer"}</p>
              <p className="mt-1 text-amber-700">
                Snapshot cần {engine === "ffmpeg" ? "FFmpeg" : "GStreamer"} trên server. Command chạy với quyền của
                process MediaMTX. Đảm bảo output path an toàn.
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
            <Label htmlFor="snapshotCommand">
              {engine === "ffmpeg" ? "FFmpeg" : "GStreamer"} command (runOnReady)
            </Label>
            <Textarea
              id="snapshotCommand"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              className="min-h-[60px] font-mono text-xs"
              placeholder={
                engine === "ffmpeg"
                  ? "ffmpeg -i rtsp://localhost:8554/..."
                  : "gst-launch-1.0 rtspsrc location=rtsp://localhost:8554/..."
              }
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
