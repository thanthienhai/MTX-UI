"use client"

import { useCallback, useRef, useState } from "react"
import { AlertTriangle, ChevronDown, ChevronRight, Info, RotateCcw } from "lucide-react"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

// ── Types ────────────────────────────────────────────────────────

export type HookContext = "global" | "lifecycle" | "onDemand" | "readEvent" | "recording"

export interface EnvVarDef {
  name: string
  description: string
}

export interface TemplateFieldDef {
  key: string
  label: string
  type: "text" | "number" | "url"
  placeholder: string
  defaultValue: string
}

export interface TemplateDef {
  value: string
  label: string
  description: string
  fields: TemplateFieldDef[]
  generateCommand: (values: Record<string, string>, pathName: string) => string
}

export interface HookCommandEditorProps {
  /** Current command value */
  value: string
  /** Called when the command text changes */
  onChange: (value: string) => void
  /** Hook identifier for display (e.g. "runOnReady") */
  hookName: string
  /** Human-readable label for the hook */
  label?: string
  /** Description/help text shown below the textarea */
  description?: string
  /** Placeholder text for the textarea */
  placeholder?: string
  /** Environment variables available for this hook context */
  envVars?: EnvVarDef[]
  /** Optional command templates */
  templates?: TemplateDef[]
  /** Current path name (for template generation) */
  pathName?: string
  /** Whether the restart toggle is shown */
  restartEnabled?: boolean
  /** Current restart value */
  restart?: boolean
  /** Called when restart toggle changes */
  onRestartChange?: (value: boolean) => void
  /** Disable editing */
  disabled?: boolean
}

// ── Default env vars by context ──────────────────────────────────

export const HOOK_ENV_VARS: Record<HookContext, EnvVarDef[]> = {
  global: [
    { name: "MTX_API_PORT", description: "Cổng API MediaMTX" },
    { name: "MTX_LOG_LEVEL", description: "Mức log hiện tại" },
    { name: "MTX_READ_TIMEOUT", description: "Timeout đọc" },
    { name: "MTX_WRITE_TIMEOUT", description: "Timeout ghi" },
  ],
  lifecycle: [
    { name: "MTX_PATH", description: "Tên path hiện tại" },
    { name: "RTSP_PORT", description: "Cổng RTSP server" },
    { name: "MTX_SOURCE_TYPE", description: "Loại nguồn (rtspSession, rtmpConn...)" },
    { name: "G1", description: "Regex capture group 1" },
    { name: "G2", description: "Regex capture group 2" },
  ],
  onDemand: [
    { name: "MTX_PATH", description: "Tên path hiện tại" },
    { name: "MTX_QUERY", description: "Query parameters (từ reader đầu tiên)" },
    { name: "RTSP_PORT", description: "Cổng RTSP server" },
    { name: "G1", description: "Regex capture group 1" },
    { name: "G2", description: "Regex capture group 2" },
  ],
  readEvent: [
    { name: "MTX_PATH", description: "Tên path hiện tại" },
    { name: "RTSP_PORT", description: "Cổng RTSP server" },
    { name: "MTX_READER_TYPE", description: "Loại reader (rtspSession, rtmpConn...)" },
    { name: "G1", description: "Regex capture group 1" },
    { name: "G2", description: "Regex capture group 2" },
  ],
  recording: [
    { name: "MTX_PATH", description: "Tên path hiện tại" },
    { name: "MTX_RECORD_PATH", description: "Đường dẫn file ghi hình" },
    { name: "MTX_RECORD_FORMAT", description: "Định dạng ghi hình (fmp4/mpegts)" },
    { name: "MTX_RECORD_SEGMENT_DURATION", description: "Thời lượng segment" },
    { name: "G1", description: "Regex capture group 1" },
    { name: "G2", description: "Regex capture group 2" },
  ],
}

// ── Component ─────────────────────────────────────────────────────

