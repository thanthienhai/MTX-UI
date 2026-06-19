/**
 * Relay event domain logic (server-side, framework-agnostic).
 *
 * An "event" is a single MediaMTX path whose name IS the secret ingest key.
 * Event metadata (display name, share tokens, login-code hash, fan-out
 * destinations, quota) has nowhere to live in MediaMTX path config, so we
 * smuggle it as a shell comment appended to `runOnReady`:
 *
 *   ffmpeg ... -f tee "[f=flv]url1|[f=flv]url2"   # RELAY_META:{base64url-json}
 *
 * The `#` makes the JSON a no-op for the shell that runs `runOnReady`, while
 * keeping the metadata travelling with the path config (the user's storage
 * constraint: no separate DB).
 *
 * Pure functions only — no Next.js, no fetch. Consumed by `lib/relay-server.ts`.
 */

import { createHash, createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto"
import { buildMediaMtxProtocolUrl } from "./mediamtx-url.mjs"

export const META_PREFIX = "# RELAY_META:"
export const META_VERSION = 1
const SCRYPT_KEYLEN = 32

/** Platform identifiers a destination can target. */
export const RELAY_PLATFORMS = ["facebook", "youtube", "custom"]

/** Local MediaMTX read URL that ffmpeg pulls from to fan out. */
function localReadUrl(pathKey) {
  return buildMediaMtxProtocolUrl("rtsp", pathKey, { address: ":8554", host: "localhost" })
}

/* ------------------------------------------------------------------ */
/* Tokens & secrets                                                    */
/* ------------------------------------------------------------------ */

/** URL-safe random token (base64url, no padding). */
export function generateToken(bytes = 18) {
  return randomBytes(bytes).toString("base64url")
}

/**
 * Stream/ingest key: alnum only so it survives URL paths, RTMP app names and
 * SRT streamids without escaping. ~20 chars ≈ 119 bits of entropy.
 */
export function generateStreamKey(length = 20) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
  const bytes = randomBytes(length)
  let out = ""
  for (let i = 0; i < length; i++) out += alphabet[bytes[i] % alphabet.length]
  return out
}

/** Human-friendly login code (no ambiguous chars), e.g. "WRx7nJJIqSY". */
export function generateLoginCode(length = 11) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789"
  const bytes = randomBytes(length)
  let out = ""
  for (let i = 0; i < length; i++) out += alphabet[bytes[i] % alphabet.length]
  return out
}

/* ------------------------------------------------------------------ */
/* Login-code hashing (scrypt, salted, timing-safe verify)             */
/* ------------------------------------------------------------------ */

export function hashLoginCode(code) {
  const salt = randomBytes(16)
  const derived = scryptSync(String(code), salt, SCRYPT_KEYLEN)
  return { salt: salt.toString("base64url"), hash: derived.toString("base64url") }
}

export function verifyLoginCode(code, stored) {
  if (!stored || typeof stored.salt !== "string" || typeof stored.hash !== "string") return false
  let salt, expected
  try {
    salt = Buffer.from(stored.salt, "base64url")
    expected = Buffer.from(stored.hash, "base64url")
  } catch {
    return false
  }
  if (expected.length !== SCRYPT_KEYLEN) return false
  const derived = scryptSync(String(code), salt, SCRYPT_KEYLEN)
  if (derived.length !== expected.length) return false
  return timingSafeEqual(derived, expected)
}

/* ------------------------------------------------------------------ */
/* Masking                                                             */
/* ------------------------------------------------------------------ */

/** Mask a secret keeping the last `keep` chars, e.g. "••••vA1b". */
export function maskKey(value, keep = 4) {
  const str = String(value || "")
  if (!str) return ""
  if (str.length <= keep) return "•".repeat(str.length)
  return "•".repeat(4) + str.slice(-keep)
}

/* ------------------------------------------------------------------ */
/* Ingest URLs (what the user enters into vMix/OBS)                     */
/* ------------------------------------------------------------------ */

