"use client"

import { useEffect, useRef, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AlertTriangle, Activity, CheckCircle2 } from "lucide-react"
import { buildMediaMtxMetricsUrl } from "@/lib/mediamtx-url.mjs"
import { parsePrometheus, filterSamples, deltaSnapshots, type PromSample } from "@/lib/prometheus"

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

interface MetricsAlertsProps {
  pollMs?: number
}

export function MetricsAlerts({ pollMs = 15_000 }: MetricsAlertsProps) {
  const [samples, setSamples] = useState<PromSample[]>([])
  const [error, setError] = useState<string | null>(null)
  const [thresholds, setThresholds] = useState<Thresholds>(DEFAULT_THRESHOLDS)
  const [alerts, setAlerts] = useState<AlertEntry[]>([])
  const prevSamplesRef = useRef<PromSample[] | null>(null)
  const prevAtRef = useRef<number>(0)

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

        const computed = computeAlerts(parsed, prev, elapsedSec, thresholds)
        setSamples(parsed)
        setAlerts(computed)
        setError(null)
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
  }, [pollMs, thresholds])

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

        {!error && alerts.length === 0 && samples.length > 0 && (
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

function computeAlerts(
  curr: PromSample[],
  prev: PromSample[] | null,
  elapsedSec: number,
  thresholds: Thresholds,
): AlertEntry[] {
  const out: AlertEntry[] = []

  // Source offline: paths_ready == 0 for a configured path? Check `paths{state="ready"}`-style metrics.
  // MediaMTX exposes per-path readiness via `paths_bytes_received` etc.; we use the simpler heuristic:
  // if `paths_ready` exists per path with value 0 -> source offline.
  const ready = filterSamples(curr, "paths_ready")
  for (const s of ready) {
    if (s.value === 0) {
      out.push({
        id: `offline-${s.labels.name}`,
        severity: "high",
        title: "Source offline",
        detail: `Path ${s.labels.name || "(unnamed)"} đang không ready. Kiểm tra source/connection upstream.`,
        pathName: s.labels.name,
      })
    }
  }

  // No readers: paths_readers == 0 cho path đang ready
  const readers = filterSamples(curr, "paths_readers")
  for (const s of readers) {
    if (s.value === 0) {
      const isReady = ready.find((r) => r.labels.name === s.labels.name)?.value
      if (isReady && isReady > 0) {
        out.push({
          id: `no-readers-${s.labels.name}`,
          severity: "low",
          title: "Không có reader",
          detail: `Path ${s.labels.name || "(unnamed)"} đang publish nhưng không ai đọc.`,
          pathName: s.labels.name,
        })
      }
    }
  }

  if (!prev || elapsedSec <= 0) return out

  // Jitter (RTSP RTP jitter — exposed as paths_jitter or rtsp_session_jitter on newer MediaMTX builds)
  const jitterNow = filterSamples(curr, "paths_jitter")
  for (const s of jitterNow) {
    const ms = s.value * 1000
    if (ms >= thresholds.jitterMs) {
      out.push({
        id: `jitter-${s.labels.name}`,
        severity: ms >= thresholds.jitterMs * 2 ? "high" : "medium",
        title: "Jitter cao",
        detail: `Jitter ${ms.toFixed(1)} ms (ngưỡng ${thresholds.jitterMs} ms)`,
        pathName: s.labels.name,
      })
    }
  }

  // Packet loss delta
  const lossDeltas = deltaSnapshots(
    prev.filter((s) => s.name === "rtsp_session_rtp_packets_lost" || s.name === "paths_packets_lost"),
    curr.filter((s) => s.name === "rtsp_session_rtp_packets_lost" || s.name === "paths_packets_lost"),
  )
  for (const [key, delta] of lossDeltas) {
    const rate = delta / elapsedSec
    if (rate >= thresholds.packetLossPerSec) {
      const name = /name="([^"]+)"/.exec(key)?.[1]
      out.push({
        id: `loss-${key}`,
        severity: rate >= thresholds.packetLossPerSec * 5 ? "high" : "medium",
        title: "Packet loss",
        detail: `${rate.toFixed(2)} packet/s mất (ngưỡng ${thresholds.packetLossPerSec}/s)`,
        pathName: name,
      })
    }
  }

  // Frames discarded
  const discardDeltas = deltaSnapshots(
    prev.filter((s) => s.name === "paths_frames_discarded"),
    curr.filter((s) => s.name === "paths_frames_discarded"),
  )
  for (const [key, delta] of discardDeltas) {
    const rate = delta / elapsedSec
    if (rate >= thresholds.framesDiscardedPerSec) {
      const name = /name="([^"]+)"/.exec(key)?.[1]
      out.push({
        id: `discard-${key}`,
        severity: "medium",
        title: "Frames discarded",
        detail: `${rate.toFixed(2)} frame/s bị drop (ngưỡng ${thresholds.framesDiscardedPerSec}/s)`,
        pathName: name,
      })
    }
  }

  // Error frames
  const errDeltas = deltaSnapshots(
    prev.filter((s) => s.name === "paths_frames_error" || s.name === "paths_errors"),
    curr.filter((s) => s.name === "paths_frames_error" || s.name === "paths_errors"),
  )
  for (const [key, delta] of errDeltas) {
    const rate = delta / elapsedSec
    if (rate >= thresholds.errorFramesPerSec) {
      const name = /name="([^"]+)"/.exec(key)?.[1]
      out.push({
        id: `err-${key}`,
        severity: "medium",
        title: "Error frames",
        detail: `${rate.toFixed(2)} frame/s lỗi (ngưỡng ${thresholds.errorFramesPerSec}/s)`,
        pathName: name,
      })
    }
  }

  return out
}

export default MetricsAlerts
