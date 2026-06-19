/**
 * Server-side relay access layer for the anonymous public pages.
 *
 * Unlike the admin dashboard (which forwards the logged-in user's
 * Authorization header through `/api/mediamtx`), the public config/status
 * pages are reached by anonymous visitors holding only a share token. They
 * must NEVER receive MediaMTX admin credentials. This module talks to the
 * MediaMTX Control API directly from the server using credentials read from
 * the environment, resolves a token to its backing path, and returns only
 * secret-free projections to callers.
 *
 * Only import this from Route Handlers / server code — never from a Client
 * Component.
 */

import {
  parseRunOnReady,
  toPublicStatus,
  verifyLoginCode,
  buildIngestUrls,
  buildRunOnReady,
  relayHasActiveCommand,
  createEventMeta,
  createSessionToken,
  verifySessionToken,
  setMetaLoginCode,
  setMetaRelayEnabled,
  rotateMetaSlug,
  addMetaDestination,
  updateMetaDestination,
  deleteMetaDestination,
  countEnabledDestinations,
  rotateMetaStatusToken,
  rotateMetaConfigToken,
  regenerateMetaLoginCode,
  setMetaFallback,
  buildRunOnNotReady,
} from "@/lib/relay-event.mjs"
import { recordAudit, getAuditFor, type AuditEntry } from "@/lib/relay-audit"

export interface RelayDestination {
  id: string
  name: string
  platform: string
  serverUrl: string
  streamKey: string
  enabled: boolean
}

export interface EventMeta {
  version: number
  slug: string
  displayName: string
  statusToken: string
  configToken: string
  loginCode: { salt: string; hash: string }
  destinations: RelayDestination[]
  quota: number
  createdAt: string
  fallback?: unknown
  [key: string]: unknown
}

const DEFAULT_UPSTREAM_API_URL = "http://localhost:9997"

/**
 * Public base URL of THIS frontend, reachable from the MediaMTX server, so the
 * standby ffmpeg (running inside the MediaMTX container) can fetch uploaded
 * image/video assets over HTTP. Empty when unset — image/video fallback then
 * stores intent but cannot activate at runtime.
 */
function assetBaseUrl(): string {
  return (process.env.RELAY_ASSET_BASE_URL || "").trim().replace(/\/+$/, "")
}

function upstreamApiBase(): string {
  const configured =
    process.env.MEDIAMTX_API_URL ||
    process.env.NEXT_PUBLIC_MEDIAMTX_SERVER_API_URL ||
    process.env.NEXT_PUBLIC_MEDIAMTX_API_URL ||
    DEFAULT_UPSTREAM_API_URL
  return configured.trim().replace(/\/+$/, "").replace(/\/v3\/config$/i, "").replace(/\/v3$/i, "")
}

/**
 * Admin Authorization header for the Control API, built from env. Returns
 * undefined when no credentials are configured (MediaMTX with auth disabled).
 */
function adminAuthHeader(): string | undefined {
  const user = process.env.MEDIAMTX_ADMIN_USER
  const pass = process.env.MEDIAMTX_ADMIN_PASS
  if (!user) return undefined
  const token = Buffer.from(`${user}:${pass ?? ""}`).toString("base64")
  return `Basic ${token}`
}

/**
 * Call the MediaMTX Control API. `authOverride` lets admin-initiated writes
 * use the logged-in admin's forwarded Authorization header instead of the
 * server's env credentials; public actions pass nothing and fall back to env.
 */
async function mtxFetch<T>(endpoint: string, init?: RequestInit, authOverride?: string): Promise<T> {
  const url = `${upstreamApiBase()}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`
  const headers = new Headers(init?.headers)
  const auth = authOverride || adminAuthHeader()
  if (auth) headers.set("authorization", auth)
  if (init?.body && !headers.has("content-type")) headers.set("content-type", "application/json")

  let res: Response
  try {
    res = await fetch(url, { ...init, headers, cache: "no-store" })
  } catch (cause) {
    // Surface the real cause in the server log — the route handlers collapse
    // every failure into a generic 502, which hides env/network misconfig.
    // `url` reveals whether MEDIAMTX_API_URL fell back to a relative path.
    console.error(
      `[relay-server] mtxFetch ${endpoint} network error (url=${url}, auth=${auth ? "yes" : "MISSING"}):`,
      cause instanceof Error ? cause.message : cause,
    )
    throw cause
  }
  if (!res.ok) {
    console.error(`[relay-server] mtxFetch ${endpoint} -> ${res.status} (url=${url}, auth=${auth ? "yes" : "MISSING"})`)
    throw new Error(`MediaMTX ${endpoint} -> ${res.status}`)
  }
  if (res.status === 204) return undefined as T
  const text = await res.text()
  return (text ? JSON.parse(text) : undefined) as T
}