/**
 * Build the publish/ingest URLs for an event's stream key.
 * `hosts` lets callers inject public hostnames (env-driven) so the URL shown
 * to users points at the public relay, not the internal bind address.
 */
export function buildIngestUrls(streamKey, hosts = {}) {
  const rtmp = buildMediaMtxProtocolUrl("rtmp", streamKey, {
    address: hosts.rtmpAddress,
    host: hosts.rtmpHost || "localhost",
  })
  const rtmps = buildMediaMtxProtocolUrl("rtmps", streamKey, {
    address: hosts.rtmpsAddress,
    host: hosts.rtmpsHost || hosts.rtmpHost || "localhost",
  })
  // MediaMTX SRT publish requires a `publish:` streamid prefix.
  const srtRead = buildMediaMtxProtocolUrl("srt", streamKey, {
    address: hosts.srtAddress,
    host: hosts.srtHost || "localhost",
  })
  const srt = srtRead.replace(`streamid=${encodeURIComponent(streamKey)}`, `streamid=publish:${streamKey}`)
  return { rtmp, rtmps, srt }
}

/* ------------------------------------------------------------------ */
/* Destinations & fan-out command                                      */
/* ------------------------------------------------------------------ */

/** Join a destination's server URL + stream key into one push URL. */
export function destinationUrl(dest) {
  const server = String(dest?.serverUrl || "").replace(/\/+$/, "")
  const key = String(dest?.streamKey || "")
  if (!server) return key
  if (!key) return server
  return `${server}/${key}`
}

function shellQuote(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`
}

/**
 * Build the `runOnReady` value: an ffmpeg tee fan-out across enabled
 * destinations, with the metadata comment appended. When no destinations are
 * enabled the command degrades to a bare comment (a harmless shell no-op) so
 * the metadata is still persisted with the path.
 */
export function buildRunOnReady(meta) {
  // Relay is "stopped" when relayEnabled === false; undefined means on.
  const relayOn = meta.relayEnabled !== false
  const enabled = relayOn ? (meta.destinations || []).filter((d) => d && d.enabled) : []
  const comment = `${META_PREFIX}${encodeMeta(meta)}`

  let inner
  if (enabled.length === 0) {
    // No fan-out: a shell no-op that still carries the metadata comment.
    inner = `: ${comment}`
  } else {
    const teeTargets = enabled.map((d) => `[f=flv:onfail=ignore]${destinationUrl(d)}`).join("|")
    const input = localReadUrl(meta.slug)
    inner =
      `ffmpeg -nostdin -hide_banner -loglevel warning ` +
      `-timeout 5000000 -i ${shellQuote(input)} -c copy -map 0 ` +
      `-f tee ${shellQuote(teeTargets)} ${comment}`
  }

  // MediaMTX runs runOnReady via direct exec with quote-aware word splitting,
  // NOT a shell — so `#` is not a comment and a bare `:` is not a builtin.
  // Wrap in `sh -c` (present in the ffmpeg-enabled image) so the trailing
  // metadata comment and the no-op case are interpreted by a real shell.
  return `sh -c ${shellQuote(inner)}`
}

/* ------------------------------------------------------------------ */
/* Metadata encode / decode                                            */
/* ------------------------------------------------------------------ */

export function encodeMeta(meta) {
  const json = JSON.stringify(meta)
  return Buffer.from(json, "utf8").toString("base64url")
}

export function decodeMeta(encoded) {
  try {
    const json = Buffer.from(String(encoded), "base64url").toString("utf8")
    const parsed = JSON.parse(json)
    if (!parsed || typeof parsed !== "object") return null
    return parsed
  } catch {
    return null
  }
}

/**
 * Extract RELAY_META from a path's runOnReady string. Returns null when the
 * comment is absent or unparseable.
 */
