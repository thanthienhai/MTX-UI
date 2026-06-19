/**
 * Tests for the admin create-event route — `app/api/relay/events/route.ts`.
 * Verifies the auth gate, body validation, and that the admin's Authorization
 * header is forwarded to MediaMTX (so the path is created under their
 * credentials, not under the server's env identity).
 */

import assert from "node:assert/strict"
import { parseRunOnReady } from "@/lib/relay-event.mjs"

interface MockCall {
  url: string
  method: string
  authorization: string | null
  body: unknown
}
const calls: MockCall[] = []
let respondWith: { status?: number; body?: unknown } = { body: {} }

;(globalThis as { fetch: unknown }).fetch = async (input: string | URL, init?: RequestInit) => {
  const url = typeof input === "string" ? input : input.toString()
  const headers = new Headers(init?.headers)
  let parsedBody: unknown
  if (init?.body && typeof init.body === "string") {
    try {
      parsedBody = JSON.parse(init.body)
    } catch {
      parsedBody = init.body
    }
  }
  calls.push({
    url,
    method: (init?.method || "GET").toUpperCase(),
    authorization: headers.get("authorization"),
    body: parsedBody,
  })
  return new Response(JSON.stringify(respondWith.body ?? {}), {
    status: respondWith.status ?? 200,
    headers: { "content-type": "application/json" },
  })
}

process.env.MEDIAMTX_API_URL = "http://mtx.test:9997"
process.env.MEDIAMTX_ADMIN_USER = "envadmin"
process.env.MEDIAMTX_ADMIN_PASS = "envpass"

const route = await import("@/app/api/relay/events/route")

function makeReq(opts: { authorization?: string; body?: unknown }): Request {
  const headers: Record<string, string> = { "content-type": "application/json" }
  if (opts.authorization) headers.authorization = opts.authorization
  return new Request("http://test/api/relay/events", {
    method: "POST",
    headers,
    body: JSON.stringify(opts.body ?? {}),
  })
}

/* ------------------------------------------------------------------ */
/* auth gate                                                           */
/* ------------------------------------------------------------------ */

calls.length = 0
let res = await route.POST(makeReq({ body: { displayName: "no auth" } }))
assert.equal(res.status, 401, "missing Authorization → 401")
assert.equal(calls.length, 0, "no upstream call when unauthorized")

calls.length = 0
res = await route.POST(makeReq({ authorization: "Garbage notvalid", body: { displayName: "x" } }))
assert.equal(res.status, 401, "malformed Authorization → 401")
assert.equal(calls.length, 0)

/* ------------------------------------------------------------------ */
/* body validation                                                     */
/* ------------------------------------------------------------------ */

const ADMIN_AUTH = "Basic " + Buffer.from("alice:p@ssw0rd").toString("base64")

calls.length = 0
res = await route.POST(makeReq({ authorization: ADMIN_AUTH, body: {} }))
assert.equal(res.status, 400, "missing displayName → 400")
let body = (await res.json()) as { error?: string }
assert.match(body.error || "", /tên sự kiện/i)
assert.equal(calls.length, 0, "no upstream call when body invalid")

calls.length = 0
res = await route.POST(makeReq({ authorization: ADMIN_AUTH, body: { displayName: "   " } }))
assert.equal(res.status, 400, "whitespace-only displayName → 400")

/* ------------------------------------------------------------------ */
/* happy path: creates event, forwards admin auth header                */
/* ------------------------------------------------------------------ */

calls.length = 0
respondWith = { status: 200, body: {} }
res = await route.POST(
  makeReq({ authorization: ADMIN_AUTH, body: { displayName: "Concert 2026-06-13", quota: 8 } }),
)
assert.equal(res.status, 201)
const created = (await res.json()) as Record<string, string>
assert.match(created.pathKey, /^[A-Za-z0-9]{20}$/)
assert.match(created.loginCode, /^[A-Za-z0-9]{11}$/)
assert.ok(created.statusToken && created.configToken)

assert.equal(calls.length, 1, "single upstream call")
const call = calls[0]
assert.equal(call.method, "POST")
assert.ok(call.url.startsWith("http://mtx.test:9997/v3/config/paths/add/"))
assert.ok(call.url.endsWith(`/${created.pathKey}`))

/* Critical: admin's Authorization header is FORWARDED to MediaMTX, not env */
assert.equal(call.authorization, ADMIN_AUTH, "admin's header is forwarded (path created under their identity)")
assert.notEqual(
  call.authorization,
  "Basic " + Buffer.from("envadmin:envpass").toString("base64"),
  "env creds NOT used when caller forwards their own header",
)

/* Body shape from upstream call */
const upstreamBody = call.body as Record<string, unknown>
assert.equal(upstreamBody.source, "publisher")
assert.equal(upstreamBody.record, false)
assert.equal(upstreamBody.runOnReadyRestart, false, "no destinations → no-op must not restart")
const meta = parseRunOnReady(upstreamBody.runOnReady as string)
assert.ok(meta)
assert.equal(meta.displayName, "Concert 2026-06-13")
assert.equal(meta.quota, 8)
assert.equal(meta.statusToken, created.statusToken)
// Plaintext login code MUST NOT appear in stored config
const upstreamJson = JSON.stringify(upstreamBody)
assert.equal(upstreamJson.includes(created.loginCode), false, "plaintext login code does NOT leak into path config")

/* ------------------------------------------------------------------ */
/* upstream error → 502                                                */
/* ------------------------------------------------------------------ */

calls.length = 0
respondWith = { status: 503, body: { error: "down" } }
res = await route.POST(makeReq({ authorization: ADMIN_AUTH, body: { displayName: "Will fail" } }))
assert.equal(res.status, 502, "upstream failure surfaces as 502")
body = (await res.json()) as { error?: string }
assert.match(body.error || "", /sự kiện/i)

console.log("test-relay-admin-route.ts: all assertions passed")