interface ListResponse<T> {
  itemCount?: number
  pageCount?: number
  items?: T[]
}

interface PathConfRaw {
  name?: string
  runOnReady?: string
  [key: string]: unknown
}

interface PathRuntimeRaw {
  name?: string
  ready?: boolean
  readyTime?: string | null
  bytesReceived?: number
  bytesSent?: number
  tracks?: string[]
  readers?: unknown[]
  source?: { type?: string; id?: string } | null
}

export interface ResolvedEvent {
  pathName: string
  meta: EventMeta
  runOnReady: string
}

/** Public host config for building user-facing ingest URLs (env-driven). */
export interface PublicHosts {
  rtmpHost?: string
  rtmpAddress?: string
  rtmpsHost?: string
  rtmpsAddress?: string
  srtHost?: string
  srtAddress?: string
}

/**
 * Public host config for user-facing ingest URLs. Explicit `NEXT_PUBLIC_*`
 * env hosts win; otherwise fall back to `fallbackHost` (the hostname the owner
 * actually reached this page on) so ingest URLs point at the real server rather
 * than the internal `localhost` default baked into `buildIngestUrls`.
 */
export function getPublicHosts(fallbackHost?: string): PublicHosts {
  return {
    rtmpHost: process.env.NEXT_PUBLIC_MEDIAMTX_RTMP_HOST || fallbackHost,
    rtmpAddress: process.env.NEXT_PUBLIC_MEDIAMTX_RTMP_ADDRESS,
    rtmpsHost: process.env.NEXT_PUBLIC_MEDIAMTX_RTMPS_HOST || fallbackHost,
    rtmpsAddress: process.env.NEXT_PUBLIC_MEDIAMTX_RTMPS_ADDRESS,
    srtHost: process.env.NEXT_PUBLIC_MEDIAMTX_SRT_HOST || fallbackHost,
    srtAddress: process.env.NEXT_PUBLIC_MEDIAMTX_SRT_ADDRESS,
  }
}

/** List every path config that carries RELAY_META, decoded. */
export async function listEvents(): Promise<ResolvedEvent[]> {
  const data = await mtxFetch<ListResponse<PathConfRaw>>("/v3/config/paths/list")
  const events: ResolvedEvent[] = []
  for (const item of data.items ?? []) {
    const runOnReady = typeof item.runOnReady === "string" ? item.runOnReady : ""
    const meta = parseRunOnReady(runOnReady) as EventMeta | null
    if (meta && item.name) {
      events.push({ pathName: item.name, meta, runOnReady })
    }
  }
  return events
}

export type TokenKind = "status" | "config"

/**
 * Resolve a share token to its event by scanning path configs. Event counts
 * are small, so a linear scan is acceptable. Comparison is on the token field
 * matching the requested kind.
 */
export async function findEventByToken(token: string, kind: TokenKind): Promise<ResolvedEvent | null> {
  if (!token) return null
  const events = await listEvents()
  const field = kind === "status" ? "statusToken" : "configToken"
  return events.find((e) => e.meta?.[field] === token) ?? null
}

/** Resolve an event by its backing path name (= ingest key). Admin-side use. */
export async function findEventByPath(pathName: string): Promise<ResolvedEvent | null> {
  if (!pathName) return null
  const events = await listEvents()
  return events.find((e) => e.pathName === pathName) ?? null
}

export interface AdminEventRow {
  pathKey: string
  displayName: string
  statusToken: string
  configToken: string
  createdAt: string
  quota: number
  destinationsTotal: number
  destinationsEnabled: number
  online: boolean
  bytesReceived: number
  sourceType: string | null
}

