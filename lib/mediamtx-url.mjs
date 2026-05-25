const DEFAULT_API_BASE_URL = "/api/mediamtx"
const DEFAULT_HLS_BASE_URL = "http://localhost:8888"
const DEFAULT_PLAYBACK_BASE_URL = "http://localhost:8888"
const DEFAULT_METRICS_BASE_URL = "http://localhost:9998"
const DEFAULT_PPROF_BASE_URL = "http://localhost:9999"

function trimTrailingSlashes(value) {
  return value.replace(/\/+$/, "")
}

function cleanBaseUrl(value, fallback) {
  return trimTrailingSlashes((value || fallback).trim()) || fallback
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

export function normalizeMediaMtxApiBaseUrl(apiUrl = process.env.NEXT_PUBLIC_MEDIAMTX_API_URL) {
  const configuredUrl = cleanBaseUrl(apiUrl, DEFAULT_API_BASE_URL)

  return withBasePath(configuredUrl.replace(/\/v3\/config$/i, "").replace(/\/v3$/i, "") || DEFAULT_API_BASE_URL)
}

export function buildMediaMtxApiUrl(endpoint, apiUrl = process.env.NEXT_PUBLIC_MEDIAMTX_API_URL) {
  const normalizedEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`

  return `${normalizeMediaMtxApiBaseUrl(apiUrl)}${normalizedEndpoint}`
}

export function normalizeMediaMtxHlsBaseUrl(hlsUrl = process.env.NEXT_PUBLIC_MEDIAMTX_HLS_URL) {
  return withBasePath(cleanBaseUrl(hlsUrl, DEFAULT_HLS_BASE_URL))
}

export function buildMediaMtxHlsUrl(pathName, hlsUrl = process.env.NEXT_PUBLIC_MEDIAMTX_HLS_URL) {
  const normalizedPathName = encodeURIComponent(pathName.replace(/^\/+/, ""))

  return `${normalizeMediaMtxHlsBaseUrl(hlsUrl)}/${normalizedPathName}/index.m3u8`
}

export function normalizeMediaMtxPlaybackBaseUrl(playbackUrl = process.env.NEXT_PUBLIC_MEDIAMTX_PLAYBACK_URL) {
  return withBasePath(cleanBaseUrl(playbackUrl, DEFAULT_PLAYBACK_BASE_URL))
}

export function buildMediaMtxPlaybackUrl(pathName, playbackUrl = process.env.NEXT_PUBLIC_MEDIAMTX_PLAYBACK_URL) {
  const normalizedPathName = encodeURIComponent(pathName.replace(/^\/+/, ""))

  return `${normalizeMediaMtxPlaybackBaseUrl(playbackUrl)}/${normalizedPathName}`
}

export function normalizeMediaMtxMetricsBaseUrl(metricsUrl = process.env.NEXT_PUBLIC_MEDIAMTX_METRICS_URL) {
  return withBasePath(cleanBaseUrl(metricsUrl, DEFAULT_METRICS_BASE_URL))
}

export function buildMediaMtxMetricsUrl(endpoint = "/metrics", metricsUrl = process.env.NEXT_PUBLIC_MEDIAMTX_METRICS_URL) {
  const normalizedEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`

  return `${normalizeMediaMtxMetricsBaseUrl(metricsUrl)}${normalizedEndpoint}`
}

export function normalizeMediaMtxPprofBaseUrl(pprofUrl = process.env.NEXT_PUBLIC_MEDIAMTX_PPROF_URL) {
  return withBasePath(cleanBaseUrl(pprofUrl, DEFAULT_PPROF_BASE_URL))
}

export function buildMediaMtxPprofUrl(endpoint = "/debug/pprof", pprofUrl = process.env.NEXT_PUBLIC_MEDIAMTX_PPROF_URL) {
  const normalizedEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`

  return `${normalizeMediaMtxPprofBaseUrl(pprofUrl)}${normalizedEndpoint}`
}
