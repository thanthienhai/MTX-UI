"use client"

import { useMemo, useState } from "react"
import { Code, Info } from "lucide-react"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

// ─── Types ────────────────────────────────────────────────────────────────────

interface ProxyRegexHelperProps {
  pathName: string
  sourceUrl: string
  onInsertCaptureGroup: (group: string) => void
}

// ─── Utilities ────────────────────────────────────────────────────────────────

/**
 * Count capture groups in a regex pattern string (non-named groups only).
 * Handles escaped parentheses and character classes.
 */
function countCaptureGroups(pattern: string): number {
  let count = 0
  let depth = 0
  let inCharClass = false
  let escaped = false

  for (let i = 0; i < pattern.length; i++) {
    const ch = pattern[i]

    if (escaped) {
      escaped = false
      continue
    }

    if (ch === "\\") {
      escaped = true
      continue
    }

    if (ch === "[" && !escaped) {
      inCharClass = true
      continue
    }

    if (ch === "]" && inCharClass) {
      inCharClass = false
      continue
    }

    if (inCharClass) continue

    if (ch === "(" && pattern[i + 1] !== "?") {
      depth++
      count++
    } else if (ch === ")" && depth > 0) {
      depth--
    }
  }

  return count
}

/**
 * Apply example capture group values to a source URL containing $G1, $G2 etc.
 */
function applyExampleValues(sourceUrl: string, examples: string[]): string {
  let result = sourceUrl
  for (let i = 0; i < examples.length; i++) {
    const groupVar = `\${G${i + 1}}`
    const groupVar2 = `$G${i + 1}`
    if (result.includes(groupVar)) {
      result = result.replaceAll(groupVar, examples[i])
    }
    if (result.includes(groupVar2)) {
      result = result.replaceAll(groupVar2, examples[i])
    }
  }
  return result
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ProxyRegexHelper({
  pathName,
  sourceUrl,
  onInsertCaptureGroup,
}: ProxyRegexHelperProps) {
  const regexPattern = useMemo(() => {
    // Strip leading ~ to get the actual regex pattern
    return pathName.startsWith("~") ? pathName.slice(1) : pathName
  }, [pathName])

  const captureGroupCount = useMemo(() => countCaptureGroups(regexPattern), [regexPattern])
  const captureGroups = useMemo(
    () => Array.from({ length: captureGroupCount }, (_, i) => `G${i + 1}`),
    [captureGroupCount],
  )

  const [exampleValues, setExampleValues] = useState<string[]>(
    () => captureGroups.map((_, i) => `value${i + 1}`),
  )

  const resolvedUrl = useMemo(
    () => applyExampleValues(sourceUrl, exampleValues),
    [sourceUrl, exampleValues],
  )

  const hasCaptureGroupsInSource = useMemo(
    () => captureGroups.some((g) => sourceUrl.includes(`\${${g}}`) || sourceUrl.includes(`$${g}`)),
    [sourceUrl, captureGroups],
  )

  if (captureGroupCount === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-600">
        <div className="flex items-center gap-2">
          <Info className="h-3.5 w-3.5" />
          <span className="font-medium">Regex path không có capture group</span>
        </div>
        <p className="mt-1">
          Thêm <code className="rounded bg-gray-200 px-1">()</code> vào regex path name để tạo capture groups.
          Ví dụ: <code className="rounded bg-gray-200 px-1">~^cam(\d+)$</code> tạo ra <code className="rounded bg-gray-200 px-1">$G1</code>.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3 rounded-lg border border-purple-200 bg-purple-50 p-3 text-xs text-purple-800">
      <div className="flex items-center gap-2">
        <Code className="h-3.5 w-3.5" />
        <span className="font-medium">Regex capture groups — {captureGroupCount} group{captureGroupCount > 1 ? "s" : ""}</span>
      </div>

      {/* Available capture groups */}
      <div className="space-y-1.5">
        <Label className="text-xs text-purple-700">Biến có sẵn:</Label>
        <div className="flex flex-wrap gap-1.5">
          {captureGroups.map((group) => {
            const inUse = sourceUrl.includes(`\${${group}}`) || sourceUrl.includes(`$${group}`)
            return (
              <Badge
                key={group}
                variant={inUse ? "default" : "outline"}
                className={`cursor-pointer text-xs ${inUse ? "bg-purple-600" : "border-purple-300 text-purple-700"}`}
                onClick={() => onInsertCaptureGroup(group)}
                title={`Click để thêm ${group} vào source URL`}
              >
                {group}
                {inUse ? " ✓" : " +"}
              </Badge>
            )
          })}
        </div>
        <p className="text-purple-600">
          Click vào biến để thêm vào cuối source URL. 
          MediaMTX sẽ thay thế <code className="rounded bg-purple-200 px-1">$G1</code> bằng giá trị capture group từ regex.
        </p>
      </div>

      {/* Example values */}
      {captureGroups.length > 0 && (
        <div className="space-y-1.5">
          <Label className="text-xs text-purple-700">Giá trị ví dụ:</Label>
          <div className="flex flex-wrap gap-2">
            {captureGroups.map((group, i) => (
              <div key={group} className="flex items-center gap-1">
                <span className="text-purple-600">{group}=</span>
                <Input
                  className="h-6 w-20 text-xs"
                  value={exampleValues[i] || ""}
                  onChange={(e) => {
                    const next = [...exampleValues]
                    next[i] = e.target.value
                    setExampleValues(next)
                  }}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Resolved URL preview */}
      {hasCaptureGroupsInSource && (
        <div className="space-y-1">
          <Label className="text-xs text-purple-700">Source URL đã resolve (ví dụ):</Label>
          <div className="rounded border border-purple-200 bg-white p-2 font-mono text-xs break-all text-purple-900">
            {resolvedUrl}
          </div>
        </div>
      )}

      {/* Usage hint */}
      <div className="rounded border border-purple-200 bg-white p-2 text-purple-700">
        <p className="font-medium mb-0.5">Cách hoạt động:</p>
        <p>
          Với path name <code className="rounded bg-purple-100 px-1">{pathName}</code>, 
          khi client kết nối tới path khớp regex, MediaMTX sẽ thay 
          <code className="rounded bg-purple-100 px-1">$G1</code> bằng capture group đầu tiên, 
          <code className="rounded bg-purple-100 px-1">$G2</code> bằng capture group thứ hai, v.v.
        </p>
      </div>
    </div>
  )
}
