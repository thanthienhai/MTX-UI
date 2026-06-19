/**
 * Tests for the public relay route handlers — `app/api/public/config/[token]`
 * (GET payload + POST actions) and `app/api/public/config/[token]/login`.
 * Exercises the full Request → handler → Response cycle with a mocked
 * MediaMTX Control API so we cover cookie parsing, session checks, dispatch
 * matrix, and the security-critical 401/404 behavior.
 */

import assert from "node:assert/strict"
import { createEventMeta, buildRunOnReady } from "@/lib/relay-event.mjs"

/* ------------------------------------------------------------------ */
/* fetch mock — same shape as relay-server tests                        */
/* ------------------------------------------------------------------ */

interface MockCall {
  url: string
  method: string
  body: unknown
}
const calls: MockCall[] = []
let handler: (call: MockCall) => { status?: number; body?: unknown } = () => ({ body: {} })

;(globalThis as { fetch: unknown }).fetch = async (input: string | URL, init?: RequestInit) => {
  const url = typeof input === "string" ? input : input.toString()
  const method = (init?.method || "GET").toUpperCase()
  let parsedBody: unknown = undefined
  if (init?.body && typeof init.body === "string") {
    try {
      parsedBody = JSON.parse(init.body)
    } catch {
      parsedBody = init.body
    }
  }
  const call: MockCall = { url, method, body: parsedBody }
  calls.push(call)
  const result = handler(call)
  const status = result.status ?? 200
  const text = result.body === undefined ? "" : JSON.stringify(result.body)
  return new Response(text, { status, headers: { "content-type": "application/json" } })
}

/* ------------------------------------------------------------------ */
/* fixture event + mock router                                          */
/* ------------------------------------------------------------------ */

process.env.MEDIAMTX_API_URL = "http://mtx.test:9997"
process.env.MEDIAMTX_ADMIN_USER = "admin"
process.env.MEDIAMTX_ADMIN_PASS = "pw"
process.env.RELAY_SESSION_SECRET = "route-secret"

const { meta: fixtureMeta, loginCode: fixtureLoginCode } = createEventMeta({
  displayName: "Route fixture",
  quota: 5,
  loginCode: "CorrectHorse9",
})
let fixtureRunOnReady = buildRunOnReady(fixtureMeta)
let fixtureRecord = false

setupRouter()

function setupRouter() {
  handler = (call) => {
    if (call.url.includes("/v3/config/paths/list")) {
      return {
        body: {
          items: [{ name: fixtureMeta.slug, runOnReady: fixtureRunOnReady }],
        },
      }
    }
    if (call.url.includes(`/v3/config/paths/get/${encodeURIComponent(fixtureMeta.slug)}`)) {
      return { body: { source: "publisher", record: fixtureRecord, runOnReady: fixtureRunOnReady } }
    }
    if (call.url.includes(`/v3/paths/get/${encodeURIComponent(fixtureMeta.slug)}`)) {
      return { body: { ready: false, tracks: [], readers: [], source: null, bytesReceived: 0, bytesSent: 0 } }
    }
    if (call.url.includes("/v3/config/paths/patch/") && call.method === "PATCH") {
      const body = (call.body || {}) as Record<string, unknown>
      if (typeof body.runOnReady === "string") fixtureRunOnReady = body.runOnReady
      if (body.record !== undefined) fixtureRecord = !!body.record
      return { body: {} }
    }
    return { body: {} }
  }
}

/* dynamic imports so env + global mock are in place ------------------- */
const configRoute = await import("@/app/api/public/config/[token]/route")
const loginRoute = await import("@/app/api/public/config/[token]/login/route")

/* helpers ------------------------------------------------------------ */

function makeRequest(opts: {
  method?: string
  body?: unknown
  cookie?: string
}): Request {
  const init: RequestInit = {
    method: opts.method ?? "GET",
    headers: opts.cookie ? { cookie: opts.cookie, "content-type": "application/json" } : { "content-type": "application/json" },
  }
  if (opts.body !== undefined) init.body = JSON.stringify(opts.body)
  // URL is irrelevant to the handler logic; params come from context.
  return new Request("http://test.local/api/public/config/token", init)
}

function ctx(token: string) {
  return { params: Promise.resolve({ token }) }
}

function readSetCookie(res: Response): string | null {
  return res.headers.get("set-cookie")
}

/* ------------------------------------------------------------------ */
/* unauthenticated access                                              */
/* ------------------------------------------------------------------ */

let res = await configRoute.GET(makeRequest({}), ctx(fixtureMeta.configToken))
assert.equal(res.status, 401, "no cookie → 401")
let body = (await res.json()) as { error?: string }
assert.equal(body.error, "Unauthorized")

