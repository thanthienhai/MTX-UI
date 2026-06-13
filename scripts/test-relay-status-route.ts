/**
 * Tests for the public status route handler — `app/api/public/status/[token]`.
 * Critical security property: ingest URLs (which embed the secret slug) MUST
 * NOT leak to anonymous viewers.
 */

import assert from "node:assert/strict"
import { createEventMeta, buildRunOnReady, addMetaDestination } from "@/lib/relay-event.mjs"

interface MockCall {
  url: string
  method: string
}
const calls: MockCall[] = []

;(globalThis as { fetch: unknown }).fetch = async (input: string | URL, init?: RequestInit) => {
  const url = typeof input === "string" ? input : input.toString()
  const call: MockCall = { url, method: (init?.method || "GET").toUpperCase() }
  calls.push(call)

  if (url.includes("/v3/config/paths/list")) {
    return new Response(JSON.stringify({ items: [{ name: fixtureMeta.slug, runOnReady: fixtureRunOnReady }] }), {
      headers: { "content-type": "application/json" },
    })
  }
  if (url.includes(`/v3/paths/get/${encodeURIComponent(fixtureMeta.slug)}`)) {
    return new Response(
      JSON.stringify({
        ready: true,
        tracks: ["H264", "AAC"],
        readers: [{}],
        source: { type: "rtmpConn" },
        bytesReceived: 100,
        bytesSent: 200,
      }),
      { headers: { "content-type": "application/json" } },
    )
  }
  return new Response("{}", { headers: { "content-type": "application/json" } })
}

process.env.MEDIAMTX_API_URL = "http://mtx.test:9997"
process.env.MEDIAMTX_ADMIN_USER = "admin"
process.env.MEDIAMTX_ADMIN_PASS = "pw"

const { meta: fixtureMeta } = createEventMeta({ displayName: "Status fixture" })
const withDest = addMetaDestination(fixtureMeta, {
  name: "FB",
  platform: "facebook",
  serverUrl: "rtmps://live-api.facebook.com:443/rtmp/",
  streamKey: "SUPER-SECRET-FB-KEY-DO-NOT-LEAK",
  enabled: true,
}).meta
const fixtureRunOnReady = buildRunOnReady(withDest)

const route = await import("@/app/api/public/status/[token]/route")

function ctx(token: string) {
  return { params: Promise.resolve({ token }) }
}

/* unknown token → 404 -------------------------------------------------- */
let res = await route.GET(new Request("http://t/x"), ctx("nope"))
assert.equal(res.status, 404, "unknown token → 404")

/* config token cannot be used on the status endpoint ----------------- */
res = await route.GET(new Request("http://t/x"), ctx(fixtureMeta.configToken))
assert.equal(res.status, 404, "wrong-kind token returns 404, not 401")

/* valid status token returns the public projection -------------------- */
res = await route.GET(new Request("http://t/x"), ctx(fixtureMeta.statusToken))
assert.equal(res.status, 200)
const payload = (await res.json()) as Record<string, unknown>

/* identity surfaces but secrets do not */
assert.equal(payload.displayName, "Status fixture")
assert.ok(Array.isArray(payload.destinations))
assert.equal((payload.destinations as Array<{ name: string }>).length, 1)
const dest = (payload.destinations as Array<{ name: string; maskedKey: string; serverUrl?: string }>)[0]
assert.equal(dest.name, "FB")
assert.match(dest.maskedKey, /^•+[A-Za-z0-9]{4}$/, "stream key masked")
assert.equal((dest as { serverUrl?: string }).serverUrl, undefined, "server URL not exposed (status payload is minimal)")

/* SECURITY: status payload must NOT expose ingest URLs / slug --------- */
const payloadJson = JSON.stringify(payload)
assert.equal(payloadJson.includes(fixtureMeta.slug), false, "secret slug never appears in status payload")
assert.equal(payloadJson.includes("SUPER-SECRET-FB-KEY"), false, "destination stream key never appears raw")
assert.equal(payloadJson.includes("statusToken"), false, "status token not echoed back in payload")
assert.equal(payloadJson.includes("configToken"), false, "config token never reachable from status endpoint")
assert.equal(payloadJson.includes("loginCode"), false, "login code hash never exposed")
assert.equal("ingest" in payload, false, "ingest URLs removed from status payload entirely")

/* runtime is present and reflects mock --------------------------------- */
const runtime = payload.runtime as Record<string, unknown>
assert.equal(runtime.online, true)
assert.equal(runtime.readers, 1)
assert.deepEqual(runtime.tracks, ["H264", "AAC"])

console.log("test-relay-status-route.ts: all assertions passed")
