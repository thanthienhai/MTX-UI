"use client"

import { useState, useCallback, useEffect } from "react"
import { Switch } from "@/components/ui/switch"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { Path } from "@/lib/mediamtx-api"
import { CommandLifecycleDetail } from "@/components/command-lifecycle-badge"
import { HookCommandEditor, HOOK_ENV_VARS } from "@/components/hook-command-editor"

type OnDemandTemplate = "mp4Loop" | "startCamera" | "pullStream" | "custom"

interface OnDemandTemplateDef {
  value: OnDemandTemplate
  label: string
  description: string
  fields: Array<{
    key: string
    label: string
    type: "text" | "number"
    placeholder: string
    defaultValue: string
  }>
  generateCommand: (values: Record<string, string>, pathName: string) => string
}

const ON_DEMAND_TEMPLATES: OnDemandTemplateDef[] = [
  {
    value: "mp4Loop",
    label: "Loop MP4 File",
    description: "Phát loop một file MP4 bằng FFmpeg",
    fields: [
      {
        key: "filePath",
        label: "Đường dẫn file MP4",
        type: "text",
        placeholder: "/path/to/video.mp4",
        defaultValue: "/path/to/video.mp4",
      },
    ],
    generateCommand: (values, pathName) =>
      `ffmpeg -re -stream_loop -1 -i "${values.filePath}" -c copy -f rtsp rtsp://localhost:$RTSP_PORT/${pathName}`,
  },
  {
    value: "startCamera",
    label: "Start Camera Process",
    description: "Publish luồng từ camera qua FFmpeg",
    fields: [
      {
        key: "device",
        label: "Thiết bị camera",
        type: "text",
        placeholder: "/dev/video0",
        defaultValue: "/dev/video0",
      },
    ],
    generateCommand: (values, pathName) =>
      `ffmpeg -f v4l2 -i "${values.device}" -c:v libx264 -f rtsp rtsp://localhost:$RTSP_PORT/${pathName}`,
  },
  {
    value: "pullStream",
    label: "Pull External Stream",
    description: "Kéo luồng từ server upstream khi có reader",
    fields: [
      {
        key: "upstreamUrl",
        label: "URL nguồn upstream",
        type: "text",
        placeholder: "rtsp://upstream-server:8554/stream",
        defaultValue: "rtsp://upstream-server:8554/stream",
      },
    ],
    generateCommand: (values, pathName) =>
      `ffmpeg -i "${values.upstreamUrl}" -c copy -f rtsp rtsp://localhost:$RTSP_PORT/${pathName}`,
  },
]

function getTemplateByCommand(command: string): OnDemandTemplate | null {
  if (command.includes("-stream_loop -1")) return "mp4Loop"
  if (command.includes("-f v4l2")) return "startCamera"
  if (command.includes("upstreamUrl") || (command.includes("-i ") && command.includes("rtsp://") && !command.includes("-stream_loop") && !command.includes("-f v4l2")))
    return "pullStream"
  return null
}

interface OnDemandConfigProps {
  runOnDemand: string
  runOnDemandRestart: boolean
  runOnDemandStartTimeout: string
  runOnDemandCloseAfter: string
  runOnUnDemand: string
  onRunOnDemandChange: (value: string) => void
  onRunOnDemandRestartChange: (value: boolean) => void
  onRunOnDemandStartTimeoutChange: (value: string) => void
  onRunOnDemandCloseAfterChange: (value: string) => void
  onRunOnUnDemandChange: (value: string) => void
  pathName: string
  /** Optional runtime path data for command lifecycle display */
  runtimePath?: Path | null
}