res = await configRoute.GET(makeRequest({ cookie: "relay_config_session=garbage" }), ctx(fixtureMeta.configToken))
assert.equal(res.status, 401, "bogus session → 401")

/* unknown token → 404 (without leaking whether the token exists) ------ */
res = await configRoute.GET(makeRequest({}), ctx("definitely-not-a-token"))
assert.equal(res.status, 404)

/* status token cannot be used on the config endpoint ------------------ */
res = await configRoute.GET(makeRequest({}), ctx(fixtureMeta.statusToken))
assert.equal(res.status, 404, "wrong-kind token rejected as not-found")

/* ------------------------------------------------------------------ */
/* login flow                                                          */
/* ------------------------------------------------------------------ */

res = await loginRoute.POST(makeRequest({ method: "POST", body: { code: "wrongCode" } }), ctx(fixtureMeta.configToken))
assert.equal(res.status, 401, "wrong code → 401")
assert.equal(readSetCookie(res), null, "no session cookie when login fails")

res = await loginRoute.POST(
  makeRequest({ method: "POST", body: { code: fixtureLoginCode } }),
  ctx(fixtureMeta.configToken),
)
assert.equal(res.status, 200, "correct code → 200")
const cookieHeader = readSetCookie(res)
assert.ok(cookieHeader, "session cookie set")
assert.match(cookieHeader!, /HttpOnly/i, "HttpOnly flag present")
assert.match(cookieHeader!, /SameSite=Lax/i, "SameSite=Lax")
assert.match(
  cookieHeader!,
  new RegExp(`Path=/api/public/config/${fixtureMeta.configToken}`),
  "Path scoped to this event's config token (so it can't be replayed at another)",
)
// Extract the session token for subsequent calls
const sessionToken = cookieHeader!.match(/relay_config_session=([^;]+)/)?.[1]
assert.ok(sessionToken, "cookie value extracted")
const sessionCookie = `relay_config_session=${sessionToken}`

/* ------------------------------------------------------------------ */
/* authenticated GET returns the owner config payload                   */
/* ------------------------------------------------------------------ */

res = await configRoute.GET(makeRequest({ cookie: sessionCookie }), ctx(fixtureMeta.configToken))
assert.equal(res.status, 200, "valid session → 200")
const payload = (await res.json()) as Record<string, unknown>
assert.equal(payload.displayName, "Route fixture")
assert.equal(payload.slug, fixtureMeta.slug)
assert.equal(payload.statusToken, fixtureMeta.statusToken)
assert.equal(payload.configToken, fixtureMeta.configToken)
assert.equal(payload.recordEnabled, false)
assert.equal(payload.relayEnabled, true)
assert.deepEqual(payload.destinations, [], "no destinations yet")
const ingest = payload.ingest as Record<string, string>
assert.ok(ingest.srtStreamId.startsWith("publish:"), "SRT publish stream id")
assert.ok(Array.isArray(payload.audit), "audit array present")

/* ------------------------------------------------------------------ */
/* POST actions: dispatch matrix                                       */
/* ------------------------------------------------------------------ */

/* set_record */
res = await configRoute.POST(
  makeRequest({ method: "POST", body: { action: "set_record", enabled: true }, cookie: sessionCookie }),
  ctx(fixtureMeta.configToken),
)
assert.equal(res.status, 200)
assert.equal(fixtureRecord, true, "set_record propagated to upstream state")

/* set_relay false */
res = await configRoute.POST(
  makeRequest({ method: "POST", body: { action: "set_relay", enabled: false }, cookie: sessionCookie }),
  ctx(fixtureMeta.configToken),
)
assert.equal(res.status, 200)
assert.ok(!fixtureRunOnReady.includes("ffmpeg "), "relay off persisted")

/* add_destination + quota happy path */
res = await configRoute.POST(
  makeRequest({
    method: "POST",
    body: {
      action: "add_destination",
      name: "FB",
      platform: "facebook",
      serverUrl: "rtmps://live-api.facebook.com:443/rtmp/",
      streamKey: "k1",
      enabled: true,
    },
    cookie: sessionCookie,
  }),
  ctx(fixtureMeta.configToken),
)
assert.equal(res.status, 200, "add_destination ok")

/* validation error returns 400 with explanation */
res = await configRoute.POST(
  makeRequest({
    method: "POST",
    body: { action: "add_destination", name: "X", platform: "facebook", serverUrl: "http://bad", streamKey: "k" },
    cookie: sessionCookie,
  }),
  ctx(fixtureMeta.configToken),
)
assert.equal(res.status, 400)
body = (await res.json()) as { error?: string }
assert.match(body.error || "", /rtmp\/rtmps\/srt/)

