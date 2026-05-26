import assert from "node:assert/strict"
import { parsePrometheus } from "../lib/prometheus.mjs"
import {
  METRIC_NAMES,
  pickByName,
  pathLabel,
  pathsReadyStatus,
  computeAlerts,
} from "../lib/metrics-alerts-engine.mjs"

const THRESHOLDS = {
  packetLossPerSec: 1,
  jitterMs: 50,
  framesDiscardedPerSec: 1,
  errorFramesPerSec: 1,
  stallSeconds: 30,
}

// ── METRIC_NAMES candidate list sane ────────────────────────────────────────
assert.ok(METRIC_NAMES.paths.includes("paths"), "must try bare `paths` metric")
assert.ok(METRIC_NAMES.paths.includes("mediamtx_paths"), "must try `mediamtx_paths` prefix")
assert.ok(METRIC_NAMES.readers.includes("mediamtx_paths_readers"), "must align with MONITORING.md")
assert.ok(METRIC_NAMES.bytesReceived.includes("mediamtx_paths_bytes_received"), "must align with MONITORING.md")

// ── pickByName returns first available ──────────────────────────────────────
{
  const samples = parsePrometheus(`mediamtx_paths_readers{name="cam1"} 2`)
  const picked = pickByName(samples, ["paths_readers", "mediamtx_paths_readers"])
  assert.equal(picked.name, "mediamtx_paths_readers")
  assert.equal(picked.samples.length, 1)
}

// ── pickByName returns empty when no candidate matches ──────────────────────
{
  const samples = parsePrometheus(`other_metric 1`)
  const picked = pickByName(samples, ["x", "y"])
  assert.equal(picked.samples.length, 0)
}

// ── pathLabel picks name|path|id ────────────────────────────────────────────
assert.equal(pathLabel({ name: "cam1" }), "cam1")
assert.equal(pathLabel({ path: "cam2" }), "cam2")
assert.equal(pathLabel({ id: "abc" }), "abc")
assert.equal(pathLabel({}), undefined)

// ── pathsReadyStatus interprets `paths{state=ready}` correctly ──────────────
{
  const samples = parsePrometheus(`
paths{name="cam1",state="ready"} 1
paths{name="cam1",state="notReady"} 0
paths{name="cam2",state="ready"} 0
paths{name="cam2",state="notReady"} 1
paths{name="cam3",state="ready"} 1
`)
  const status = pathsReadyStatus(samples)
  assert.equal(status.get("cam1"), true, "cam1 ready=1 → ready")
  assert.equal(status.get("cam2"), false, "cam2 ready=0,notReady=1 → not ready")
  assert.equal(status.get("cam3"), true)
}

// ── Source offline alert fires for path in non-ready state ─────────────────
{
  const curr = parsePrometheus(`
paths{name="cam2",state="ready"} 0
paths{name="cam2",state="notReady"} 1
`)
  const alerts = computeAlerts(curr, null, 0, THRESHOLDS)
  const offline = alerts.find((a) => a.title === "Source offline" && a.pathName === "cam2")
  assert.ok(offline, "must alert cam2 as offline")
  assert.equal(offline.severity, "high")
}

// ── Source offline does NOT fire for ready paths ──────────────────────────
{
  const curr = parsePrometheus(`paths{name="cam1",state="ready"} 1`)
  const alerts = computeAlerts(curr, null, 0, THRESHOLDS)
  assert.equal(alerts.filter((a) => a.title === "Source offline").length, 0)
}

// ── No readers alert fires only for ready path with 0 readers ──────────────
{
  const curr = parsePrometheus(`
paths{name="cam1",state="ready"} 1
mediamtx_paths_readers{name="cam1"} 0
paths{name="cam2",state="notReady"} 1
mediamtx_paths_readers{name="cam2"} 0
`)
  const alerts = computeAlerts(curr, null, 0, THRESHOLDS)
  const a1 = alerts.find((a) => a.title === "Không có reader" && a.pathName === "cam1")
  const a2 = alerts.find((a) => a.title === "Không có reader" && a.pathName === "cam2")
  assert.ok(a1, "cam1 ready+0 readers must alert")
  assert.equal(a2, undefined, "cam2 not ready → don't double-alert no-readers")
}