/**
 * Admin listing of every relay event with live runtime, for the dashboard
 * management view. Login-code hashes are intentionally omitted — they are
 * unrecoverable and useless to the client. Newest first.
 */
export async function listEventsForAdmin(): Promise<AdminEventRow[]> {
  const events = await listEvents()
  const rows = await Promise.all(
    events.map(async (e): Promise<AdminEventRow> => {
      const rt = await getEventRuntime(e.pathName)
      const dests = e.meta.destinations ?? []
      return {
        pathKey: e.pathName,
        displayName: e.meta.displayName,
        statusToken: e.meta.statusToken,
        configToken: e.meta.configToken,
        createdAt: e.meta.createdAt,
        quota: e.meta.quota ?? 10,
        destinationsTotal: dests.length,
        destinationsEnabled: dests.filter((d) => d.enabled).length,
        online: rt.online,
        bytesReceived: rt.bytesReceived,
        sourceType: rt.sourceType,
      }
    }),
  )
  rows.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
  return rows
}

/** Delete an event = remove its MediaMTX path. Uses the admin's forwarded auth. */
export async function deleteEvent(pathName: string, authOverride?: string): Promise<void> {
  await mtxFetch(`/v3/config/paths/delete/${encodeURIComponent(pathName)}`, { method: "DELETE" }, authOverride)
}

export interface EventRuntime {
  online: boolean
  readyTime: string | null
  bytesReceived: number
  bytesSent: number
  tracks: string[]
  readers: number
  sourceType: string | null
}

/** Read live runtime state for an event's path. Offline if the path isn't active. */
export async function getEventRuntime(pathName: string): Promise<EventRuntime> {
  try {
    const p = await mtxFetch<PathRuntimeRaw>(`/v3/paths/get/${encodeURIComponent(pathName)}`)
    return {
      online: !!p.ready,
      readyTime: p.readyTime ?? null,
      bytesReceived: p.bytesReceived ?? 0,
      bytesSent: p.bytesSent ?? 0,
      tracks: Array.isArray(p.tracks) ? p.tracks : [],
      readers: Array.isArray(p.readers) ? p.readers.length : 0,
      sourceType: p.source?.type ?? null,
    }
  } catch {
    return { online: false, readyTime: null, bytesReceived: 0, bytesSent: 0, tracks: [], readers: 0, sourceType: null }
  }
}

/** Verify a login code against an event's stored hash. */
export function verifyEventLoginCode(meta: EventMeta, code: string): boolean {
  return verifyLoginCode(code, meta?.loginCode)
}

/** Persist updated metadata back to the path's runOnReady (admin-side use). */
export async function patchEventRunOnReady(pathName: string, runOnReady: string): Promise<void> {
  await mtxFetch(`/v3/config/paths/patch/${encodeURIComponent(pathName)}`, {
    method: "PATCH",
    body: JSON.stringify({ runOnReady }),
  })
}

/**
 * Build the full read-only status payload for the public status page:
 * event identity + masked destinations + live runtime + masked ingest URLs.
 */
export async function buildStatusPayload(event: ResolvedEvent) {
  const runtime = await getEventRuntime(event.pathName)
  const publicStatus = toPublicStatus(event.meta)
  // Ingest URLs embed the slug (= ingest key) and MUST NOT leak to anonymous
  // viewers. The status page is share-with-anyone; only the owner sees ingest.
  return {
    ...publicStatus,
    runtime,
  }
}

/* ------------------------------------------------------------------ */
/* Config-page session                                                 */
/* ------------------------------------------------------------------ */

export const CONFIG_SESSION_COOKIE = "relay_config_session"

/**
 * Secret for signing config-session cookies. Prefer an explicit env secret;
 * fall back to admin creds so the secret is at least deployment-specific. A
 * hardcoded last-resort keeps dev working but should be overridden in prod.
 */
function sessionSecret(): string {
  return (
    process.env.RELAY_SESSION_SECRET ||
    process.env.MEDIAMTX_ADMIN_PASS ||
    process.env.MEDIAMTX_ADMIN_USER ||
    "relay-dev-secret-change-me"
  )
}

export function issueConfigSession(configToken: string): string {
  return createSessionToken(configToken, sessionSecret())
}