export function HookCommandEditor({
  value,
  onChange,
  hookName,
  label,
  description,
  placeholder,
  envVars,
  templates,
  pathName,
  restartEnabled = false,
  restart,
  onRestartChange,
  disabled = false,
}: HookCommandEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [isEnvVarsOpen, setIsEnvVarsOpen] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<string>("custom")
  const [templateFieldValues, setTemplateFieldValues] = useState<Record<string, string>>({})
  const hasCommand = value.trim().length > 0

  // ── Template handling ──
  const activeTemplateDef = templates?.find((t) => t.value === selectedTemplate)

  const handleTemplateChange = useCallback(
    (templateValue: string) => {
      setSelectedTemplate(templateValue)
      if (templateValue === "custom" || !templates) return

      const def = templates.find((t) => t.value === templateValue)
      if (def) {
        const fields: Record<string, string> = {}
        def.fields.forEach((f) => {
          fields[f.key] = f.defaultValue
        })
        setTemplateFieldValues(fields)
        onChange(def.generateCommand(fields, pathName || ""))
      }
    },
    [templates, onChange, pathName],
  )

  const handleTemplateFieldChange = useCallback(
    (key: string, fieldValue: string) => {
      setTemplateFieldValues((prev) => {
        const updated = { ...prev, [key]: fieldValue }
        if (activeTemplateDef && selectedTemplate !== "custom") {
          onChange(activeTemplateDef.generateCommand(updated, pathName || ""))
        }
        return updated
      })
    },
    [activeTemplateDef, selectedTemplate, onChange, pathName],
  )

  // ── Env var click-to-insert ──
  const insertEnvVar = useCallback(
    (varName: string) => {
      if (disabled || !textareaRef.current) return
      const textarea = textareaRef.current
      const start = textarea.selectionStart
      const end = textarea.selectionEnd
      const newValue = value.slice(0, start) + `$${varName}` + value.slice(end)
      onChange(newValue)
      // Restore cursor position after state update
      requestAnimationFrame(() => {
        textarea.focus()
        const cursorPos = start + varName.length + 1
        textarea.setSelectionRange(cursorPos, cursorPos)
      })
    },
    [disabled, value, onChange],
  )

  // ── Resolve env vars ──
  const resolvedEnvVars = envVars || []

  return (
    <div className="space-y-3">
      {/* Label */}
      {label && (
        <Label className="text-sm font-medium">
          {label}
          {hasCommand && <span className="ml-2 text-xs text-muted-foreground">(đã cấu hình)</span>}
        </Label>
      )}

      {/* Template selector */}
      {templates && templates.length > 0 && (
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Mẫu lệnh (template)</Label>
          <Select value={selectedTemplate} onValueChange={handleTemplateChange} disabled={disabled}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Chọn mẫu lệnh" />
            </SelectTrigger>
            <SelectContent>
              {templates.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
              <SelectItem value="custom">Tùy chỉnh (custom)</SelectItem>
            </SelectContent>
          </Select>
          {activeTemplateDef && selectedTemplate !== "custom" && (
            <p className="text-xs text-muted-foreground">{activeTemplateDef.description}</p>
          )}
        </div>
      )}

      {/* Template fields */}
      {activeTemplateDef && selectedTemplate !== "custom" && (
        <div className="ml-2 space-y-3 rounded-lg border bg-[#f7f8fa] p-3">
          {activeTemplateDef.fields.map((field) => (
            <div key={field.key} className="space-y-1">
              <Label className="text-xs">{field.label}</Label>
              <Input
                value={templateFieldValues[field.key] ?? field.defaultValue}
                onChange={(e) => handleTemplateFieldChange(field.key, e.target.value)}
                placeholder={field.placeholder}
                type={field.type === "number" ? "number" : "text"}
                disabled={disabled}
                className="h-8 text-xs"
              />
            </div>
          ))}
        </div>
      )}

      {/* Command textarea */}
      <div className="space-y-1">
        <Textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder || `# Nhập command cho ${hookName}...`}
          disabled={disabled}
          className="min-h-[80px] font-mono text-xs"
        />
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>

      {/* Security warning */}
      {hasCommand && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-medium">Cảnh báo bảo mật</p>
            <p className="mt-1 text-amber-700">
              Hook command chạy với quyền của process MediaMTX. Chỉ sử dụng command từ nguồn tin cậy.
              Không nhúng mật khẩu trực tiếp vào command.
            </p>
          </div>
        </div>
      )}

      {/* Restart toggle */}
      {restartEnabled && (
        <div className="flex items-center gap-2">
          <Switch checked={!!restart} onCheckedChange={(v) => onRestartChange?.(v)} disabled={disabled} />
          <Label className="text-sm">Tự động khởi động lại nếu lệnh thoát</Label>
        </div>
      )}

      {/* Env var helper */}
      {resolvedEnvVars.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setIsEnvVarsOpen(!isEnvVarsOpen)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {isEnvVarsOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            <Info className="h-3 w-3" />
            <span>Biến môi trường có sẵn</span>
          </button>

          {isEnvVarsOpen && (
            <div className="mt-2 rounded-lg border border-blue-100 bg-blue-50 p-3">
              <div className="grid grid-cols-1 gap-1.5 text-xs">
                {resolvedEnvVars.map((envVar) => (
                  <button
                    key={envVar.name}
                    type="button"
                    onClick={() => insertEnvVar(envVar.name)}
                    disabled={disabled}
                    className="flex items-center gap-2 rounded px-1.5 py-1 text-left hover:bg-blue-100/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <code className="shrink-0 rounded bg-white px-1.5 py-0.5 font-mono text-[11px] text-blue-700">
                      ${envVar.name}
                    </code>
                    <span className="text-blue-600">{envVar.description}</span>
                  </button>
                ))}
              </div>
              {!disabled && (
                <p className="mt-2 text-[10px] text-blue-400">Nhấp vào biến để chèn vào vị trí con trỏ</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