export function parseRunOnReady(runOnReady) {
  const str = String(runOnReady || "")
  const idx = str.indexOf(META_PREFIX)
  if (idx === -1) return null
  // Take only the base64url token after the prefix; the command may be wrapped
  // in `sh -c '...'`, so a trailing quote/space can follow the metadata.
  const encoded = str.slice(idx + META_PREFIX.length).match(/^[A-Za-z0-9_-]+/)?.[0]
  if (!encoded) return null
  return decodeMeta(encoded)
}

/* ------------------------------------------------------------------ */
/* Event factory                                                       */
/* ------------------------------------------------------------------ */

/**
 * Create a fresh event metadata object plus the secret login code (returned
 * separately — it is NEVER stored in plaintext). Caller persists `meta` via
 * `buildRunOnReady` and hands `loginCode` + share links to the end user.
 */
export function createEventMeta({ displayName, quota = 10, loginCode } = {}) {
  const slug = generateStreamKey()
  const code = loginCode || generateLoginCode()
  const meta = {
    version: META_VERSION,
    slug,
    displayName: String(displayName || "Sự kiện chưa đặt tên").slice(0, 120),
    statusToken: generateToken(),
    configToken: generateToken(),
    loginCode: hashLoginCode(code),
    destinations: [],
    quota: Number.isFinite(quota) ? quota : 10,
    createdAt: new Date().toISOString(),
  }
  return { meta, loginCode: code, pathKey: slug }
}

/**
 * Public, secret-free projection of an event for the read-only status page.
 * Destination keys are masked and login-code hash is stripped.
 */
export function toPublicStatus(meta) {
  if (!meta) return null
  return {
    displayName: meta.displayName,
    createdAt: meta.createdAt,
    destinations: (meta.destinations || []).map((d) => ({
      id: d.id,
      name: d.name,
      platform: d.platform,
      enabled: !!d.enabled,
      maskedKey: maskKey(d.streamKey),
    })),
  }
}

export function fingerprintConfigToken(token) {
  return createHash("sha256").update(String(token)).digest("base64url")
}

/* ------------------------------------------------------------------ */
/* Config-page session token (HMAC, short-lived)                       */
/* ------------------------------------------------------------------ */

const DEFAULT_SESSION_TTL_MS = 2 * 60 * 60 * 1000 // 2h

/**
 * Mint a signed session token binding a config token to an expiry. The config
 * token itself is NOT embedded (it already lives in the URL); the signature
 * covers it so a token minted for event A can't authorize event B.
 * Format: `${exp}.${base64url(hmac)}`.
 */
export function createSessionToken(configToken, secret, ttlMs = DEFAULT_SESSION_TTL_MS) {
  const exp = Date.now() + ttlMs
  const sig = createHmac("sha256", String(secret)).update(`${configToken}.${exp}`).digest("base64url")
  return `${exp}.${sig}`
}

