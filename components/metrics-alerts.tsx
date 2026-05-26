"use client"

import { useEffect, useRef, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AlertTriangle, Activity, CheckCircle2, Bug } from "lucide-react"
import { buildMediaMtxMetricsUrl } from "@/lib/mediamtx-url.mjs"
import { parsePrometheus } from "@/lib/prometheus.mjs"
import { METRIC_NAMES, computeAlerts } from "@/lib/metrics-alerts-engine.mjs"

interface PromSample {
  name: string
  labels: Record<string, string>
  value: number
}

interface AlertEntry {
  id: string
  severity: "high" | "medium" | "low"
  title: string
  detail: string
  pathName?: string
}

interface Thresholds {
  packetLossPerSec: number
  jitterMs: number
  framesDiscardedPerSec: number
  errorFramesPerSec: number
  stallSeconds: number
}

const DEFAULT_THRESHOLDS: Thresholds = {
  packetLossPerSec: 1,
  jitterMs: 50,
  framesDiscardedPerSec: 1,
  errorFramesPerSec: 1,
  stallSeconds: 30,
}

interface MetricsAlertsProps {
  pollMs?: number
}

export function MetricsAlerts({ pollMs = 15_000 }: MetricsAlertsProps) {
  const [error, setError] = useState<string | null>(null)
  const [hasSnapshot, setHasSnapshot] = useState(false)
  const [thresholds, setThresholds] = useState<Thresholds>(DEFAULT_THRESHOLDS)
  const [alerts, setAlerts] = useState<AlertEntry[]>([])
  const [observedNames, setObservedNames] = useState<string[]>([])
  const [showDebug, setShowDebug] = useState(false)
  const prevSamplesRef = useRef<PromSample[] | null>(null)
  const prevAtRef = useRef<number>(0)
  // byte-rate tracking cho stall detection (per path)
  const bytesAtZeroSinceRef = useRef<Map<string, number>>(new Map())
  const thresholdsRef = useRef<Thresholds>(DEFAULT_THRESHOLDS)
  thresholdsRef.current = thresholds

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch(buildMediaMtxMetricsUrl(), { cache: "no-store" })
        if (!res.ok) throw new Error(`Metrics scrape ${res.status}`)
        const text = await res.text()
        if (cancelled) return
        const parsed = parsePrometheus(text)
        const now = Date.now()
        const prev = prevSamplesRef.current
        const prevAt = prevAtRef.current
        const elapsedSec = prevAt > 0 ? (now - prevAt) / 1000 : 0

        const computed = computeAlerts(parsed, prev, elapsedSec, thresholdsRef.current, bytesAtZeroSinceRef.current, now)
        setAlerts(computed)
        setError(null)
        setHasSnapshot(true)
        setObservedNames(Array.from(new Set(parsed.map((s) => s.name))).sort())
        prevSamplesRef.current = parsed
        prevAtRef.current = now
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e))
      }
    }
    load()
    if (pollMs > 0) {
      const id = window.setInterval(load, pollMs)
      return () => {
        cancelled = true
        window.clearInterval(id)
      }
    }
    return () => {
      cancelled = true
    }
  }, [pollMs])

  const sevBadge = (s: AlertEntry["severity"]) => {
    const cls =
      s === "high"
        ? "bg-red-100 text-red-800 border-red-200"
        : s === "medium"
          ? "bg-amber-100 text-amber-800 border-amber-200"
          : "bg-yellow-50 text-yellow-800 border-yellow-200"
    return <Badge variant="outline" className={cls}>{s.toUpperCase()}</Badge>
  }

  // Highlight which configured candidate names are actually present
  const candidateMatches = (() => {
    const set = new Set(observedNames)
    const out: { category: string; matched: string | null; tried: string[] }[] = []
    for (const [cat, candidates] of Object.entries(METRIC_NAMES)) {
      const matched = candidates.find((c) => set.has(c)) || null
      out.push({ category: cat, matched, tried: candidates })
    }
    return out
  })()

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Activity className="h-4 w-4" /> Metrics alerts
        </CardTitle>
        <CardDescription>
          Quét metrics MediaMTX mỗi {Math.round(pollMs / 1000)}s. Cảnh báo cho path offline (paths với state ≠
          ready), không có reader, byte stall, jitter cao, packet loss, frames discarded/error.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <ThresholdInput
            label="Packet loss / s"
            value={thresholds.packetLossPerSec}
            onChange={(v) => setThresholds((t) => ({ ...t, packetLossPerSec: v }))}
          />
          <ThresholdInput
            label="Jitter (ms)"
            value={thresholds.jitterMs}
            onChange={(v) => setThresholds((t) => ({ ...t, jitterMs: v }))}
          />
          <ThresholdInput
            label="Frames discarded / s"
            value={thresholds.framesDiscardedPerSec}
            onChange={(v) => setThresholds((t) => ({ ...t, framesDiscardedPerSec: v }))}
          />
          <ThresholdInput
            label="Error frames / s"
            value={thresholds.errorFramesPerSec}
            onChange={(v) => setThresholds((t) => ({ ...t, errorFramesPerSec: v }))}
          />
          <ThresholdInput
            label="Stall (s)"
            value={thresholds.stallSeconds}
            onChange={(v) => setThresholds((t) => ({ ...t, stallSeconds: v }))}
          />
        </div>

        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 p-2 text-sm text-red-800">
            Không lấy được metrics: {error}. Kiểm tra `metrics: yes` trong MediaMTX config và quyền truy cập.
          </div>
        )}

        {!error && alerts.length === 0 && hasSnapshot && (
          <p className="flex items-center gap-2 text-sm text-emerald-700">
            <CheckCircle2 className="h-4 w-4" /> Không có alert. Tất cả thresholds đang trong mức cho phép.
          </p>
        )}

        {alerts.map((a) => (
          <div key={a.id} className="rounded-md border p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-600" />
                <div>
                  <div className="text-sm font-medium">
                    {a.title}
                    {a.pathName && <span className="ml-2 font-mono text-xs text-muted-foreground">{a.pathName}</span>}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">{a.detail}</div>
                </div>
              </div>
              {sevBadge(a.severity)}
            </div>
          </div>
        ))}

        {hasSnapshot && (
          <button
            type="button"
            onClick={() => setShowDebug((v) => !v)}
            className="flex items-center gap-1 text-xs text-muted-foreground underline hover:text-foreground"
          >
            <Bug className="h-3 w-3" />
            {showDebug ? "Ẩn" : "Hiện"} debug ({observedNames.length} metric name)
          </button>
        )}
        {showDebug && (
          <div className="space-y-2 rounded-md border bg-slate-50 p-3 text-xs">
            <div>
              <div className="mb-1 font-medium">Candidate match</div>
              <ul className="space-y-0.5">
                {candidateMatches.map((c) => (
                  <li key={c.category} className="font-mono">
                    <Badge variant="outline" className="mr-1 text-[10px]">{c.category}</Badge>
                    {c.matched ? (
                      <span className="text-emerald-700">→ {c.matched}</span>
                    ) : (
                      <span className="text-red-600">→ none of [{c.tried.join(", ")}]</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <div className="mb-1 font-medium">Tất cả metric name quan sát được</div>
              <div className="max-h-48 overflow-y-auto whitespace-pre-wrap break-all font-mono">
                {observedNames.join("  ·  ")}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function ThresholdInput({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <Input
        type="number"
        value={value}
        onChange={(e) => {
          const n = Number(e.target.value)
          if (Number.isFinite(n) && n >= 0) onChange(n)
        }}
        className="h-8 text-xs"
        min={0}
        step="0.1"
      />
    </div>
  )
}


export default MetricsAlerts
