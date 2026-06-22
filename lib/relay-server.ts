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
  parseFanoutMeta,
  toPublicStatus,
  verifyLoginCode,
  buildIngestUrls,
  buildRunOnReady,
  relayHasActiveCommand,
  buildFanoutRunOnReady,
  buildFanoutRunOnNotReady,
  fanoutPathName,
  isFanoutPathName,
  fanoutSourceUrl,
  createEventMeta,
  createSessionToken,
  verifySessionToken,
  setMetaLoginCode,
  setMetaRelayEnabled,
  rotateMetaSlug,
  validateDestinationInput,
  normalizeDestinationPatch,
  generateDestinationId,
  rotateMetaStatusToken,
  rotateMetaConfigToken,
  regenerateMetaLoginCode,
  setMetaFallback,
  validateCustomPath,
} from "@/lib/relay-event.mjs"
import { recordAudit, getAuditFor, type AuditEntry } from "@/lib/relay-audit"

/** Thrown when user input fails validation — routes map this to HTTP 400. */
export class RelayValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "RelayValidationError"
  }
}

export interface RelayDestination {
  id: string
  name: string
  platform: string
  serverUrl: string
  streamKey: string
  enabled: boolean
  /** ISO timestamp used only for deterministic ordering; not shown to users. */
  createdAt?: string
}

export interface EventMeta {
  version: number
  slug: string
  displayName: string
  statusToken: string
  configToken: string
  loginCode: { salt: string; hash: string }
  /** Legacy: destinations used to live in event meta; now in fan-out paths. */
  destinations?: RelayDestination[]
  quota: number
  createdAt: string
  fallback?: unknown
  relayEnabled?: boolean
  [key: string]: unknown
}