export function isValidConfigSession(sessionToken: string | undefined, configToken: string): boolean {
  if (!sessionToken) return false
  return verifySessionToken(sessionToken, configToken, sessionSecret())
}

/* ------------------------------------------------------------------ */
/* Config payload (authenticated owner view)                           */
/* ------------------------------------------------------------------ */

/**
 * Full owner-facing config state. The owner is authenticated, so ingest URLs
 * and SRT stream-ids are shown in full; destination stream keys remain masked
 * in the list view (full reveal/editing arrives with destination CRUD in GĐ3).
 */
export async function buildConfigPayload(event: ResolvedEvent, requestHost?: string) {
  const runtime = await getEventRuntime(event.pathName)
  const hosts = getPublicHosts(requestHost)
  const ingest = buildIngestUrls(event.meta.slug, hosts)
  const conf = await getPathConfRaw(event.pathName)
  const destinations = (event.meta.destinations ?? []).map((d) => ({
    id: d.id,
    name: d.name,
    platform: d.platform,
    serverUrl: d.serverUrl,
    enabled: !!d.enabled,
    maskedKey: maskKeyForPayload(d.streamKey),
  }))
  const enabledCount = destinations.filter((d) => d.enabled).length
  return {
    displayName: event.meta.displayName,
    createdAt: event.meta.createdAt,
    destinations,
    slug: event.meta.slug,
    statusToken: event.meta.statusToken,
    configToken: event.meta.configToken,
    quota: event.meta.quota ?? 10,
    enabledCount,
    recordEnabled: !!conf?.record,
    relayEnabled: event.meta.relayEnabled !== false,
    fallback: event.meta.fallback ?? null,
    audit: getAuditFor(event.meta.slug, 20),
    runtime,
    ingest: {
      rtmp: ingest.rtmp,
      rtmps: ingest.rtmps,
      srt: ingest.srt,
      srtStreamId: `publish:${event.meta.slug}`,
      srtReadStreamId: `read:${event.meta.slug}`,
    },
  }
}

/** Local mask so we don't reach back into the .mjs for a single helper. */
function maskKeyForPayload(value: string): string {
  const str = String(value || "")
  if (!str) return ""
  if (str.length <= 4) return "•".repeat(str.length)
  return "••••" + str.slice(-4)
}

async function getPathConfRaw(pathName: string): Promise<PathConfRaw | null> {
  try {
    return await mtxFetch<PathConfRaw>(`/v3/config/paths/get/${encodeURIComponent(pathName)}`)
  } catch {
    return null
  }
}

/* ------------------------------------------------------------------ */
/* Mutations (create / record / relay / rotate / change code)          */
/* ------------------------------------------------------------------ */

export interface CreatedEvent {
  pathKey: string
  loginCode: string
  statusToken: string
  configToken: string
}

/**
 * Create a new event = a MediaMTX path whose name is a secret key, carrying
 * RELAY_META. Uses the admin's forwarded auth header for the write.
 */
export async function createEvent(
  input: { displayName: string; quota?: number },
  authOverride?: string,
): Promise<CreatedEvent> {
  const { meta, loginCode, pathKey } = createEventMeta(input)
  const runOnReady = buildRunOnReady(meta)
  await mtxFetch(
    `/v3/config/paths/add/${encodeURIComponent(pathKey)}`,
    {
      method: "POST",
      body: JSON.stringify({
        name: pathKey,
        source: "publisher",
        runOnReady,
        runOnReadyRestart: relayHasActiveCommand(meta),
        record: false,
      }),
    },
    authOverride,
  )
  return { pathKey, loginCode, statusToken: meta.statusToken, configToken: meta.configToken }
}

export async function setEventRecord(event: ResolvedEvent, enabled: boolean, authOverride?: string): Promise<void> {
  await mtxFetch(
    `/v3/config/paths/patch/${encodeURIComponent(event.pathName)}`,
    { method: "PATCH", body: JSON.stringify({ record: !!enabled }) },
    authOverride,
  )
  audit("record.set", event, { enabled: !!enabled })
}