export function OnDemandConfig({
  runOnDemand,
  runOnDemandRestart,
  runOnDemandStartTimeout,
  runOnDemandCloseAfter,
  runOnUnDemand,
  onRunOnDemandChange,
  onRunOnDemandRestartChange,
  onRunOnDemandStartTimeoutChange,
  onRunOnDemandCloseAfterChange,
  onRunOnUnDemandChange,
  pathName,
  runtimePath,
}: OnDemandConfigProps) {
  const enabled = runOnDemand.length > 0

  const [selectedTemplate, setSelectedTemplate] = useState<OnDemandTemplate>(() =>
    getTemplateByCommand(runOnDemand) || "custom",
  )
  const [templateFields, setTemplateFields] = useState<Record<string, string>>({})

  const activeTemplateDef = ON_DEMAND_TEMPLATES.find((t) => t.value === selectedTemplate)

  // Initialize template fields from defaults when template changes
  const handleTemplateChange = useCallback(
    (template: OnDemandTemplate) => {
      setSelectedTemplate(template)
      if (template === "custom") return

      const def = ON_DEMAND_TEMPLATES.find((t) => t.value === template)
      if (def) {
        const fields: Record<string, string> = {}
        def.fields.forEach((f) => {
          fields[f.key] = f.defaultValue
        })
        setTemplateFields(fields)
        onRunOnDemandChange(def.generateCommand(fields, pathName))
      }
    },
    [onRunOnDemandChange, pathName],
  )

  const handleFieldChange = useCallback(
    (key: string, value: string) => {
      setTemplateFields((prev) => {
        const updated = { ...prev, [key]: value }
        const def = ON_DEMAND_TEMPLATES.find((t) => t.value === selectedTemplate)
        if (def) {
          onRunOnDemandChange(def.generateCommand(updated, pathName))
        }
        return updated
      })
    },
    [selectedTemplate, onRunOnDemandChange, pathName],
  )

  const handleEnabledChange = useCallback(
    (isEnabled: boolean) => {
      if (!isEnabled) {
        onRunOnDemandChange("")
        onRunOnUnDemandChange("")
      } else {
        // Default to MP4 loop template
        handleTemplateChange("mp4Loop")
      }
    },
    [onRunOnDemandChange, onRunOnUnDemandChange, handleTemplateChange],
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center space-x-2">
        <Switch checked={enabled} onCheckedChange={handleEnabledChange} />
        <Label>Bật On-Demand Publishing</Label>
      </div>

      {enabled && (
        <div className="ml-6 space-y-4">
          {/* Command lifecycle status */}
          {runtimePath && (
            <CommandLifecycleDetail
              config={{ runOnInit: "", runOnDemand }}
              runtime={runtimePath}
            />
          )}

          {/* Template selector */}
          <div className="space-y-2">
            <Label htmlFor="onDemandTemplate">Mẫu lệnh (template)</Label>
            <Select value={selectedTemplate} onValueChange={(v) => handleTemplateChange(v as OnDemandTemplate)}>
              <SelectTrigger id="onDemandTemplate" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ON_DEMAND_TEMPLATES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
                <SelectItem value="custom">Tùy chỉnh (custom)</SelectItem>
              </SelectContent>
            </Select>
            {activeTemplateDef && (
              <p className="text-xs text-muted-foreground">{activeTemplateDef.description}</p>
            )}
          </div>

          {/* Template fields */}
          {activeTemplateDef && selectedTemplate !== "custom" && (
            <div className="space-y-3">
              {activeTemplateDef.fields.map((field) => (
                <div key={field.key} className="space-y-2">
                  <Label htmlFor={`onDemand-${field.key}`}>{field.label}</Label>
                  <Input
                    id={`onDemand-${field.key}`}
                    value={templateFields[field.key] ?? field.defaultValue}
                    onChange={(e) => handleFieldChange(field.key, e.target.value)}
                    placeholder={field.placeholder}
                  />
                </div>
              ))}
            </div>
          )}

          {/* Editable runOnDemand command with HookCommandEditor */}
          <HookCommandEditor
            hookName="runOnDemand"
            label="runOnDemand command"
            value={runOnDemand}
            onChange={(v) => onRunOnDemandChange(v || "")}
            placeholder="ffmpeg -re -stream_loop -1 -i /path/to/video.mp4 -c copy -f rtsp rtsp://localhost:$RTSP_PORT/$MTX_PATH"
            envVars={HOOK_ENV_VARS.onDemand}
            disabled={false}
          />

          {/* runOnDemandRestart */}
          <div className="flex items-center space-x-2">
            <Switch checked={runOnDemandRestart} onCheckedChange={onRunOnDemandRestartChange} />
            <Label>Tự động khởi động lại nếu lệnh thoát (runOnDemandRestart)</Label>
          </div>
          <p className="text-xs text-muted-foreground ml-6">
            MediaMTX sẽ khởi động lại lệnh nếu process bị thoát.
          </p>

          {/* Timeout fields */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="onDemandStartTimeout">Start Timeout</Label>
              <Input
                id="onDemandStartTimeout"
                placeholder="10s"
                value={runOnDemandStartTimeout}
                onChange={(e) => onRunOnDemandStartTimeoutChange(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Thời gian chờ runOnDemand khởi động
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="onDemandCloseAfter">Close After</Label>
              <Input
                id="onDemandCloseAfter"
                placeholder="10s"
                value={runOnDemandCloseAfter}
                onChange={(e) => onRunOnDemandCloseAfterChange(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Đóng sau khi không còn reader
              </p>
            </div>
          </div>

          {/* runOnUnDemand with HookCommandEditor */}
          <HookCommandEditor
            hookName="runOnUnDemand"
            label="runOnUnDemand command (tùy chọn)"
            value={runOnUnDemand}
            onChange={(v) => onRunOnUnDemandChange(v || "")}
            placeholder="Lệnh chạy khi không còn reader nào (tùy chọn)"
            envVars={HOOK_ENV_VARS.onDemand}
            disabled={false}
          />
        </div>
      )}
    </div>
  )
}