/** Destination metadata as stored in a fan-out path's RELAY_FANOUT comment. */
interface FanoutMeta extends RelayDestination {
  parentSlug: string
  createdAt?: string
  v?: number
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

/** Fetch every MediaMTX path config in one call (ingest + fan-out paths). */
export async function listAllPaths(): Promise<PathConfRaw[]> {
  const data = await mtxFetch<ListResponse<PathConfRaw>>("/v3/config/paths/list")
  return data.items ?? []
}

/**
 * List every event (ingest) path: carries RELAY_META and is NOT a fan-out path.
 * Pass `items` to reuse a prior {@link listAllPaths} result and avoid a refetch.
 */
export async function listEvents(items?: PathConfRaw[]): Promise<ResolvedEvent[]> {
  const all = items ?? (await listAllPaths())
  const events: ResolvedEvent[] = []
  for (const item of all) {
    if (!item.name || isFanoutPathName(item.name)) continue
    const runOnReady = typeof item.runOnReady === "string" ? item.runOnReady : ""
    const meta = parseRunOnReady(runOnReady) as EventMeta | null
    if (meta) events.push({ pathName: item.name, meta, runOnReady })
  }
  return events
}

/**
 * Reconstruct an event's destinations by scanning its fan-out paths
 * (`<slug>__fo__*`). Each fan-out path carries one destination's full metadata
 * in its RELAY_FANOUT comment. Pass `items` to reuse a prior path list.
 * Sorted stably (createdAt, then id) so the UI order is deterministic.
 */
export async function resolveDestinations(slug: string, items?: PathConfRaw[]): Promise<RelayDestination[]> {
  const all = items ?? (await listAllPaths())
  const dests: RelayDestination[] = []
  for (const item of all) {
    if (!item.name || !isFanoutPathName(item.name)) continue
    const runOnReady = typeof item.runOnReady === "string" ? item.runOnReady : ""
    const fm = parseFanoutMeta(runOnReady) as FanoutMeta | null
    if (!fm || fm.parentSlug !== slug || !fm.id) continue
    dests.push({
      id: fm.id,
      name: fm.name ?? "",
      platform: fm.platform ?? "custom",
      serverUrl: fm.serverUrl ?? "",
      streamKey: fm.streamKey ?? "",
      enabled: !!fm.enabled,
      createdAt: fm.createdAt ?? "",
    })
  }
  dests.sort(
    (a, b) => String(a.createdAt).localeCompare(String(b.createdAt)) || a.id.localeCompare(b.id),
  )
  return dests
}

/**
 * Destinations for an event, preferring fan-out paths but falling back to the
 * legacy `meta.destinations` array (read-only display) for events not yet
 * migrated. `items` reuses a prior path list to avoid a refetch.
 */
async function destinationsForEvent(event: ResolvedEvent, items?: PathConfRaw[]): Promise<RelayDestination[]> {
  const fromPaths = await resolveDestinations(event.meta.slug, items)
  if (fromPaths.length > 0) return fromPaths
  const legacy = event.meta.destinations
  return Array.isArray(legacy) ? legacy : []
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
  const all = await listAllPaths()
  const events = await listEvents(all)
  const rows = await Promise.all(
    events.map(async (e): Promise<AdminEventRow> => {
      const rt = await getEventRuntime(e.pathName)
      const dests = await destinationsForEvent(e, all)
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

/**
 * Delete an event: cascade-delete every fan-out path (`<slug>__fo__*`) first,
 * then the ingest path itself. Uses the admin's forwarded auth.
 */
export async function deleteEvent(pathName: string, authOverride?: string): Promise<void> {
  const dests = await resolveDestinations(pathName)
  for (const d of dests) {
    await mtxFetch(
      `/v3/config/paths/delete/${encodeURIComponent(fanoutPathName(pathName, d.id))}`,
      { method: "DELETE" },
      authOverride,
    ).catch(() => {})
  }
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
  const destinations = await destinationsForEvent(event)
  const publicStatus = toPublicStatus(event.meta, destinations)
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
  const resolved = await destinationsForEvent(event)
  const destinations = resolved.map((d) => ({
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

/** Whether a MediaMTX path with this name already exists (collision guard). */
export async function pathExists(pathName: string): Promise<boolean> {
  return (await getPathConfRaw(pathName)) !== null
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
  input: { displayName: string; quota?: number; path?: string },
  authOverride?: string,
): Promise<CreatedEvent> {
  const v = validateCustomPath(input.path)
  if (!v.ok) throw new RelayValidationError(v.error)
  if (v.value && (await pathExists(v.value))) {
    throw new RelayValidationError("Path này đã tồn tại, hãy chọn tên khác")
  }
  const { meta, loginCode, pathKey } = createEventMeta({ ...input, slug: v.value || undefined })
  const runOnReady = buildRunOnReady(meta)
  await mtxFetch(
    `/v3/config/paths/add/${encodeURIComponent(pathKey)}`,
    {
      method: "POST",
      body: JSON.stringify({
        name: pathKey,
        source: "publisher",
        runOnReady,
        runOnReadyRestart: relayHasActiveCommand(),
        record: false,
      }),
    },
    authOverride,
  )
  return { pathKey, loginCode, statusToken: meta.statusToken, configToken: meta.configToken }
}

export async function setEventRecord(event: ResolvedEvent, enabled: boolean, authOverride?: string): Promise<void> {
  if (enabled) {
    // Before enabling record, ensure recordPath is set so files
    // actually land on disk in a known location.
    const conf = await mtxFetch<Record<string, unknown>>(
      `/v3/config/paths/get/${encodeURIComponent(event.pathName)}`,
      undefined,
      authOverride,
    ).catch(() => ({}))
    const currentRecordPath = typeof conf?.recordPath === "string" ? conf.recordPath.trim() : ""
    const patch: Record<string, unknown> = { record: true }
    if (!currentRecordPath) {
      patch.recordPath = "./recordings/%path/"
    }
    if (!conf?.recordFormat || conf.recordFormat === "") {
      patch.recordFormat = "fmp4"
    }
    await mtxFetch(
      `/v3/config/paths/patch/${encodeURIComponent(event.pathName)}`,
      { method: "PATCH", body: JSON.stringify(patch) },
      authOverride,
    )
  } else {
    await mtxFetch(
      `/v3/config/paths/patch/${encodeURIComponent(event.pathName)}`,
      { method: "PATCH", body: JSON.stringify({ record: false }) },
      authOverride,
    )
  }
  audit("record.set", event, { enabled: !!enabled })
}

export async function setEventRelay(event: ResolvedEvent, enabled: boolean, authOverride?: string): Promise<void> {
  const meta = setMetaRelayEnabled(event.meta, enabled) as EventMeta
  // Store the master flag on the ingest meta, then re-wire every fan-out path
  // (each push/standby command depends on the relay master switch).
  await applyMetaPatch(event, meta, authOverride)
  await patchAllFanoutPaths({ ...event, meta }, { relayEnabled: enabled, fallback: meta.fallback }, authOverride)
  audit("relay.set", event, { enabled: !!enabled })
}

export async function changeEventLoginCode(event: ResolvedEvent, newCode: string, authOverride?: string): Promise<void> {
  const meta = setMetaLoginCode(event.meta, newCode) as EventMeta
  await applyMetaPatch(event, meta, authOverride)
  audit("login_code.change", event)
}

/**
 * Persist an event-level meta mutation onto the INGEST path's runOnReady (the
 * metadata no-op). The ingest path never fans out anymore, so its runOnReady
 * never auto-restarts and it carries no standby (`runOnNotReady` cleared).
 * Shared by token rotations, login-code and fallback/relay master changes.
 */
async function applyMetaPatch(event: ResolvedEvent, newMeta: EventMeta, authOverride?: string): Promise<void> {
  await mtxFetch(
    `/v3/config/paths/patch/${encodeURIComponent(event.pathName)}`,
    {
      method: "PATCH",
      body: JSON.stringify({
        runOnReady: buildRunOnReady(newMeta),
        runOnReadyRestart: relayHasActiveCommand(),
        runOnNotReady: "",
      }),
    },
    authOverride,
  )
}

/* ------------------------------------------------------------------ */
/* Fan-out path wiring (one MediaMTX path per destination)             */
/* ------------------------------------------------------------------ */

interface FanoutWireOpts {
  relayEnabled: boolean
  fallback: unknown
}

/** The three runtime fields that drive a destination's fan-out path. */
function fanoutRunFields(slug: string, dest: RelayDestination, opts: FanoutWireOpts) {
  return {
    runOnReady: buildFanoutRunOnReady(dest, { slug, relayEnabled: opts.relayEnabled }),
    runOnReadyRestart: opts.relayEnabled && !!dest.enabled,
    runOnNotReady: buildFanoutRunOnNotReady(dest, opts.fallback, {
      slug,
      assetBaseUrl: assetBaseUrl(),
      relayEnabled: opts.relayEnabled,
    }),
  }
}

/** Full path-config body to CREATE a destination's fan-out path. */
function fanoutAddBody(slug: string, dest: RelayDestination, opts: FanoutWireOpts) {
  const name = fanoutPathName(slug, dest.id)
  return { name, source: fanoutSourceUrl(slug), sourceOnDemand: false, ...fanoutRunFields(slug, dest, opts) }
}

/** Re-wire every fan-out path of an event (used by relay/fallback master edits). */
async function patchAllFanoutPaths(event: ResolvedEvent, opts: FanoutWireOpts, authOverride?: string): Promise<void> {
  const slug = event.meta.slug
  const dests = await resolveDestinations(slug)
  for (const d of dests) {
    await mtxFetch(
      `/v3/config/paths/patch/${encodeURIComponent(fanoutPathName(slug, d.id))}`,
      { method: "PATCH", body: JSON.stringify(fanoutRunFields(slug, d, opts)) },
      authOverride,
    ).catch(() => {})
  }
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
 * Add a destination as its OWN MediaMTX fan-out path (`<slug>__fo__<id>`). The
 * ingest path is never touched, so the live publisher and existing destinations
 * keep streaming. Quota is enforced by COUNT OF ENABLED destinations — adding a
 * disabled one above quota is allowed; the user must disable an existing one
 * before turning the new one on.
 */
export async function addEventDestination(
  event: ResolvedEvent,
  input: DestinationInput,
  authOverride?: string,
): Promise<ActionResult> {
  const v = validateDestinationInput(input)
  if (!v.ok) return { ok: false, error: v.error }
  const slug = event.meta.slug
  const relayEnabled = event.meta.relayEnabled !== false
  const willEnable = !!input.enabled

  const current = await resolveDestinations(slug)
  const enabledNow = current.filter((d) => d.enabled).length
  if (enabledNow + (willEnable ? 1 : 0) > (event.meta.quota ?? 10)) {
    return { ok: false, error: "Vượt quá quota luồng đang bật" }
  }

  const dest: RelayDestination = {
    id: generateDestinationId(),
    name: v.normalized.name,
    platform: v.normalized.platform,
    serverUrl: String(v.normalized.serverUrl).replace(/\/+$/, ""),
    streamKey: v.normalized.streamKey,
    enabled: willEnable,
    createdAt: new Date().toISOString(),
  }
  const body = fanoutAddBody(slug, dest, { relayEnabled, fallback: event.meta.fallback })
  await mtxFetch(
    `/v3/config/paths/add/${encodeURIComponent(body.name)}`,
    { method: "POST", body: JSON.stringify(body) },
    authOverride,
  )
  audit("destination.add", event, { platform: dest.platform, enabled: dest.enabled })
  return { ok: true }
}

/**
 * Edit one destination by patching ONLY its fan-out path. The ingest path is
 * untouched, so the publisher and other destinations are unaffected.
 */
export async function updateEventDestination(
  event: ResolvedEvent,
  id: string,
  patch: DestinationPatch,
  authOverride?: string,
): Promise<ActionResult> {
  const slug = event.meta.slug
  const relayEnabled = event.meta.relayEnabled !== false
  const current = await resolveDestinations(slug)
  const existing = current.find((d) => d.id === id)
  if (!existing) return { ok: false, error: "Không tìm thấy luồng" }

  const norm = normalizeDestinationPatch(patch || {})
  if (norm.error) return { ok: false, error: norm.error }
  const next: RelayDestination = { ...existing, ...norm.patch }

  const enabledAfter = current.map((d) => (d.id === id ? next : d)).filter((d) => d.enabled).length
  if (enabledAfter > (event.meta.quota ?? 10)) {
    return { ok: false, error: "Vượt quá quota luồng đang bật" }
  }

  await mtxFetch(
    `/v3/config/paths/patch/${encodeURIComponent(fanoutPathName(slug, id))}`,
    { method: "PATCH", body: JSON.stringify(fanoutRunFields(slug, next, { relayEnabled, fallback: event.meta.fallback })) },
    authOverride,
  )
  audit("destination.update", event, { id, fields: Object.keys(patch) })
  return { ok: true }
}

/** Delete one destination by removing its fan-out path. Ingest untouched. */
export async function deleteEventDestination(
  event: ResolvedEvent,
  id: string,
  authOverride?: string,
): Promise<void> {
  await mtxFetch(
    `/v3/config/paths/delete/${encodeURIComponent(fanoutPathName(event.meta.slug, id))}`,
    { method: "DELETE" },
    authOverride,
  )
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
  // Store fallback config on the ingest meta, then re-wire each destination's
  // per-path standby (every fan-out path carries its own slate fallback now).
  await applyMetaPatch(event, newMeta, authOverride)
  await patchAllFanoutPaths(
    { ...event, meta: newMeta },
    { relayEnabled: newMeta.relayEnabled !== false, fallback: newMeta.fallback },
    authOverride,
  )
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
  const relayEnabled = newMeta.relayEnabled !== false
  const dests = await resolveDestinations(oldSlug)

  // Recreate the ingest path under the new slug (publisher must re-point here).
  const oldConf = (await getPathConfRaw(oldSlug)) ?? {}
  const body = {
    ...oldConf,
    name: newSlug,
    runOnReady: buildRunOnReady(newMeta),
    runOnReadyRestart: relayHasActiveCommand(),
    runOnNotReady: "",
  }
  await mtxFetch(
    `/v3/config/paths/add/${encodeURIComponent(newSlug)}`,
    { method: "POST", body: JSON.stringify(body) },
    authOverride,
  )

  // Recreate every fan-out path under the new slug (its source + name change),
  // then drop the stale one. Destination metadata is preserved verbatim.
  for (const d of dests) {
    const fanBody = fanoutAddBody(newSlug, d, { relayEnabled, fallback: newMeta.fallback })
    await mtxFetch(
      `/v3/config/paths/add/${encodeURIComponent(fanBody.name)}`,
      { method: "POST", body: JSON.stringify(fanBody) },
      authOverride,
    )
    await mtxFetch(
      `/v3/config/paths/delete/${encodeURIComponent(fanoutPathName(oldSlug, d.id))}`,
      { method: "DELETE" },
      authOverride,
    ).catch(() => {})
  }

  await mtxFetch(`/v3/config/paths/delete/${encodeURIComponent(oldSlug)}`, { method: "DELETE" }, authOverride)
  return newSlug
}
