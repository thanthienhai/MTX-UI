import assert from "node:assert/strict"
import fs from "node:fs"

import {
  buildMediaMtxApiUrl,
  buildMediaMtxHlsUrl,
  buildMediaMtxMetricsUrl,
  buildMediaMtxPlaybackUrl,
  buildMediaMtxPprofUrl,
  normalizeMediaMtxApiBaseUrl,
  normalizeMediaMtxHlsBaseUrl,
  normalizeMediaMtxMetricsBaseUrl,
  normalizeMediaMtxPlaybackBaseUrl,
  normalizeMediaMtxPprofBaseUrl,
} from "../lib/mediamtx-url.mjs"

assert.equal(normalizeMediaMtxApiBaseUrl(undefined), "/api/mediamtx")
assert.equal(normalizeMediaMtxApiBaseUrl("http://localhost:9997/"), "http://localhost:9997")
assert.equal(normalizeMediaMtxApiBaseUrl("http://localhost/v3"), "http://localhost")
assert.equal(normalizeMediaMtxApiBaseUrl("http://localhost/v3/config"), "http://localhost")

assert.equal(
  buildMediaMtxApiUrl("/v3/config/global/get", "/api/mediamtx"),
  "/api/mediamtx/v3/config/global/get",
)
assert.equal(
  buildMediaMtxApiUrl("/v3/config/global/get", "http://localhost/v3/config"),
  "http://localhost/v3/config/global/get",
)
assert.equal(buildMediaMtxHlsUrl("mystream", "http://localhost/hls/"), "http://localhost/hls/mystream/index.m3u8")
assert.equal(buildMediaMtxHlsUrl("cam 1", "http://localhost/hls/"), "http://localhost/hls/cam%201/index.m3u8")
assert.equal(normalizeMediaMtxHlsBaseUrl(undefined), "http://localhost:8888")
assert.equal(normalizeMediaMtxPlaybackBaseUrl(undefined), "http://localhost:8888")
assert.equal(normalizeMediaMtxMetricsBaseUrl(undefined), "http://localhost:9998")
assert.equal(normalizeMediaMtxPprofBaseUrl(undefined), "http://localhost:9999")
assert.equal(buildMediaMtxPlaybackUrl("cam 1", "http://playback/"), "http://playback/cam%201")
assert.equal(buildMediaMtxMetricsUrl("metrics", "http://metrics/"), "http://metrics/metrics")
assert.equal(buildMediaMtxPprofUrl("/debug/pprof/profile", "http://pprof/"), "http://pprof/debug/pprof/profile")

const dockerfile = fs.readFileSync("Dockerfile", "utf8")
const prodCompose = fs.readFileSync("docker-compose.prod.yml", "utf8")

assert.ok(!dockerfile.includes('NEXT_PUBLIC_MEDIAMTX_API_URL="http://localhost:80/v3/config"'))
assert.ok(!prodCompose.includes("NEXT_PUBLIC_MEDIAMTX_API_URL=http://mediamtx:9997"))
assert.ok(prodCompose.includes("MEDIAMTX_API_URL=http://mediamtx:9997"))
