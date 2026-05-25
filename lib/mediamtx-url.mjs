const DEFAULT_API_BASE_URL = "/api/mediamtx"
const DEFAULT_HLS_BASE_URL = "http://localhost:8888"
const DEFAULT_PLAYBACK_BASE_URL = "http://localhost:8888"
const DEFAULT_METRICS_BASE_URL = "http://localhost:9998"
const DEFAULT_PPROF_BASE_URL = "http://localhost:9999"
const DEFAULT_PROTOCOL_ADDRESSES = {
  rtsp: ":8554",
  rtsps: ":8322",
  rtmp: ":1935",
  rtmps: ":1936",
  hls: ":8888",
  webrtc: ":8889",
  srt: ":8890",
  rtp: ":8000",
  mpegts: ":8890",
}
export const MEDIAMTX_SERVICE_URLS_STORAGE_KEY = "mediamtx_service_urls"
export const MEDIAMTX_SERVICE_URL_FIELDS = ["controlApi", "hls", "playback", "metrics", "pprof"]

function trimTrailingSlashes(value) {
  return value.replace(/\/+$/, "")
}

function cleanBaseUrl(value, fallback) {
  return trimTrailingSlashes((value || fallback).trim()) || fallback
}

function normalizePathName(pathName) {
  const cleaned = String(pathName || "stream").replace(/^\/+/, "").trim()
  return cleaned || "stream"
}

function normalizeProtocolAddress(address, fallback, host = "localhost") {
  const value = String(address || fallback || "").trim()
  if (!value) return `${host}`
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(value)) return value.replace(/\/+$/, "")
  if (value.startsWith(":")) return `${host}${value}`
  if (/^\d+$/.test(value)) return `${host}:${value}`
  return value.replace(/\/+$/, "")
}

/**
 * Returns the configured base path (e.g. "/MTX-UI") or empty string.
 * Used to prepend to same-origin proxy paths when the app is deployed
 * under a sub-path (GitHub Pages, etc.).
 */
function getBasePath() {
  return (process.env.NEXT_PUBLIC_BASE_PATH || "").replace(/\/+$/, "")
}

/**
 * Prepends basePath to same-origin (starts with "/") URLs.
 * For absolute URLs (http://...), basePath is not prepended.
 */
function withBasePath(url) {
  const basePath = getBasePath()
  if (!basePath) return url
  if (!url.startsWith("/")) return url
  return `${basePath}${url}`
}

function getBrowserStorage() {
  if (typeof window === "undefined") return null
  return window.localStorage
}

export function getStoredMediaMtxServiceUrls() {
  const raw = getBrowserStorage()?.getItem(MEDIAMTX_SERVICE_URLS_STORAGE_KEY)
  if (!raw) return {}

  try {
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== "object") return {}
    return MEDIAMTX_SERVICE_URL_FIELDS.reduce((urls, key) => {
      if (typeof parsed[key] === "string") urls[key] = parsed[key]
      return urls
    }, {})
  } catch {
    return {}
  }
}

export function saveMediaMtxServiceUrls(urls) {
  const normalized = MEDIAMTX_SERVICE_URL_FIELDS.reduce((values, key) => {
    if (typeof urls?.[key] === "string") values[key] = urls[key].trim()
    return values
  }, {})
  getBrowserStorage()?.setItem(MEDIAMTX_SERVICE_URLS_STORAGE_KEY, JSON.stringify(normalized))
  return normalized
}

export function clearMediaMtxServiceUrls() {
  getBrowserStorage()?.removeItem(MEDIAMTX_SERVICE_URLS_STORAGE_KEY)
}

export function validateMediaMtxServiceUrls(urls) {
  const errors = {}
  for (const key of MEDIAMTX_SERVICE_URL_FIELDS) {
    const value = urls?.[key]
    if (typeof value !== "string" || !value.trim()) {
      errors[key] = "Cần nhập URL dịch vụ."
      continue
    }
    const trimmed = value.trim()
    if (trimmed.startsWith("/")) continue
    try {
      const parsed = new URL(trimmed)
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        errors[key] = "URL phải dùng http hoặc https."
      }
    } catch {
      errors[key] = "URL không hợp lệ."
    }
  }
  return errors
}

function resolveServiceUrl(key, explicitValue, envValue) {
  if (explicitValue !== undefined) return explicitValue
  return getStoredMediaMtxServiceUrls()[key] || envValue
}