export async function setEventRelay(event: ResolvedEvent, enabled: boolean, authOverride?: string): Promise<void> {
  const meta = setMetaRelayEnabled(event.meta, enabled)
  await mtxFetch(
    `/v3/config/paths/patch/${encodeURIComponent(event.pathName)}`,
    {
      method: "PATCH",
      body: JSON.stringify({
        runOnReady: buildRunOnReady(meta),
        runOnReadyRestart: relayHasActiveCommand(meta),
        runOnNotReady: buildRunOnNotReady(meta, { assetBaseUrl: assetBaseUrl() }),
      }),
    },
    authOverride,
  )
  audit("relay.set", event, { enabled: !!enabled })
}

export async function changeEventLoginCode(event: ResolvedEvent, newCode: string, authOverride?: string): Promise<void> {
  const meta = setMetaLoginCode(event.meta, newCode)
  await mtxFetch(
    `/v3/config/paths/patch/${encodeURIComponent(event.pathName)}`,
    {
      method: "PATCH",
      body: JSON.stringify({
        runOnReady: buildRunOnReady(meta),
        runOnReadyRestart: relayHasActiveCommand(meta),
      }),
    },
    authOverride,
  )
  audit("login_code.change", event)
}

/**
 * Apply a meta mutation to an event's runOnReady. Shared by all destination /
 * token rotation actions so we only have one PATCH path.
 */
async function applyMetaPatch(event: ResolvedEvent, newMeta: EventMeta, authOverride?: string): Promise<void> {
  await mtxFetch(
    `/v3/config/paths/patch/${encodeURIComponent(event.pathName)}`,
    {
      method: "PATCH",
      body: JSON.stringify({
        runOnReady: buildRunOnReady(newMeta),
        runOnReadyRestart: relayHasActiveCommand(newMeta),
        runOnNotReady: buildRunOnNotReady(newMeta, { assetBaseUrl: assetBaseUrl() }),
      }),
    },
    authOverride,
  )
}

/**
 * Minimal audit trail: emits a structured one-line record to stdout per action.
 * Sensitive values are never logged — only ids/slugs/flags. Persisting these to
 * a queryable store needs a storage decision (out of scope for this iteration);
 * for now they ride your existing process logs.
 */
function audit(action: string, event: ResolvedEvent, extra: Record<string, unknown> = {}): void {
  try {
    const entry = {
      ts: new Date().toISOString(),
      kind: "relay.audit",
      action,
      slug: event.meta.slug,
      configTokenFp: fingerprint(event.meta.configToken),
      ...extra,
    }
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(entry))
    recordAudit(event.meta.slug, action, extra)
  } catch {
    /* never throw from audit */
  }
}

function fingerprint(value: string): string {
  return String(value).slice(0, 6)
}

export function listEventAudit(slug: string, limit = 20): AuditEntry[] {
  return getAuditFor(slug, limit)
}

export interface DestinationInput {
  name: string
  platform: string
  serverUrl: string
  streamKey: string
  enabled?: boolean
}

export interface DestinationPatch {
  name?: string
  platform?: string
  serverUrl?: string
  streamKey?: string
  enabled?: boolean
}

export interface ActionResult {
  ok: boolean
  error?: string
}

/**
 * Add a destination. Enforces quota by COUNT OF ENABLED destinations — adding
 * a disabled destination above quota is allowed; the user must disable an
 * existing one before turning the new one on.
 */
export async function addEventDestination(
  event: ResolvedEvent,
  input: DestinationInput,
  authOverride?: string,
): Promise<ActionResult> {
  const result = addMetaDestination(event.meta, input)
  if (result.error) return { ok: false, error: result.error }
  const newMeta = result.meta as EventMeta
  if (countEnabledDestinations(newMeta) > (event.meta.quota ?? 10)) {
    return { ok: false, error: "Vượt quá quota luồng đang bật" }
  }
  await applyMetaPatch(event, newMeta, authOverride)
  audit("destination.add", event, { platform: input.platform, enabled: !!input.enabled })
  return { ok: true }
}

export async function updateEventDestination(
  event: ResolvedEvent,
  id: string,
  patch: DestinationPatch,
  authOverride?: string,
): Promise<ActionResult> {
  const result = updateMetaDestination(event.meta, id, patch)
  if (result.error) return { ok: false, error: result.error }
  const newMeta = result.meta as EventMeta
  if (countEnabledDestinations(newMeta) > (event.meta.quota ?? 10)) {
    return { ok: false, error: "Vượt quá quota luồng đang bật" }
  }
  await applyMetaPatch(event, newMeta, authOverride)
  audit("destination.update", event, { id, fields: Object.keys(patch) })
  return { ok: true }
}