/* unknown action → 400 */
res = await configRoute.POST(
  makeRequest({ method: "POST", body: { action: "no_such_action" }, cookie: sessionCookie }),
  ctx(fixtureMeta.configToken),
)
assert.equal(res.status, 400)
body = (await res.json()) as { error?: string }
assert.match(body.error || "", /không hợp lệ/i)

/* missing id on update_destination → 400 */
res = await configRoute.POST(
  makeRequest({ method: "POST", body: { action: "update_destination", patch: {} }, cookie: sessionCookie }),
  ctx(fixtureMeta.configToken),
)
assert.equal(res.status, 400)

/* unknown id on update_destination → 400 (action-result error) */
res = await configRoute.POST(
  makeRequest({ method: "POST", body: { action: "update_destination", id: "ghost", patch: { enabled: true } }, cookie: sessionCookie }),
  ctx(fixtureMeta.configToken),
)
assert.equal(res.status, 400)

/* change_config_code: <6 chars → 400; ok path → 200 + cleared cookie    */
res = await configRoute.POST(
  makeRequest({ method: "POST", body: { action: "change_config_code", newCode: "abc" }, cookie: sessionCookie }),
  ctx(fixtureMeta.configToken),
)
assert.equal(res.status, 400, "code <6 chars rejected")

res = await configRoute.POST(
  makeRequest({ method: "POST", body: { action: "change_config_code", newCode: "ValidLongCode" }, cookie: sessionCookie }),
  ctx(fixtureMeta.configToken),
)
assert.equal(res.status, 200)
const cleared = readSetCookie(res) || ""
assert.match(cleared, /Max-Age=0/, "cookie cleared so user must re-login")

/* regenerate_login_code returns plaintext ONCE + clears cookie -------- */
// Note: previous step cleared cookie. Re-login first.
res = await loginRoute.POST(
  makeRequest({ method: "POST", body: { code: "ValidLongCode" } }),
  ctx(fixtureMeta.configToken),
)
assert.equal(res.status, 200)
const cookie2 = readSetCookie(res)!.match(/relay_config_session=([^;]+)/)![1]
const sessionCookie2 = `relay_config_session=${cookie2}`

res = await configRoute.POST(
  makeRequest({ method: "POST", body: { action: "regenerate_login_code" }, cookie: sessionCookie2 }),
  ctx(fixtureMeta.configToken),
)
assert.equal(res.status, 200)
const regenBody = (await res.json()) as { loginCode?: string; ok?: boolean }
assert.ok(regenBody.loginCode && /^[A-Za-z0-9]{11}$/.test(regenBody.loginCode), "fresh code returned in response")
assert.match(readSetCookie(res) || "", /Max-Age=0/, "session cleared on regen")

/* rotate_status_token → returns new token, statusToken changes ------- */
res = await loginRoute.POST(
  makeRequest({ method: "POST", body: { code: regenBody.loginCode } }),
  ctx(fixtureMeta.configToken),
)
const sessionCookie3 = `relay_config_session=${readSetCookie(res)!.match(/relay_config_session=([^;]+)/)![1]}`

res = await configRoute.POST(
  makeRequest({ method: "POST", body: { action: "rotate_status_token" }, cookie: sessionCookie3 }),
  ctx(fixtureMeta.configToken),
)
assert.equal(res.status, 200)
const newStatus = ((await res.json()) as { statusToken?: string }).statusToken
assert.ok(newStatus && newStatus !== fixtureMeta.statusToken, "status token actually rotates")

/* rotate_config_token also clears cookie so old session can't follow -- */
res = await configRoute.POST(
  makeRequest({ method: "POST", body: { action: "rotate_config_token" }, cookie: sessionCookie3 }),
  ctx(fixtureMeta.configToken),
)
assert.equal(res.status, 200)
assert.match(readSetCookie(res) || "", /Max-Age=0/, "rotate_config_token clears the old cookie")

/* logout: no upstream lookup needed; cookie cleared ------------------- */
const beforeCalls = calls.length
res = await configRoute.POST(
  makeRequest({ method: "POST", body: { action: "logout" }, cookie: "relay_config_session=garbage" }),
  ctx(fixtureMeta.configToken),
)
assert.equal(res.status, 200)
assert.match(readSetCookie(res) || "", /Max-Age=0/, "logout clears cookie")
assert.equal(calls.length, beforeCalls, "logout makes no upstream calls")

console.log("test-relay-public-routes.ts: all assertions passed")