export function normalizeMediaMtxApiBaseUrl(apiUrl) {
  apiUrl = resolveServiceUrl("controlApi", apiUrl, process.env.NEXT_PUBLIC_MEDIAMTX_API_URL)
  const configuredUrl = cleanBaseUrl(apiUrl, DEFAULT_API_BASE_URL)

  return withBasePath(configuredUrl.replace(/\/v3\/config$/i, "").replace(/\/v3$/i, "") || DEFAULT_API_BASE_URL)
}

export function buildMediaMtxApiUrl(endpoint, apiUrl) {
  const normalizedEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`

  return `${normalizeMediaMtxApiBaseUrl(apiUrl)}${normalizedEndpoint}`
}

export function normalizeMediaMtxHlsBaseUrl(hlsUrl) {
  hlsUrl = resolveServiceUrl("hls", hlsUrl, process.env.NEXT_PUBLIC_MEDIAMTX_HLS_URL)
  return withBasePath(cleanBaseUrl(hlsUrl, DEFAULT_HLS_BASE_URL))
}

export function buildMediaMtxHlsUrl(pathName, hlsUrl) {
  const normalizedPathName = encodeURIComponent(normalizePathName(pathName))

  return `${normalizeMediaMtxHlsBaseUrl(hlsUrl)}/${normalizedPathName}/index.m3u8`
}

export function normalizeMediaMtxPlaybackBaseUrl(playbackUrl) {
  playbackUrl = resolveServiceUrl("playback", playbackUrl, process.env.NEXT_PUBLIC_MEDIAMTX_PLAYBACK_URL)
  return withBasePath(cleanBaseUrl(playbackUrl, DEFAULT_PLAYBACK_BASE_URL))
}

export function buildMediaMtxPlaybackUrl(pathName, playbackUrl) {
  const normalizedPathName = encodeURIComponent(normalizePathName(pathName))

  return `${normalizeMediaMtxPlaybackBaseUrl(playbackUrl)}/${normalizedPathName}`
}

export function normalizeMediaMtxMetricsBaseUrl(metricsUrl) {
  metricsUrl = resolveServiceUrl("metrics", metricsUrl, process.env.NEXT_PUBLIC_MEDIAMTX_METRICS_URL)
  return withBasePath(cleanBaseUrl(metricsUrl, DEFAULT_METRICS_BASE_URL))
}

export function buildMediaMtxMetricsUrl(endpoint = "/metrics", metricsUrl) {
  const normalizedEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`

  return `${normalizeMediaMtxMetricsBaseUrl(metricsUrl)}${normalizedEndpoint}`
}

export function normalizeMediaMtxPprofBaseUrl(pprofUrl) {
  pprofUrl = resolveServiceUrl("pprof", pprofUrl, process.env.NEXT_PUBLIC_MEDIAMTX_PPROF_URL)
  return withBasePath(cleanBaseUrl(pprofUrl, DEFAULT_PPROF_BASE_URL))
}

export function buildMediaMtxPprofUrl(endpoint = "/debug/pprof", pprofUrl) {
  const normalizedEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`

  return `${normalizeMediaMtxPprofBaseUrl(pprofUrl)}${normalizedEndpoint}`
}

export function buildMediaMtxWebRtcReadUrl(pathName, options = {}) {
  const baseUrl = options.baseUrl || options.webrtcUrl || normalizeMediaMtxPlaybackBaseUrl(options.playbackUrl)
  return `${cleanBaseUrl(baseUrl, DEFAULT_PLAYBACK_BASE_URL)}/${encodeURIComponent(normalizePathName(pathName))}/whep`
}

export function buildMediaMtxWebRtcPublishUrl(pathName, options = {}) {
  const baseUrl = options.baseUrl || options.webrtcUrl || normalizeMediaMtxPlaybackBaseUrl(options.playbackUrl)
  return `${cleanBaseUrl(baseUrl, DEFAULT_PLAYBACK_BASE_URL)}/${encodeURIComponent(normalizePathName(pathName))}/whip`
}

export function buildMediaMtxProtocolUrl(protocol, pathName = "stream", options = {}) {
  const normalizedProtocol = String(protocol || "").toLowerCase()
  const path = encodeURIComponent(normalizePathName(pathName))
  const address = normalizeProtocolAddress(
    options.address,
    DEFAULT_PROTOCOL_ADDRESSES[normalizedProtocol],
    options.host || "localhost",
  )

  if (normalizedProtocol === "srt") {
    return `srt://${address}?streamid=${path}`
  }

  if (normalizedProtocol === "rtp") {
    return `udp+rtp://${address}`
  }

  if (normalizedProtocol === "mpegts") {
    return `udp+mpegts://${address}`
  }

  if (["rtsp", "rtsps", "rtmp", "rtmps"].includes(normalizedProtocol)) {
    return `${normalizedProtocol}://${address}/${path}`
  }

  return `${normalizedProtocol || "protocol"}://${address}/${path}`
}

