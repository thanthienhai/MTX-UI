import assert from "node:assert/strict"
import {
  buildDashboardOverview,
  calculateBitrate,
  formatBitsPerSecond,
  getTrafficTotals,
  hasConfigMismatch,
  serviceStatus,
} from "../lib/dashboard-overview.mjs"

assert.equal(serviceStatus(true), "enabled")
assert.equal(serviceStatus(false), "disabled")
assert.equal(serviceStatus(undefined), "unknown")
assert.equal(serviceStatus(true, false), "disabled")

const trafficTotals = getTrafficTotals(
  [
    { bytesReceived: 100, bytesSent: 200 },
    { bytesReceived: 50, bytesSent: 75 },
  ],
  [{ bytesSent: 25 }],
  [[{ bytesReceived: 10, bytesSent: 20 }]],
)
assert.deepEqual(trafficTotals, { bytesReceived: 160, bytesSent: 320 })

assert.deepEqual(calculateBitrate(null, { timestamp: 1000, bytesReceived: 10, bytesSent: 20 }), {
  inboundBps: null,
  outboundBps: null,
  unavailableReason: "first_sample",
})
assert.deepEqual(
  calculateBitrate(
    { timestamp: 1000, bytesReceived: 100, bytesSent: 100 },
    { timestamp: 3000, bytesReceived: 300, bytesSent: 500 },
  ),
  { inboundBps: 800, outboundBps: 1600, unavailableReason: null },
)
assert.deepEqual(
  calculateBitrate(
    { timestamp: 1000, bytesReceived: 500, bytesSent: 500 },
    { timestamp: 3000, bytesReceived: 100, bytesSent: 600 },
  ),
  { inboundBps: null, outboundBps: null, unavailableReason: "counter_reset" },
)

assert.equal(formatBitsPerSecond(null), "n/a")
assert.equal(formatBitsPerSecond(900), "900 bps")
assert.equal(formatBitsPerSecond(1200), "1.20 Kbps")
assert.equal(formatBitsPerSecond(1_200_000), "1.20 Mbps")

assert.equal(hasConfigMismatch({ api: true }, { api: false }), true)
assert.equal(hasConfigMismatch({ api: true }, { api: true }), false)

const overview = buildDashboardOverview({
  paths: [{ name: "camera-a" }, { name: "all_others" }],
  livePaths: [{ name: "camera-a", ready: true, readers: [{ type: "rtsp" }], bytesReceived: 100, bytesSent: 200 }],
  globalConfig: {
    api: true,
    metrics: false,
    pprof: true,
    rtsp: true,
    rtmp: true,
    hls: true,
    webrtc: false,
    srt: true,
  },
  hlsMuxers: [{ name: "camera-a", bytesSent: 25 }],
  protocolCounts: { rtspSessions: 1, rtmpConnections: 2, srtConnections: 1, webrtcSessions: 0 },
  permissions: { metrics: false, playback: true },
  localConfig: { api: true },
  apiLatencyMs: 42,
  metricsStatus: { status: "disabled" },
  lastConfigUpdateAt: "2026-05-22T00:00:00.000Z",
  bitrate: { inboundBps: 800, outboundBps: 1600 },
})

assert.equal(overview.serviceStatus.api, "enabled")
assert.equal(overview.serviceStatus.metrics, "disabled")
assert.equal(overview.serviceStatus.playback, "enabled")
assert.equal(overview.streams.configuredPaths, 1)
assert.equal(overview.streams.readyPaths, 1)
assert.equal(overview.streams.totalReaders, 1)
assert.equal(overview.streams.protocolSummary.rtsp, 1)
assert.equal(overview.streams.protocolSummary.rtmp, 2)
assert.equal(overview.streams.protocolSummary.hls, 1)
assert.equal(overview.streams.trafficTotals.bytesSent, 225)
assert.equal(overview.health.apiLatencyMs, 42)
