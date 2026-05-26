"use client"

import { useCallback, useEffect, useState } from "react"
import { AlertTriangle, Cpu, Monitor } from "lucide-react"
import { Switch } from "@/components/ui/switch"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

// ── Types ──

type ReEncodingEngine = "ffmpeg" | "gstreamer"
type ReEncodingTemplate = "h264-bitrate" | "h265-to-h264" | "audio-transcode" | "scale-resolution" | "low-bitrate"

interface TemplateField {
  key: string
  label: string
  type: "text" | "number"
  placeholder: string
  defaultValue: string
}

interface ReEncodingTemplateDef {
  value: ReEncodingTemplate
  label: string
  description: string
  fields: TemplateField[]
  generateCommand: (engine: ReEncodingEngine, values: Record<string, string>, pathName: string) => string
}

// ── Props ──

interface ReEncodingConfigProps {
  command: string
  restart: boolean
  onCommandChange: (command: string) => void
  onRestartChange: (restart: boolean) => void
  pathName: string
}

// ── Templates ──

const RE_ENCODING_TEMPLATES: ReEncodingTemplateDef[] = [
  {
    value: "h264-bitrate",
    label: "H264 to H264 bitrate change",
    description: "Thay đổi bitrate cho stream H264, giảm băng thông đầu ra.",
    fields: [
      { key: "bitrate", label: "Target bitrate", type: "text", placeholder: "1M", defaultValue: "1M" },
      { key: "maxrate", label: "Max rate", type: "text", placeholder: "2M", defaultValue: "2M" },
      { key: "outputUrl", label: "Output URL", type: "text", placeholder: "rtsp://target:8554/stream", defaultValue: "rtsp://localhost:8554/stream" },
    ],
    generateCommand: (engine, values, pathName) => {
      const inputUrl = `rtsp://localhost:8554/${pathName}`
      if (engine === "ffmpeg") {
        return `ffmpeg -i ${inputUrl} -c:v libx264 -b:v ${values.bitrate || "1M"} -maxrate ${values.maxrate || "2M"} -bufsize ${parseInt(values.bitrate || "1") * 2}M -c:a copy -f rtsp "${values.outputUrl}"`
      }
      return `gst-launch-1.0 rtspsrc location=${inputUrl} ! rtph264depay ! h264parse ! mpegtsmux ! queue ! x264enc bitrate=${parseInt(values.bitrate || "1") * 1000} ! rtspclientsink location="${values.outputUrl}"`
    },
  },
  {
    value: "h265-to-h264",
    label: "H265 to H264 for browser compatibility",
    description: "Chuyển đổi H265 sang H264 để tương thích trình duyệt.",
    fields: [
      { key: "outputUrl", label: "Output URL", type: "text", placeholder: "rtmp://target/live/stream", defaultValue: "rtmp://localhost/live/stream" },
      { key: "audioCodec", label: "Audio codec", type: "text", placeholder: "aac", defaultValue: "aac" },
    ],
    generateCommand: (engine, values, pathName) => {
      const inputUrl = `rtsp://localhost:8554/${pathName}`
      const audioCodec = values.audioCodec || "aac"
      if (engine === "ffmpeg") {
        return `ffmpeg -i ${inputUrl} -c:v libx264 -preset fast -c:a ${audioCodec} -f flv "${values.outputUrl}"`
      }
      return `gst-launch-1.0 rtspsrc location=${inputUrl} ! decodebin ! queue ! x264enc ! mpegtsmux ! queue ! ${audioCodec === "aac" ? "faac" : "opusenc"} ! mpegtsmux ! rtspclientsink location="${values.outputUrl}"`
    },
  },
  {
    value: "audio-transcode",
    label: "Audio transcode to AAC/Opus",
    description: "Chuyển đổi audio sang AAC hoặc Opus.",
    fields: [
      { key: "audioCodec", label: "Audio codec", type: "text", placeholder: "aac", defaultValue: "aac" },
      { key: "outputUrl", label: "Output URL", type: "text", placeholder: "rtsp://target:8554/audio", defaultValue: "rtsp://localhost:8554/audio" },
    ],
    generateCommand: (engine, values, pathName) => {
      const inputUrl = `rtsp://localhost:8554/${pathName}`
      const audioCodec = values.audioCodec || "aac"
      if (engine === "ffmpeg") {
        return `ffmpeg -i ${inputUrl} -c:v copy -c:a ${audioCodec === "opus" ? "libopus" : "aac"} -b:a 128k -f rtsp "${values.outputUrl}"`
      }
      return `gst-launch-1.0 rtspsrc location=${inputUrl} ! decodebin ! queue ! ${audioCodec === "opus" ? "opusenc" : "faac"} ! mpegtsmux ! rtspclientsink location="${values.outputUrl}"`
    },
  },
  {
    value: "scale-resolution",
    label: "Scale resolution",
    description: "Thay đổi độ phân giải stream (ví dụ: 4K → 1080p).",
    fields: [
      { key: "width", label: "Target width", type: "number", placeholder: "1280", defaultValue: "1280" },
      { key: "height", label: "Target height", type: "number", placeholder: "720", defaultValue: "720" },
      { key: "outputUrl", label: "Output URL", type: "text", placeholder: "rtsp://target:8554/stream", defaultValue: "rtsp://localhost:8554/stream" },
    ],
    generateCommand: (engine, values, pathName) => {
      const inputUrl = `rtsp://localhost:8554/${pathName}`
      const w = values.width || "1280"
      const h = values.height || "720"
      if (engine === "ffmpeg") {
        return `ffmpeg -i ${inputUrl} -vf scale=${w}:${h} -c:v libx264 -preset fast -c:a copy -f rtsp "${values.outputUrl}"`
      }
      return `gst-launch-1.0 rtspsrc location=${inputUrl} ! decodebin ! queue ! videoscale ! video/x-raw,width=${w},height=${h} ! x264enc ! mpegtsmux ! rtspclientsink location="${values.outputUrl}"`
    },
  },
  {
    value: "low-bitrate",
    label: "Add low-bitrate substream",
    description: "Tạo substream bitrate thấp cho mobile hoặc mạng yếu.",
    fields: [
      { key: "bitrate", label: "Target bitrate", type: "text", placeholder: "500k", defaultValue: "500k" },
      { key: "resolution", label: "Resolution (WxH)", type: "text", placeholder: "640:360", defaultValue: "640:360" },
      { key: "outputUrl", label: "Output URL", type: "text", placeholder: "rtsp://target:8554/stream_low", defaultValue: "rtsp://localhost:8554/stream_low" },
    ],
    generateCommand: (engine, values, pathName) => {
      const inputUrl = `rtsp://localhost:8554/${pathName}`
      const bitrate = values.bitrate || "500k"
      const resolution = values.resolution || "640:360"
      if (engine === "ffmpeg") {
        return `ffmpeg -i ${inputUrl} -vf scale=${resolution} -c:v libx264 -b:v ${bitrate} -maxrate ${parseInt(bitrate) * 2}k -c:a copy -f rtsp "${values.outputUrl}"`
      }
      return `gst-launch-1.0 rtspsrc location=${inputUrl} ! decodebin ! queue ! videoscale ! video/x-raw,width=${resolution.split(":")[0]},height=${resolution.split(":")[1]} ! x264enc bitrate=${parseInt(bitrate) * 1000} ! mpegtsmux ! rtspclientsink location="${values.outputUrl}"`
    },
  },
]