export async function deleteEventDestination(
  event: ResolvedEvent,
  id: string,
  authOverride?: string,
): Promise<void> {
  const newMeta = deleteMetaDestination(event.meta, id) as EventMeta
  await applyMetaPatch(event, newMeta, authOverride)
  audit("destination.delete", event, { id })
}

/** Mint a fresh status share token (invalidates old status URLs). */
export async function rotateEventStatusToken(event: ResolvedEvent, authOverride?: string): Promise<string> {
  const newMeta = rotateMetaStatusToken(event.meta) as EventMeta
  await applyMetaPatch(event, newMeta, authOverride)
  audit("token.rotate.status", event)
  return newMeta.statusToken
}

/**
 * Mint a fresh config share token. Existing config-session cookies become
 * unusable immediately (they were bound to the old token) — the caller must
 * redirect the owner to the new URL.
 */
export async function rotateEventConfigToken(event: ResolvedEvent, authOverride?: string): Promise<string> {
  const newMeta = rotateMetaConfigToken(event.meta) as EventMeta
  await applyMetaPatch(event, newMeta, authOverride)
  audit("token.rotate.config", event)
  return newMeta.configToken
}

/**
 * Regenerate a fresh random login code and return it ONCE (only the salted
 * hash is persisted). Old code stops working immediately.
 */
export async function regenerateEventLoginCode(event: ResolvedEvent, authOverride?: string): Promise<string> {
  const { meta: newMeta, loginCode } = regenerateMetaLoginCode(event.meta)
  await applyMetaPatch(event, newMeta as EventMeta, authOverride)
  audit("login_code.regenerate", event)
  return loginCode
}

export interface FallbackInput {
  type: string
  enabled?: boolean
  text?: string
  assetRef?: string
  assetName?: string
  assetMime?: string
}

/**
 * Persist fallback configuration in meta and (re)wire the standby ffmpeg via
 * `runOnNotReady`. image/video require a previously-uploaded asset; activation
 * also needs RELAY_ASSET_BASE_URL so the MediaMTX-side ffmpeg can fetch it.
 */
export async function setEventFallback(
  event: ResolvedEvent,
  input: FallbackInput,
  authOverride?: string,
): Promise<ActionResult> {
  if (!["none", "text", "image", "video"].includes(input?.type)) {
    return { ok: false, error: "Loại fallback không hợp lệ" }
  }
  if (input.type === "image" || input.type === "video") {
    if (!input.assetRef) {
      return { ok: false, error: "Cần tải lên tệp ảnh/video trước khi lưu" }
    }
    if (input.enabled !== false && !assetBaseUrl()) {
      return {
        ok: false,
        error: "Chưa cấu hình RELAY_ASSET_BASE_URL — MediaMTX không đọc được asset để kích hoạt fallback",
      }
    }
  }
  const newMeta = setMetaFallback(event.meta, input) as EventMeta
  await applyMetaPatch(event, newMeta, authOverride)
  audit("fallback.set", event, { type: input.type, enabled: input.enabled !== false })
  return { ok: true }
}

/**
 * Rotate the ingest key. Because the path name IS the key, this creates a new
 * path with the rotated slug + updated meta and deletes the old one. Share
 * tokens are preserved, so existing config/status links keep working.
 */
export async function rotateEventStreamId(event: ResolvedEvent, authOverride?: string): Promise<string> {
  const { meta: newMeta, oldSlug, newSlug } = rotateMetaSlug(event.meta)
  const oldConf = (await getPathConfRaw(oldSlug)) ?? {}
  const runOnReady = buildRunOnReady(newMeta)
  const body = { ...oldConf, name: newSlug, runOnReady, runOnReadyRestart: relayHasActiveCommand(newMeta) }
  await mtxFetch(
    `/v3/config/paths/add/${encodeURIComponent(newSlug)}`,
    { method: "POST", body: JSON.stringify(body) },
    authOverride,
  )
  await mtxFetch(`/v3/config/paths/delete/${encodeURIComponent(oldSlug)}`, { method: "DELETE" }, authOverride)
  return newSlug
}
