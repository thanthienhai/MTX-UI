"use client"

import { Label } from "@/components/ui/label"

export type StreamMode = "publisher" | "pullUpstream" | "onDemandPull" | "alwaysPull"

export interface StreamModeOption {
  value: StreamMode
  label: string
  description: string
  sourceType: "publisher" | "url"
}

export const STREAM_MODE_OPTIONS: StreamModeOption[] = [
  {
    value: "publisher",
    label: "Publisher mode",
    description: "Chờ publisher bên ngoài push stream (RTSP, RTMP, WebRTC...)",
    sourceType: "publisher",
  },
  {
    value: "pullUpstream",
    label: "Pull from upstream",
    description: "Luôn kéo nguồn từ URL — path luôn sẵn sàng khi upstream online",
    sourceType: "url",
  },
  {
    value: "onDemandPull",
    label: "On-demand pull",
    description: "Chỉ kéo nguồn khi có reader yêu cầu — tiết kiệm băng thông",
    sourceType: "url",
  },
  {
    value: "alwaysPull",
    label: "Always pull",
    description: "Chạy lệnh khởi tạo để tự động publish — path tồn tại kể cả khi không có publisher",
    sourceType: "url",
  },
]

export interface StreamModeSelectorProps {
  value: StreamMode
  onChange: (mode: StreamMode) => void
  detectedSourceType: string
}

/**
 * Maps source type + sourceOnDemand to a StreamMode.
 */
export function detectStreamMode(
  source: string,
  sourceOnDemand: boolean,
  hasRunOnInit: boolean,
): StreamMode {
  if (!source || source === "publisher") return "publisher"
  if (hasRunOnInit) return "alwaysPull"
  if (sourceOnDemand) return "onDemandPull"
  return "pullUpstream"
}

/**
 * Applies a StreamMode to return the appropriate field values.
 */
export function applyStreamMode(
  mode: StreamMode,
  currentSource: string,
): { source: string; sourceOnDemand: boolean; runOnInit?: string; runOnInitRestart?: boolean } {
  switch (mode) {
    case "publisher":
      return { source: "publisher", sourceOnDemand: true }
    case "pullUpstream":
      return {
        source: currentSource === "publisher" ? "" : currentSource,
        sourceOnDemand: false,
      }
    case "onDemandPull":
      return {
        source: currentSource === "publisher" ? "" : currentSource,
        sourceOnDemand: true,
      }
    case "alwaysPull":
      return {
        source: currentSource === "publisher" ? "" : currentSource,
        sourceOnDemand: false,
      }
  }
}

export function StreamModeSelector({
  value,
  onChange,
  detectedSourceType,
}: StreamModeSelectorProps) {
  const showUrlWarning = detectedSourceType === "publisher" && value !== "publisher"

  return (
    <div className="space-y-3">
      <Label>Chế độ nguồn (Stream Mode)</Label>
      <div className="grid gap-2">
        {STREAM_MODE_OPTIONS.map((option) => {
          const isSelected = value === option.value
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              className={`flex items-start gap-3 rounded-lg border p-3 text-left text-sm transition-colors ${
                isSelected
                  ? "border-blue-500 bg-blue-50 ring-1 ring-blue-500"
                  : "border-gray-200 bg-white hover:bg-gray-50"
              }`}
            >
              <div
                className={`mt-0.5 h-4 w-4 shrink-0 rounded-full border-2 ${
                  isSelected ? "border-blue-500 bg-blue-500" : "border-gray-300"
                }`}
              >
                {isSelected && (
                  <div className="flex h-full items-center justify-center">
                    <div className="h-1.5 w-1.5 rounded-full bg-white" />
                  </div>
                )}
              </div>
              <div>
                <div className={`font-medium ${isSelected ? "text-blue-800" : "text-gray-900"}`}>
                  {option.label}
                </div>
                <div className={`mt-0.5 text-xs ${isSelected ? "text-blue-600" : "text-gray-500"}`}>
                  {option.description}
                </div>
              </div>
            </button>
          )
        })}
      </div>
      {showUrlWarning && (
        <p className="text-xs text-amber-600">
          Nguồn đang là &quot;publisher&quot; — vui lòng chọn loại nguồn URL trước nếu muốn pull upstream.
        </p>
      )}
    </div>
  )
}