// ── Utility ──

function detectTemplate(command: string): ReEncodingTemplate | "custom" {
  if (command.includes("-c:v libx264") && command.includes("-b:v")) return "h264-bitrate"
  if (command.includes("-c:v libx264") && command.includes("-c:a")) return "h265-to-h264"
  if (command.includes("-c:v copy -c:a")) return "audio-transcode"
  if (command.includes("-vf scale=") && !command.includes("-b:v 500k")) return "scale-resolution"
  if (command.includes("-vf scale=") && command.includes("500k")) return "low-bitrate"
  return "custom"
}

function detectEngine(command: string): ReEncodingEngine {
  if (command.startsWith("gst-launch")) return "gstreamer"
  return "ffmpeg"
}

// ── Component ──

export function ReEncodingConfig({
  command,
  restart,
  onCommandChange,
  onRestartChange,
  pathName,
}: ReEncodingConfigProps) {
  const enabled = command.length > 0

  const [engine, setEngine] = useState<ReEncodingEngine>(() => detectEngine(command))
  const [selectedTemplate, setSelectedTemplate] = useState<ReEncodingTemplate | "custom">(() => detectTemplate(command))
  const [templateFields, setTemplateFields] = useState<Record<string, string>>({})

  const activeTemplateDef = RE_ENCODING_TEMPLATES.find((t) => t.value === selectedTemplate)

  // Regenerate from template when engine changes
  const regenerateFromTemplate = useCallback(
    (eng: ReEncodingEngine, templ: ReEncodingTemplate | "custom", fields: Record<string, string>) => {
      if (templ === "custom") return
      const def = RE_ENCODING_TEMPLATES.find((t) => t.value === templ)
      if (def) {
        onCommandChange(def.generateCommand(eng, fields, pathName))
      }
    },
    [onCommandChange, pathName],
  )

  const handleEnabledChange = useCallback(
    (isEnabled: boolean) => {
      if (!isEnabled) {
        onCommandChange("")
        return
      }
      // Default to H264 bitrate template
      const def = RE_ENCODING_TEMPLATES[0]
      const fields: Record<string, string> = {}
      def.fields.forEach((f) => { fields[f.key] = f.defaultValue })
      setSelectedTemplate(def.value)
      setTemplateFields(fields)
      onCommandChange(def.generateCommand(engine, fields, pathName))
    },
    [onCommandChange, engine, pathName],
  )

  const handleEngineChange = useCallback(
    (eng: string) => {
      const newEngine = eng as ReEncodingEngine
      setEngine(newEngine)
      if (enabled && selectedTemplate !== "custom") {
        regenerateFromTemplate(newEngine, selectedTemplate, templateFields)
      }
    },
    [enabled, selectedTemplate, templateFields, regenerateFromTemplate],
  )

  const handleTemplateChange = useCallback(
    (templ: string) => {
      const newTemplate = templ as ReEncodingTemplate | "custom"
      setSelectedTemplate(newTemplate)

      if (newTemplate === "custom") return

      const def = RE_ENCODING_TEMPLATES.find((t) => t.value === newTemplate)
      if (def) {
        const fields: Record<string, string> = {}
        def.fields.forEach((f) => { fields[f.key] = f.defaultValue })
        setTemplateFields(fields)
        onCommandChange(def.generateCommand(engine, fields, pathName))
      }
    },
    [engine, onCommandChange, pathName],
  )

  const handleFieldChange = useCallback(
    (key: string, value: string) => {
      setTemplateFields((prev) => {
        const updated = { ...prev, [key]: value }
        if (activeTemplateDef && selectedTemplate !== "custom") {
          onCommandChange(activeTemplateDef.generateCommand(engine, updated, pathName))
        }
        return updated
      })
    },
    [activeTemplateDef, selectedTemplate, engine, onCommandChange, pathName],
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center space-x-2">
        <Switch checked={enabled} onCheckedChange={handleEnabledChange} />
        <Label>Bật Re-Encoding</Label>
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

          {/* CPU Warning */}
          <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            <Cpu className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-medium">Cảnh báo: Re-encoding tiêu tốn nhiều CPU</p>
              <p className="mt-1 text-amber-700">
                Re-encoding chạy trên server MediaMTX và có thể gây tốn CPU đáng kể. Đảm bảo server có đủ tài nguyên.
              </p>
            </div>
          </div>

          {/* Template selector */}
          <div className="space-y-2">
            <Label htmlFor="reencodeTemplate">Mẫu lệnh (template)</Label>
            <Select value={selectedTemplate} onValueChange={handleTemplateChange}>
              <SelectTrigger id="reencodeTemplate" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RE_ENCODING_TEMPLATES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
                <SelectItem value="custom">Tùy chỉnh (custom)</SelectItem>
              </SelectContent>
            </Select>
            {activeTemplateDef && selectedTemplate !== "custom" && (
              <p className="text-xs text-muted-foreground">{activeTemplateDef.description}</p>
            )}
          </div>

          {/* Template fields */}
          {activeTemplateDef && selectedTemplate !== "custom" && (
            <div className="space-y-3 rounded-lg border bg-[#f7f8fa] p-3">
              {activeTemplateDef.fields.map((field) => (
                <div key={field.key} className="space-y-1.5">
                  <Label className="text-xs">{field.label}</Label>
                  <Input
                    value={templateFields[field.key] ?? field.defaultValue}
                    onChange={(e) => handleFieldChange(field.key, e.target.value)}
                    placeholder={field.placeholder}
                    type={field.type === "number" ? "number" : "text"}
                    className="h-8 text-xs"
                  />
                </div>
              ))}
            </div>
          )}

          {/* Command preview */}
          <div className="space-y-2">
            <Label htmlFor="reencodeCommand">{engine === "ffmpeg" ? "FFmpeg" : "GStreamer"} command (runOnReady)</Label>
            <Textarea
              id="reencodeCommand"
              value={command}
              onChange={(e) => onCommandChange(e.target.value)}
              className="min-h-[80px] font-mono text-xs"
              placeholder={
                engine === "ffmpeg"
                  ? "ffmpeg -i rtsp://localhost:8554/..."
                  : "gst-launch-1.0 rtspsrc location=..."
              }
            />
            <p className="text-xs text-muted-foreground">
              Bạn có thể chỉnh sửa trực tiếp command này. Chuyển đổi template sẽ cập nhật lại command.
            </p>
          </div>

          {/* restart toggle */}
          <div className="flex items-center space-x-2">
            <Switch checked={restart} onCheckedChange={onRestartChange} />
            <Label>Tự động khởi động lại nếu lệnh thoát (runOnReadyRestart)</Label>
          </div>
          <p className="text-xs text-muted-foreground ml-6">
            MediaMTX sẽ khởi động lại re-encoding nếu process bị thoát hoặc gặp lỗi.
          </p>

          {/* Security warning */}
          <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-medium">Cảnh báo bảo mật</p>
              <p className="mt-1 text-amber-700">
                Re-encoding command chạy với quyền của process MediaMTX. Chỉ sử dụng command từ nguồn tin cậy.
                Không nhúng mật khẩu trực tiếp vào command.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