/** Verify a session token against its config token + secret. */
export function verifySessionToken(token, configToken, secret) {
  if (!token || typeof token !== "string") return false
  const dot = token.indexOf(".")
  if (dot <= 0) return false
  const exp = Number(token.slice(0, dot))
  const sig = token.slice(dot + 1)
  if (!Number.isFinite(exp) || exp < Date.now()) return false
  const expected = createHmac("sha256", String(secret)).update(`${configToken}.${exp}`).digest("base64url")
  let a, b
  try {
    a = Buffer.from(sig, "base64url")
    b = Buffer.from(expected, "base64url")
  } catch {
    return false
  }
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

/* ------------------------------------------------------------------ */
/* Metadata mutations (return new meta; never mutate in place)         */
/* ------------------------------------------------------------------ */

/** Replace the login code, returning updated meta. */
export function setMetaLoginCode(meta, newCode) {
  return { ...meta, loginCode: hashLoginCode(newCode) }
}

/** Rotate the ingest key (path name): returns { meta, oldSlug, newSlug }. */
export function rotateMetaSlug(meta) {
  const oldSlug = meta.slug
  const newSlug = generateStreamKey()
  return { meta: { ...meta, slug: newSlug }, oldSlug, newSlug }
}

/** Toggle relay (fan-out) on/off, returning updated meta. */
export function setMetaRelayEnabled(meta, enabled) {
  return { ...meta, relayEnabled: !!enabled }
}

/* ------------------------------------------------------------------ */
/* Destinations CRUD                                                   */
/* ------------------------------------------------------------------ */

/** Short opaque id for a destination row (URL/JSON safe). */
export function generateDestinationId() {
  return randomBytes(8).toString("base64url")
}

/**
 * Validate a destination input. Only enforces what we MUST (scheme allowed,
 * required fields present); display-name length is clamped not rejected.
 */
export function validateDestinationInput(input) {
  if (!input || typeof input !== "object") return { ok: false, error: "Dữ liệu không hợp lệ" }
  const name = String(input.name || "").trim()
  if (!name) return { ok: false, error: "Cần nhập tên luồng" }
  const platform = String(input.platform || "")
  if (!RELAY_PLATFORMS.includes(platform)) return { ok: false, error: "Nền tảng không hợp lệ" }
  const serverUrl = String(input.serverUrl || "").trim()
  if (!serverUrl) return { ok: false, error: "Cần nhập server URL" }
  if (!/^(rtmps?|srt):\/\//i.test(serverUrl)) {
    return { ok: false, error: "Server URL phải bắt đầu bằng rtmp/rtmps/srt" }
  }
  const streamKey = String(input.streamKey || "").trim()
  if (!streamKey) return { ok: false, error: "Cần nhập stream key" }
  return { ok: true, normalized: { name: name.slice(0, 80), platform, serverUrl, streamKey } }
}

function normalizeDestinationPatch(patch) {
  const out = {}
  if (patch.name !== undefined) out.name = String(patch.name).trim().slice(0, 80)
  if (patch.platform !== undefined) {
    const p = String(patch.platform)
    if (!RELAY_PLATFORMS.includes(p)) return { error: "Nền tảng không hợp lệ" }
    out.platform = p
  }
  if (patch.serverUrl !== undefined) {
    const url = String(patch.serverUrl).trim().replace(/\/+$/, "")
    if (url && !/^(rtmps?|srt):\/\//i.test(url)) {
      return { error: "Server URL phải bắt đầu bằng rtmp/rtmps/srt" }
    }
    out.serverUrl = url
  }
  if (patch.streamKey !== undefined) out.streamKey = String(patch.streamKey).trim()
  if (patch.enabled !== undefined) out.enabled = !!patch.enabled
  return { patch: out }
}

/** Append a destination to meta. Returns updated meta (or error). */
export function addMetaDestination(meta, input) {
  const v = validateDestinationInput(input)
  if (!v.ok) return { error: v.error }
  const dest = {
    id: generateDestinationId(),
    name: v.normalized.name,
    platform: v.normalized.platform,
    serverUrl: v.normalized.serverUrl.replace(/\/+$/, ""),
    streamKey: v.normalized.streamKey,
    enabled: !!input.enabled,
  }
  return { meta: { ...meta, destinations: [...(meta.destinations || []), dest] } }
}

/** Patch one destination by id. Empty patch is a no-op. */
export function updateMetaDestination(meta, id, patch) {
  const list = meta.destinations || []
  if (!list.some((d) => d.id === id)) return { error: "Không tìm thấy luồng" }
  const norm = normalizeDestinationPatch(patch || {})
  if (norm.error) return { error: norm.error }
  const next = list.map((d) => (d.id === id ? { ...d, ...norm.patch } : d))
  return { meta: { ...meta, destinations: next } }
}

/** Drop a destination by id. */
export function deleteMetaDestination(meta, id) {
  return { ...meta, destinations: (meta.destinations || []).filter((d) => d.id !== id) }
}

/** Count destinations currently enabled for fan-out. */
export function countEnabledDestinations(meta) {
  return (meta.destinations || []).filter((d) => d && d.enabled).length
}

/* ------------------------------------------------------------------ */
/* Share-token + login-code rotation                                   */
/* ------------------------------------------------------------------ */

/** Rotate the status share token (invalidates old status links). */
export function rotateMetaStatusToken(meta) {
  return { ...meta, statusToken: generateToken() }
}

/** Rotate the config share token (invalidates old config links + sessions). */
export function rotateMetaConfigToken(meta) {
  return { ...meta, configToken: generateToken() }
}

/** Regenerate a fresh random login code; returns updated meta + the new code. */
export function regenerateMetaLoginCode(meta) {
  const code = generateLoginCode()
  return { meta: { ...meta, loginCode: hashLoginCode(code) }, loginCode: code }
}

/* ------------------------------------------------------------------ */
/* Fallback (standby slate) configuration                              */
/* ------------------------------------------------------------------ */

/** Allowed fallback types. `text` is self-contained; `image`/`video` resolve a
 * stored asset over HTTP (see {@link fallbackAssetUrl}). */
export const FALLBACK_TYPES = ["none", "text", "image", "video"]

/**
 * Normalize and store a fallback configuration in meta. We persist the user
 * intent here even when runtime activation isn't possible (e.g. no asset base
 * URL configured) — so flipping it on later won't require a meta migration.
 */
export function setMetaFallback(meta, input) {
  const type = FALLBACK_TYPES.includes(input?.type) ? input.type : "none"
  if (type === "none") {
    const { fallback: _drop, ...rest } = meta
    return rest
  }
  const fb = { type, enabled: input?.enabled !== false }
  if (type === "text") {
    fb.text = String(input?.text || "").slice(0, 200)
  } else {
    // image/video — assetRef points at a stored upload served by the frontend.
    fb.assetRef = String(input?.assetRef || "").slice(0, 200)
    if (input?.assetName) fb.assetName = String(input.assetName).slice(0, 200)
    if (input?.assetMime) fb.assetMime = String(input.assetMime).slice(0, 100)
  }
  return { ...meta, fallback: fb }
}

/* ------------------------------------------------------------------ */
/* Fallback runtime (standby slate pushed when the source drops)       */
/* ------------------------------------------------------------------ */

const SLATE_W = 1280
const SLATE_H = 720
const SLATE_FPS = 30
// FLV/RTMP-friendly encode shared by all slate types (FB/YT want H264+AAC).
const SLATE_VENC =
  "-c:v libx264 -preset veryfast -profile:v main -pix_fmt yuv420p " +
  `-g 60 -keyint_min 60 -sc_threshold 0 -r ${SLATE_FPS} ` +
  "-b:v 2500k -maxrate 2500k -bufsize 5000k"
const SLATE_AENC = "-c:a aac -b:a 128k -ar 44100 -ac 2"
const SLATE_SCALE =
  `scale=${SLATE_W}:${SLATE_H}:force_original_aspect_ratio=decrease,` +
  `pad=${SLATE_W}:${SLATE_H}:(ow-iw)/2:(oh-ih)/2,format=yuv420p,fps=${SLATE_FPS}`

/** Public URL the MediaMTX-side ffmpeg uses to fetch an uploaded asset. */
export function fallbackAssetUrl(assetBaseUrl, assetRef) {
  const base = String(assetBaseUrl || "").replace(/\/+$/, "")
  const ref = String(assetRef || "")
  if (!base || !ref) return ""
  return `${base}/api/public/asset/${encodeURIComponent(ref)}`
}

/** Escape a string for use inside an ffmpeg drawtext `text=` value. */
function escapeDrawtext(value) {
  return String(value)
    .replace(/\\/g, "\\\\")
    .replace(/:/g, "\\:")
    .replace(/'/g, "’") // avoid quote nesting; show a typographic apostrophe
    .replace(/%/g, "\\%")
}

/**
 * Build the ffmpeg argument string (no `sh` wrap) that renders the standby
 * slate and tees it to the enabled destinations. Returns null when the slate
 * can't be produced (e.g. image/video without a resolvable asset URL).
 */
function buildSlateArgs(fb, teeTargets, { assetBaseUrl } = {}) {
  const head = "ffmpeg -nostdin -hide_banner -loglevel warning"
  const tee = `-f tee ${shellQuote(teeTargets)}`
  if (fb.type === "text") {
    const text = escapeDrawtext(fb.text || "")
    const fc = `[0:v]drawtext=fontcolor=white:fontsize=44:x=(w-text_w)/2:y=(h-text_h)/2:text=${text}[v]`
    return (
      `${head} -re -f lavfi -i color=c=black:s=${SLATE_W}x${SLATE_H}:r=${SLATE_FPS} ` +
      `-f lavfi -i anullsrc=r=44100:cl=stereo ` +
      `-filter_complex ${shellQuote(fc)} -map ${shellQuote("[v]")} -map 1:a ` +
      `${SLATE_VENC} ${SLATE_AENC} ${tee}`
    )
  }
  if (fb.type === "image") {
    const url = fallbackAssetUrl(assetBaseUrl, fb.assetRef)
    if (!url) return null
    const fc = `[0:v]${SLATE_SCALE}[v]`
    return (
      `${head} -re -loop 1 -i ${shellQuote(url)} -f lavfi -i anullsrc=r=44100:cl=stereo ` +
      `-filter_complex ${shellQuote(fc)} -map ${shellQuote("[v]")} -map 1:a ` +
      `${SLATE_VENC} ${SLATE_AENC} ${tee}`
    )
  }
  if (fb.type === "video") {
    const url = fallbackAssetUrl(assetBaseUrl, fb.assetRef)
    if (!url) return null
    const fc = `[0:v]${SLATE_SCALE}[v]`
    return (
      `${head} -re -stream_loop -1 -i ${shellQuote(url)} ` +
      `-filter_complex ${shellQuote(fc)} -map ${shellQuote("[v]")} -map 0:a? ` +
      `${SLATE_VENC} ${SLATE_AENC} ${tee}`
    )
  }
  return null
}

/**
 * Build the `runOnNotReady` value: a self-terminating standby that pushes the
 * fallback slate to the enabled destinations and exits as soon as the source
 * comes back. We can't rely on MediaMTX to kill `runOnNotReady` on re-publish
 * (unlike `runOnReady`, it is not SIGINT'd when the path becomes ready again),
 * so the command ffprobes the local RTSP source and self-kills on reconnect.
 * Returns "" when no standby should run (fallback off / no destinations /
 * unresolvable asset) so the caller clears the field.
 */
export function buildRunOnNotReady(meta, opts = {}) {
  const fb = meta.fallback
  const relayOn = meta.relayEnabled !== false
  const enabled = relayOn ? (meta.destinations || []).filter((d) => d && d.enabled) : []
  if (!fb || fb.enabled === false || fb.type === "none" || enabled.length === 0) return ""

  const teeTargets = enabled.map((d) => `[f=flv:onfail=ignore]${destinationUrl(d)}`).join("|")
  const slate = buildSlateArgs(fb, teeTargets, opts)
  if (!slate) return ""

  const rtsp = localReadUrl(meta.slug)
  const probe = `ffprobe -v quiet -rtsp_transport tcp -timeout 3000000 -i ${shellQuote(rtsp)}`
  const inner =
    `src_ready() { ${probe}; }; ` +
    `while true; do ` +
    `src_ready && exit 0; ` +
    `${slate} & ` +
    `PID=$!; ` +
    `while kill -0 "$PID" 2>/dev/null; do ` +
    `src_ready && { kill -INT "$PID" 2>/dev/null; wait "$PID" 2>/dev/null; exit 0; }; ` +
    `sleep 2; ` +
    `done; ` +
    `done`
  return `sh -c ${shellQuote(inner)}`
}
