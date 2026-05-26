"use client"

import { useEffect, useRef, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AlertTriangle, Activity, CheckCircle2 } from "lucide-react"
import { buildMediaMtxMetricsUrl } from "@/lib/mediamtx-url.mjs"
import { parsePrometheus, deltaSnapshots } from "@/lib/prometheus.mjs"

interface PromSample {
  name: string
  labels: Record<string, string>
  value: number
}
interface SampleDelta {
  name: string
  labels: Record<string, string>
  delta: number
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
}

const DEFAULT_THRESHOLDS: Thresholds = {
  packetLossPerSec: 1,
  jitterMs: 50,
  framesDiscardedPerSec: 1,
  errorFramesPerSec: 1,
}

/**
 * MediaMTX exposes metrics with names that varied across versions.
 * For each alert category we try the most likely names in order. The first
 * matching set of samples is used.
 */
const METRIC_NAMES = {
  // gauge: 1 if path is ready, 0 otherwise. Some builds use `paths{...,state="ready"}` with name=labels.
  ready: ["paths_ready", "mediamtx_paths_ready"],
  readers: ["paths_readers", "mediamtx_paths_readers"],
  // jitter gauge per path or per session
  jitter: ["paths_jitter", "rtsp_sessions_jitter", "rtsp_sessions_rtp_jitter"],
  // counter: rtp packets lost
  packetsLost: [
    "rtsp_sessions_rtp_packets_lost",
    "rtsp_session_rtp_packets_lost",
    "paths_packets_lost",
    "mediamtx_packets_lost",
  ],
  framesDiscarded: ["paths_frames_discarded", "mediamtx_frames_discarded"],
  framesError: ["paths_frames_error", "paths_errors", "mediamtx_frames_error"],
}

interface MetricsAlertsProps {
  pollMs?: number
}

export function MetricsAlerts({ pollMs = 15_000 }: MetricsAlertsProps) {
  const [error, setError] = useState<string | null>(null)
  const [hasSnapshot, setHasSnapshot] = useState(false)
  const [thresholds, setThresholds] = useState<Thresholds>(DEFAULT_THRESHOLDS)
  const [alerts, setAlerts] = useState<AlertEntry[]>([])
  const prevSamplesRef = useRef<PromSample[] | null>(null)
  const prevAtRef = useRef<number>(0)
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

        const computed = computeAlerts(parsed, prev, elapsedSec, thresholdsRef.current)
        setAlerts(computed)
        setError(null)
        setHasSnapshot(true)
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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Activity className="h-4 w-4" /> Metrics alerts
        </CardTitle>
        <CardDescription>
          Quét metrics MediaMTX mỗi {Math.round(pollMs / 1000)}s. Cảnh báo dựa trên delta giữa các snapshot
          (packet loss, jitter, frames discarded, frames có lỗi, không có reader, source offline).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
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
        </div>

        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 p-2 text-sm text-red-800">
            Không lấy được metrics: {error}
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

/** Find first metric name in `candidates` that has samples in `parsed`. */
function pickByName(parsed: PromSample[], candidates: readonly string[]): { name: string; samples: PromSample[] } {
  for (const name of candidates) {
    const samples = parsed.filter((s) => s.name === name)
    if (samples.length > 0) return { name, samples }
  }
  return { name: candidates[0], samples: [] }
}

function pathLabel(labels: Record<string, string>): string | undefined {
  return labels.name || labels.path || labels.id
}

function computeAlerts(
  curr: PromSample[],
  prev: PromSample[] | null,
  elapsedSec: number,
  thresholds: Thresholds,
): AlertEntry[] {
  const out: AlertEntry[] = []

  const { samples: readySamples } = pickByName(curr, METRIC_NAMES.ready)
  for (const s of readySamples) {
    if (s.value === 0) {
      const name = pathLabel(s.labels)
      out.push({
        id: `offline-${name || JSON.stringify(s.labels)}`,
        severity: "high",
        title: "Source offline",
        detail: `Path ${name || "(unnamed)"} đang không ready. Kiểm tra source/connection upstream.`,
        pathName: name,
      })
    }
  }

  const { samples: readersSamples } = pickByName(curr, METRIC_NAMES.readers)
  for (const s of readersSamples) {
    if (s.value === 0) {
      const name = pathLabel(s.labels)
      const isReady = readySamples.find((r) => pathLabel(r.labels) === name)?.value
      if (isReady && isReady > 0) {
        out.push({
          id: `no-readers-${name}`,
          severity: "low",
          title: "Không có reader",
          detail: `Path ${name || "(unnamed)"} đang publish nhưng không ai đọc.`,
          pathName: name,
        })
      }
    }
  }

  if (!prev || elapsedSec <= 0) return out

  const { samples: jitterSamples } = pickByName(curr, METRIC_NAMES.jitter)
  for (const s of jitterSamples) {
    const ms = s.value * 1000
    if (ms >= thresholds.jitterMs) {
      const name = pathLabel(s.labels)
      out.push({
        id: `jitter-${name || JSON.stringify(s.labels)}`,
        severity: ms >= thresholds.jitterMs * 2 ? "high" : "medium",
        title: "Jitter cao",
        detail: `Jitter ${ms.toFixed(1)} ms (ngưỡng ${thresholds.jitterMs} ms)`,
        pathName: name,
      })
    }
  }

  const pushDeltaAlert = (
    deltas: SampleDelta[],
    threshold: number,
    titleBase: string,
    highMultiplier = 5,
  ) => {
    for (const d of deltas) {
      const rate = d.delta / elapsedSec
      if (rate >= threshold) {
        const name = pathLabel(d.labels)
        out.push({
          id: `${titleBase}-${d.name}-${name || JSON.stringify(d.labels)}`,
          severity: rate >= threshold * highMultiplier ? "high" : "medium",
          title: titleBase,
          detail: `${rate.toFixed(2)}/s (ngưỡng ${threshold}/s) — metric ${d.name}`,
          pathName: name,
        })
      }
    }
  }

  const lossNames = METRIC_NAMES.packetsLost
  pushDeltaAlert(
    deltaSnapshots(
      prev.filter((s) => lossNames.includes(s.name)),
      curr.filter((s) => lossNames.includes(s.name)),
    ),
    thresholds.packetLossPerSec,
    "Packet loss",
  )

  const discardNames = METRIC_NAMES.framesDiscarded
  pushDeltaAlert(
    deltaSnapshots(
      prev.filter((s) => discardNames.includes(s.name)),
      curr.filter((s) => discardNames.includes(s.name)),
    ),
    thresholds.framesDiscardedPerSec,
    "Frames discarded",
    3,
  )

  const errorNames = METRIC_NAMES.framesError
  pushDeltaAlert(
    deltaSnapshots(
      prev.filter((s) => errorNames.includes(s.name)),
      curr.filter((s) => errorNames.includes(s.name)),
    ),
    thresholds.errorFramesPerSec,
    "Error frames",
    3,
  )

  return out
}

export default MetricsAlerts