export function buildMediaMtxProtocolUrls(pathName = "stream", config = {}, options = {}) {
  return {
    hlsRead: buildMediaMtxHlsUrl(pathName, options.hlsUrl),
    webrtcRead: buildMediaMtxWebRtcReadUrl(pathName, options),
    webrtcPublish: buildMediaMtxWebRtcPublishUrl(pathName, options),
    rtspRead: buildMediaMtxProtocolUrl("rtsp", pathName, { address: config.rtspAddress }),
    rtspsRead: buildMediaMtxProtocolUrl("rtsps", pathName, { address: config.rtspsAddress }),
    rtmpPublish: buildMediaMtxProtocolUrl("rtmp", pathName, { address: config.rtmpAddress }),
    rtmpsPublish: buildMediaMtxProtocolUrl("rtmps", pathName, { address: config.rtmpsAddress }),
    srtRead: buildMediaMtxProtocolUrl("srt", pathName, { address: config.srtAddress }),
    rtpSource: buildMediaMtxProtocolUrl("rtp", pathName, { address: config.rtpAddress }),
    mpegtsSource: buildMediaMtxProtocolUrl("mpegts", pathName, { address: config.mpegtsAddress || config.srtAddress }),
  }
}

/**
 * Build stream URLs specifically for path management display.
 * Handles normal path names, regex path names (e.g. ~^camera\d+$),
 * and all_others through consistent encodeURIComponent encoding.
 *
 * Unlike buildMediaMtxProtocolUrls which requires global config,
 * this function generates URLs from explicit base/service addresses.
 * Returns null for protocols where no address is configured.
 */
export function buildPathStreamUrls(pathName, serviceUrls = {}) {
  const path = encodeURIComponent(normalizePathName(pathName))

  const hlsBase = serviceUrls.hlsUrl || normalizeMediaMtxHlsBaseUrl(serviceUrls.hlsUrl)
  const playbackBase = serviceUrls.playbackUrl || normalizeMediaMtxPlaybackBaseUrl(serviceUrls.playbackUrl)

  return {
    rtsp: serviceUrls.rtspAddress ? `rtsp://${serviceUrls.rtspAddress.replace(/^:/, "localhost:")}/${path}` : null,
    rtsps: serviceUrls.rtspsAddress ? `rtsps://${serviceUrls.rtspsAddress.replace(/^:/, "localhost:")}/${path}` : null,
    rtmp: serviceUrls.rtmpAddress ? `rtmp://${serviceUrls.rtmpAddress.replace(/^:/, "localhost:")}/${path}` : null,
    hls: hlsBase ? `${hlsBase}/${path}/index.m3u8` : null,
    webrtc: playbackBase ? `${playbackBase}/${path}/whep` : null,
    srt: serviceUrls.srtAddress
      ? `srt://${serviceUrls.srtAddress.replace(/^:/, "localhost:")}?streamid=${path}`
      : null,
  }
}

/**
 * Determine if a path name is a regex pattern (MediaMTX convention).
 * Regex path names start with "~" followed by a regex pattern.
 */
export function isRegexPathName(pathName) {
  return typeof pathName === "string" && pathName.startsWith("~") && pathName.length > 1
}

/**
 * Determine if a path name is the special "all_others" catch-all.
 */
export function isAllOthersPathName(pathName) {
  return pathName === "all_others"
}

/**
 * Classify a path name into its mode: "normal", "regex", or "all_others".
 */
export function getPathNameMode(pathName) {
  if (!pathName || typeof pathName !== "string") return "normal"
  if (pathName === "all_others") return "all_others"
  if (pathName.startsWith("~") && pathName.length > 1) return "regex"
  return "normal"
}
