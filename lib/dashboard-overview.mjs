export const OVERVIEW_SERVICE_NAMES = ["api", "metrics", "pprof", "playback", "rtsp", "rtmp", "hls", "webrtc", "srt"]

/**
 * @param {unknown} enabled
 * @param {boolean} [permitted]
 */
export function serviceStatus(enabled, permitted = true) {
  if (!permitted) return "disabled"
  if (enabled === undefined || enabled === null) return "unknown"
  return enabled ? "enabled" : "disabled"
}

/**
 * @param {any[]} [livePaths]
 * @param {any[]} [hlsMuxers]
 * @param {any[]} [protocolResources]
 */
export function getTrafficTotals(livePaths = [], hlsMuxers = [], protocolResources = []) {
  const pathTotals = livePaths.reduce(
    (totals, path) => {
      totals.bytesReceived += Number(path?.bytesReceived || 0)
      totals.bytesSent += Number(path?.bytesSent || 0)
      return totals
    },
    { bytesReceived: 0, bytesSent: 0 },
  )

  const protocolTotals = protocolResources.flat().reduce(
    (totals, resource) => {
      totals.bytesReceived += Number(resource?.bytesReceived || 0)
      totals.bytesSent += Number(resource?.bytesSent || 0)
      return totals
    },
    { bytesReceived: 0, bytesSent: 0 },
  )

  const hlsBytesSent = hlsMuxers.reduce((sum, muxer) => sum + Number(muxer?.bytesSent || 0), 0)

  return {
    bytesReceived: pathTotals.bytesReceived + protocolTotals.bytesReceived,
    bytesSent: pathTotals.bytesSent + protocolTotals.bytesSent + hlsBytesSent,
  }
}

/**
 * @param {{ timestamp: number, bytesReceived: number, bytesSent: number } | null} previousSample
 * @param {{ timestamp: number, bytesReceived: number, bytesSent: number } | null} currentSample
 */
export function calculateBitrate(previousSample, currentSample) {
  if (!previousSample || !currentSample) {
    return { inboundBps: null, outboundBps: null, unavailableReason: "first_sample" }
  }

  const elapsedSeconds = (currentSample.timestamp - previousSample.timestamp) / 1000
  if (elapsedSeconds <= 0) {
    return { inboundBps: null, outboundBps: null, unavailableReason: "invalid_elapsed_time" }
  }

  const inboundDelta = currentSample.bytesReceived - previousSample.bytesReceived
  const outboundDelta = currentSample.bytesSent - previousSample.bytesSent
  if (inboundDelta < 0 || outboundDelta < 0) {
    return { inboundBps: null, outboundBps: null, unavailableReason: "counter_reset" }
  }

  return {
    inboundBps: (inboundDelta * 8) / elapsedSeconds,
    outboundBps: (outboundDelta * 8) / elapsedSeconds,
    unavailableReason: null,
  }
}

/**
 * @param {Record<string, number>} [protocolCounts]
 * @param {any[]} [hlsMuxers]
 */
export function getProtocolSummary(protocolCounts = {}, hlsMuxers = []) {
  const sumAvailable = (...values) => {
    if (values.some((value) => Number(value) < 0)) return null
    return values.reduce((sum, value) => sum + Number(value || 0), 0)
  }
  const rtsp = sumAvailable(protocolCounts.rtspConnections, protocolCounts.rtspSessions)
  const rtmp = sumAvailable(protocolCounts.rtmpConnections, protocolCounts.rtmpsConnections)
  const srt = sumAvailable(protocolCounts.srtConnections)
  const webrtc = sumAvailable(protocolCounts.webrtcSessions)
  const hls = Number(protocolCounts.hlsMuxers) < 0 ? null : Number(hlsMuxers.length || 0)

  return { rtsp, rtmp, hls, webrtc, srt }
}

/**
 * @param {Record<string, any>} [localConfig]
 * @param {Record<string, any> | null} [globalConfig]
 */
export function hasConfigMismatch(localConfig = {}, globalConfig = null) {
  if (!globalConfig) return false

  const keys = [
    "api",
    "apiAddress",
    "metrics",
    "metricsAddress",
    "rtsp",
    "rtspAddress",
    "rtmp",
    "rtmpAddress",
    "hls",
    "hlsAddress",
    "webrtc",
    "webrtcAddress",
  ]

  return keys.some((key) => localConfig[key] !== undefined && globalConfig[key] !== undefined && localConfig[key] !== globalConfig[key])
}

/**
 * @param {any} [input]
 * @returns {any}
 */
export function buildDashboardOverview({
  paths = [],
  livePaths = [],
  globalConfig = null,
  hlsMuxers = [],
  protocolCounts = {},
  permissions = {},
  localConfig = {},
  apiLatencyMs = null,
  metricsStatus = { status: "unknown" },
  lastConfigUpdateAt = null,
  bitrate = { inboundBps: null, outboundBps: null },
} = {}) {
  const protocolSummary = getProtocolSummary(protocolCounts, hlsMuxers)
  const trafficTotals = getTrafficTotals(livePaths, hlsMuxers)
  const configuredPaths = paths.filter((path) => path?.name !== "all_others").length
  const readyPaths = livePaths.filter((path) => path?.ready).length
  const totalReaders = livePaths.reduce((sum, path) => sum + Number(path?.readers?.length || 0), 0)

  return {
    serviceStatus: {
      api: serviceStatus(globalConfig?.api, permissions.api !== false),
      metrics: serviceStatus(globalConfig?.metrics, permissions.metrics !== false),
      pprof: serviceStatus(globalConfig?.pprof, permissions.pprof !== false),
      playback: serviceStatus(true, permissions.playback !== false),
      rtsp: serviceStatus(globalConfig?.rtsp),
      rtmp: serviceStatus(globalConfig?.rtmp),
      hls: serviceStatus(globalConfig?.hls),
      webrtc: serviceStatus(globalConfig?.webrtc),
      srt: serviceStatus(globalConfig?.srt),
    },
    streams: {
      configuredPaths,
      readyPaths,
      idlePaths: Math.max(configuredPaths - readyPaths, 0),
      totalReaders,
      protocolSummary,
      trafficTotals,
      bitrate,
    },
    health: {
      apiLatencyMs,
      metricsStatus,
      lastConfigUpdateAt,
      configMismatch: hasConfigMismatch(localConfig, globalConfig),
    },
  }
}

/**
 * @param {number | null | undefined} value
 */
export function formatBitsPerSecond(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return "chưa có"
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)} Mbps`
  if (value >= 1_000) return `${(value / 1_000).toFixed(2)} Kbps`
  return `${value.toFixed(0)} bps`
}