// ── Byte-rate stall: ready path with non-increasing bytes counter ───────────
{
  const prev = parsePrometheus(`
paths{name="cam1",state="ready"} 1
mediamtx_paths_bytes_received{name="cam1"} 1000000
`)
  const curr = parsePrometheus(`
paths{name="cam1",state="ready"} 1
mediamtx_paths_bytes_received{name="cam1"} 1000000
`)
  const bytesAt = new Map()
  // First call seeds the "since" time
  computeAlerts(curr, prev, 15, THRESHOLDS, bytesAt, 1000)
  // After 31s elapsed wallclock from `since`, alert should fire
  const alerts = computeAlerts(curr, prev, 15, THRESHOLDS, bytesAt, 1000 + 31_000)
  const stalled = alerts.find((a) => a.title === "Stream stalled" && a.pathName === "cam1")
  assert.ok(stalled, "stall alert must fire after stallSeconds")
}

// ── Byte-rate stall: does NOT fire when bytes are increasing ────────────────
{
  const prev = parsePrometheus(`
paths{name="cam1",state="ready"} 1
mediamtx_paths_bytes_received{name="cam1"} 1000
`)
  const curr = parsePrometheus(`
paths{name="cam1",state="ready"} 1
mediamtx_paths_bytes_received{name="cam1"} 2000
`)
  const alerts = computeAlerts(curr, prev, 15, THRESHOLDS, new Map(), 0)
  assert.equal(alerts.filter((a) => a.title === "Stream stalled").length, 0)
}

// ── Byte-rate stall: does NOT fire for path not in ready state ──────────────
{
  const prev = parsePrometheus(`
paths{name="cam1",state="notReady"} 1
mediamtx_paths_bytes_received{name="cam1"} 1000
`)
  const curr = parsePrometheus(`
paths{name="cam1",state="notReady"} 1
mediamtx_paths_bytes_received{name="cam1"} 1000
`)
  const bytesAt = new Map()
  computeAlerts(curr, prev, 15, THRESHOLDS, bytesAt, 0)
  const alerts = computeAlerts(curr, prev, 15, THRESHOLDS, bytesAt, 60_000)
  assert.equal(alerts.filter((a) => a.title === "Stream stalled").length, 0)
}

// ── Packet loss delta alert ─────────────────────────────────────────────────
{
  const prev = parsePrometheus(`rtsp_sessions_rtp_packets_lost{name="cam1",id="abc"} 100`)
  const curr = parsePrometheus(`rtsp_sessions_rtp_packets_lost{name="cam1",id="abc"} 200`)
  const alerts = computeAlerts(curr, prev, 10, THRESHOLDS, new Map(), 0)
  const loss = alerts.find((a) => a.title === "Packet loss")
  assert.ok(loss, "100 packets lost over 10s = 10/s, threshold 1/s → alert")
  assert.equal(loss.pathName, "cam1")
  assert.equal(loss.severity, "high", "10/s > 5x threshold → high")
}

// ── Packet loss alert NOT fired below threshold ────────────────────────────
{
  const prev = parsePrometheus(`rtsp_sessions_rtp_packets_lost{id="x"} 0`)
  const curr = parsePrometheus(`rtsp_sessions_rtp_packets_lost{id="x"} 1`)
  const alerts = computeAlerts(curr, prev, 30, THRESHOLDS, new Map(), 0)
  assert.equal(alerts.filter((a) => a.title === "Packet loss").length, 0, "1 lost over 30s = 0.03/s < 1/s")
}

// ── Jitter alert when ms exceeds threshold ─────────────────────────────────
{
  const curr = parsePrometheus(`mediamtx_paths_jitter{name="cam1"} 0.075`)
  const alerts = computeAlerts(curr, null, 0, THRESHOLDS)
  const j = alerts.find((a) => a.title === "Jitter cao")
  assert.ok(j, "jitter 75ms > threshold 50ms")
  assert.equal(j.pathName, "cam1")
}

// ── First snapshot (no prev) skips delta-based alerts ──────────────────────
{
  const curr = parsePrometheus(`rtsp_sessions_rtp_packets_lost{id="x"} 1000000`)
  const alerts = computeAlerts(curr, null, 0, THRESHOLDS)
  assert.equal(alerts.filter((a) => a.title === "Packet loss").length, 0)
}

console.log("metrics-alerts engine: all tests passed")
