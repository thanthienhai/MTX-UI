/**
 * Tests for lib/relay-server.ts — the server-side MediaMTX wrapper that powers
 * the public relay pages. We mock global fetch so we can assert URL, auth
 * header, and body for every Control API call without needing a live server.
 */

import assert from "node:assert/strict"
import {
  parseRunOnReady,
  hashLoginCode,
} from "@/lib/relay-event.mjs"

/* ------------------------------------------------------------------ */
/* fetch mock                                                          */
/* ------------------------------------------------------------------ */

interface MockCall {
  url: string
  method: string
  authorization: string | null
  body: unknown
}

interface MockResponse {
  status?: number
  body?: unknown
}

type Handler = (call: MockCall) => MockResponse

const calls: MockCall[] = []
let handler: Handler = () => ({ status: 200, body: {} })

function setHandler(h: Handler) {
  handler = h
}

function resetCalls() {
  calls.length = 0
}

;(globalThis as { fetch: unknown }).fetch = async (input: string | URL, init?: RequestInit) => {
  const url = typeof input === "string" ? input : input.toString()
  const method = (init?.method || "GET").toUpperCase()
  const headers = new Headers(init?.headers)
  let parsedBody: unknown = undefined
  if (init?.body && typeof init.body === "string") {
    try {
      parsedBody = JSON.parse(init.body)
    } catch {
      parsedBody = init.body
    }
  }
  const call: MockCall = {
    url,
    method,
    authorization: headers.get("authorization"),
    body: parsedBody,
  }
  calls.push(call)
  const result = handler(call)
  const status = result.status ?? 200
  const bodyText = result.body === undefined ? "" : JSON.stringify(result.body)
  return new Response(bodyText, { status, headers: { "content-type": "application/json" } })
}

/* ------------------------------------------------------------------ */
/* env setup                                                           */
/* ------------------------------------------------------------------ */

process.env.MEDIAMTX_API_URL = "http://mtx.test:9997"
process.env.MEDIAMTX_ADMIN_USER = "admin"
process.env.MEDIAMTX_ADMIN_PASS = "s3cret"
process.env.RELAY_SESSION_SECRET = "test-secret-please-rotate"
process.env.NEXT_PUBLIC_MEDIAMTX_RTMP_HOST = "rtmp.example.com"
process.env.NEXT_PUBLIC_MEDIAMTX_RTMPS_HOST = "rtmp.example.com"
process.env.NEXT_PUBLIC_MEDIAMTX_SRT_HOST = "srt.example.com"

const ADMIN_BASIC = "Basic " + Buffer.from("admin:s3cret").toString("base64")

const server = await import("@/lib/relay-server")

/* ------------------------------------------------------------------ */
/* createEvent — fundamental write path                                */
/* ------------------------------------------------------------------ */

resetCalls()
setHandler(() => ({ status: 200, body: {} }))
const created = await server.createEvent({ displayName: "Test Event", quota: 5 })
assert.match(created.pathKey, /^[A-Za-z0-9]{20}$/, "pathKey is a 20-char slug")
assert.match(created.loginCode, /^[A-Za-z0-9]{11}$/, "loginCode shape")
assert.ok(created.statusToken && created.configToken, "tokens returned")
assert.equal(calls.length, 1, "single PATH add call")
const addCall = calls[0]
assert.equal(addCall.method, "POST", "POST path add")
assert.ok(
  addCall.url.startsWith("http://mtx.test:9997/v3/config/paths/add/"),
  "URL targets the configured MediaMTX base + correct endpoint",
)
assert.ok(addCall.url.endsWith(`/${created.pathKey}`), "URL ends with the new slug")
assert.equal(addCall.authorization, ADMIN_BASIC, "uses env admin Basic auth by default")
const addBody = addCall.body as Record<string, unknown>
assert.equal(addBody.source, "publisher", "publisher source")
assert.equal(addBody.record, false, "record starts off")
assert.equal(addBody.runOnReadyRestart, true, "runOnReady should restart on crash")
const meta = parseRunOnReady(addBody.runOnReady as string)
assert.ok(meta, "runOnReady carries RELAY_META")
assert.equal(meta.displayName, "Test Event")
assert.equal(meta.quota, 5)
assert.equal(meta.destinations.length, 0)
assert.equal(meta.statusToken, created.statusToken)

/* authOverride forwards a logged-in admin's header instead of env ----- */
resetCalls()
const forwarded = await server.createEvent({ displayName: "via override" }, "Basic OVERRIDE==")
assert.equal(calls[0].authorization, "Basic OVERRIDE==", "authOverride wins over env")
assert.ok(forwarded.pathKey, "still returns the freshly minted key")

/* ------------------------------------------------------------------ */
/* mtxFetch error handling                                             */
/* ------------------------------------------------------------------ */

resetCalls()
setHandler(() => ({ status: 500, body: { error: "boom" } }))
await assert.rejects(
  () => server.createEvent({ displayName: "fails" }),
  /MediaMTX .* -> 500/,
  "non-2xx responses surface as Error with endpoint + status",
)

/* ------------------------------------------------------------------ */
/* listEvents skips paths that lack RELAY_META                          */
/* ------------------------------------------------------------------ */

resetCalls()
const goodMeta = (await import("@/lib/relay-event.mjs")).createEventMeta({ displayName: "L" }).meta
const goodRor = (await import("@/lib/relay-event.mjs")).buildRunOnReady(goodMeta)
setHandler((call) => {
  if (call.url.endsWith("/v3/config/paths/list")) {
    return {
      body: {
        items: [
          { name: "no-meta", runOnReady: "ffmpeg -i in -c copy out.flv" },
          { name: "broken", runOnReady: "# RELAY_META:!!!not-base64-json" },
          { name: goodMeta.slug, runOnReady: goodRor },
        ],
      },
    }
  }
  return { body: {} }
})
const list = await server.listEvents()
assert.equal(list.length, 1, "only the path carrying valid meta is returned")
assert.equal(list[0].pathName, goodMeta.slug)
assert.equal(list[0].meta.displayName, "L")

/* findEventByToken matches the requested token kind ------------------ */
const foundStatus = await server.findEventByToken(goodMeta.statusToken, "status")
assert.ok(foundStatus, "status token resolves")
assert.equal(foundStatus!.pathName, goodMeta.slug)
const foundConfig = await server.findEventByToken(goodMeta.configToken, "config")
assert.ok(foundConfig, "config token resolves")
const notCross = await server.findEventByToken(goodMeta.statusToken, "config")
assert.equal(notCross, null, "status token does NOT authorize as config token")
const missing = await server.findEventByToken("nope", "status")
assert.equal(missing, null, "unknown token → null (not throw)")

/* ------------------------------------------------------------------ */
/* session sign/verify                                                  */
/* ------------------------------------------------------------------ */

const sess = server.issueConfigSession(goodMeta.configToken)
assert.equal(server.isValidConfigSession(sess, goodMeta.configToken), true, "session round-trips")
assert.equal(server.isValidConfigSession(sess, "other-token"), false, "session bound to its config token")
assert.equal(server.isValidConfigSession(undefined, goodMeta.configToken), false, "no cookie → invalid")
assert.equal(server.isValidConfigSession("garbage", goodMeta.configToken), false, "bogus cookie → invalid")

/* ------------------------------------------------------------------ */
/* runtime offline fallback                                             */
/* ------------------------------------------------------------------ */

resetCalls()
setHandler((call) => {
  if (call.url.includes("/v3/paths/get/")) return { status: 404 }
  return { body: {} }
})
const offline = await server.getEventRuntime("no-such-path")
assert.equal(offline.online, false, "404 → offline, not exception")
assert.equal(offline.readers, 0)
assert.equal(offline.bytesReceived, 0)

resetCalls()
setHandler((call) => {
  if (call.url.includes("/v3/paths/get/")) {
    return {
      body: {
        ready: true,
        bytesReceived: 1024,
        bytesSent: 2048,
        tracks: ["H264", "AAC"],
        readers: [{}, {}, {}],
        source: { type: "rtmpConn" },
      },
    }
  }
  return { body: {} }
})
const online = await server.getEventRuntime("alive")
assert.equal(online.online, true)
assert.equal(online.bytesReceived, 1024)
assert.equal(online.readers, 3, "readers counted from array length")
assert.deepEqual(online.tracks, ["H264", "AAC"])
assert.equal(online.sourceType, "rtmpConn")

/* ------------------------------------------------------------------ */
/* destination CRUD: add → quota gate → enable too many → reject       */
/* ------------------------------------------------------------------ */

const event = {
  pathName: goodMeta.slug,
  meta: { ...goodMeta, quota: 2, destinations: [] },
  runOnReady: "",
}

resetCalls()
setHandler(() => ({ body: {} }))
let r = await server.addEventDestination(event, {
  name: "FB",
  platform: "facebook",
  serverUrl: "rtmps://live-api.facebook.com:443/rtmp/",
  streamKey: "k1",
  enabled: true,
})
assert.equal(r.ok, true, "first enabled destination accepted")
assert.equal(calls.length, 1)
assert.equal(calls[0].method, "PATCH", "writes via PATCH")
const patchedMeta = parseRunOnReady((calls[0].body as Record<string, unknown>).runOnReady as string)
assert.equal(patchedMeta.destinations.length, 1)
assert.equal(patchedMeta.destinations[0].name, "FB")

/* Adding a third ENABLED dest while quota=2 with 2 enabled in-meta → quota error */
const eventFull = {
  ...event,
  meta: {
    ...event.meta,
    destinations: [
      { id: "x1", name: "A", platform: "facebook", serverUrl: "rtmp://a", streamKey: "k", enabled: true },
      { id: "x2", name: "B", platform: "youtube", serverUrl: "rtmp://b", streamKey: "k", enabled: true },
    ],
  },
}
resetCalls()
r = await server.addEventDestination(eventFull, {
  name: "C",
  platform: "custom",
  serverUrl: "rtmp://c",
  streamKey: "k3",
  enabled: true,
})
assert.equal(r.ok, false, "quota gate triggers")
assert.equal(r.error, "Vượt quá quota luồng đang bật")
assert.equal(calls.length, 0, "no upstream call when quota fails")

/* Adding a DISABLED dest above quota → OK; enabling it later → quota check */
resetCalls()
r = await server.addEventDestination(eventFull, {
  name: "C",
  platform: "custom",
  serverUrl: "rtmp://c",
  streamKey: "k3",
  enabled: false,
})
assert.equal(r.ok, true, "disabled-above-quota add allowed (we only count enabled)")

/* Validation errors bubble up before any fetch ------------------------ */
resetCalls()
r = await server.addEventDestination(event, {
  name: "no scheme",
  platform: "facebook",
  serverUrl: "http://nope",
  streamKey: "k",
})
assert.equal(r.ok, false)
assert.match(r.error || "", /rtmp\/rtmps\/srt/)
assert.equal(calls.length, 0, "validation failure → no upstream traffic")

/* updateEventDestination: unknown id → error, no PATCH ----------------- */
resetCalls()
r = await server.updateEventDestination(eventFull, "no-such-id", { enabled: false })
assert.equal(r.ok, false)
assert.equal(calls.length, 0)

/* deleteEventDestination: PATCHes and the new runOnReady drops the row */
resetCalls()
await server.deleteEventDestination(eventFull, "x1")
assert.equal(calls.length, 1)
const afterDelete = parseRunOnReady((calls[0].body as Record<string, unknown>).runOnReady as string)
assert.equal(afterDelete.destinations.length, 1)
assert.equal(afterDelete.destinations[0].id, "x2")

/* ------------------------------------------------------------------ */
/* setEventRecord / setEventRelay PATCH the right field                 */
/* ------------------------------------------------------------------ */

resetCalls()
await server.setEventRecord(event, true)
assert.equal(calls[0].method, "PATCH")
assert.deepEqual(calls[0].body, { record: true }, "record toggle patches the record field only")

resetCalls()
await server.setEventRelay(event, false)
const relayBody = calls[0].body as Record<string, unknown>
const relayMeta = parseRunOnReady(relayBody.runOnReady as string)
assert.equal(relayMeta.relayEnabled, false, "relay off persisted to meta")
assert.ok(!(relayBody.runOnReady as string).startsWith("ffmpeg "), "no ffmpeg when relay off")

/* ------------------------------------------------------------------ */
/* rotateEventStreamId: add new path + delete old, preserve share tokens */
/* ------------------------------------------------------------------ */

resetCalls()
setHandler((call) => {
  if (call.url.includes("/v3/config/paths/get/")) {
    return { body: { source: "publisher", record: true } }
  }
  return { body: {} }
})
const newSlug = await server.rotateEventStreamId(event)
assert.notEqual(newSlug, event.meta.slug, "actually rotates")
const addRotate = calls.find((c) => c.method === "POST" && c.url.includes("/v3/config/paths/add/"))
const delRotate = calls.find((c) => c.method === "DELETE" && c.url.includes("/v3/config/paths/delete/"))
assert.ok(addRotate, "rotation issues an add for the new slug")
assert.ok(delRotate, "rotation deletes the old slug")
assert.ok(delRotate!.url.endsWith(`/${event.meta.slug}`), "old slug delete URL")
const rotatedMeta = parseRunOnReady((addRotate!.body as Record<string, unknown>).runOnReady as string)
assert.equal(rotatedMeta.slug, newSlug)
assert.equal(rotatedMeta.statusToken, event.meta.statusToken, "share tokens preserved across rotation")
assert.equal(rotatedMeta.configToken, event.meta.configToken)
const addRotateBody = addRotate!.body as Record<string, unknown>
assert.equal(addRotateBody.record, true, "preserves record flag from old path config")

/* ------------------------------------------------------------------ */
/* token rotation: status / config tokens swap, share tokens preserved  */
/* ------------------------------------------------------------------ */

resetCalls()
setHandler(() => ({ body: {} }))
const newStatusToken = await server.rotateEventStatusToken(event)
assert.notEqual(newStatusToken, event.meta.statusToken)
const statusRotateMeta = parseRunOnReady((calls[0].body as Record<string, unknown>).runOnReady as string)
assert.equal(statusRotateMeta.configToken, event.meta.configToken, "config token survives status rotate")

resetCalls()
const newConfigToken = await server.rotateEventConfigToken(event)
assert.notEqual(newConfigToken, event.meta.configToken)

/* regenerateEventLoginCode: returns plain code, persists hash --------- */
resetCalls()
const freshCode = await server.regenerateEventLoginCode(event)
assert.match(freshCode, /^[A-Za-z0-9]{11}$/, "fresh login code shape")
const regenMeta = parseRunOnReady((calls[0].body as Record<string, unknown>).runOnReady as string)
const newStored = regenMeta.loginCode as { salt: string; hash: string }
assert.ok(newStored.salt && newStored.hash, "hash + salt persisted")
assert.notDeepEqual(newStored, event.meta.loginCode, "different from old hash")
// Plaintext code MUST NOT appear in the PATCH body
const patchedJson = JSON.stringify(calls[0].body)
assert.equal(patchedJson.includes(freshCode), false, "plain login code never leaks into stored config")

/* changeEventLoginCode: same — patches new hash, plaintext doesn't leak */
resetCalls()
await server.changeEventLoginCode(event, "BrandNew99")
const changedJson = JSON.stringify(calls[0].body)
assert.equal(changedJson.includes("BrandNew99"), false, "plain new code never leaks into stored config")

/* ------------------------------------------------------------------ */
/* setEventFallback: text OK, image/video refused (no asset pipeline)  */
/* ------------------------------------------------------------------ */

resetCalls()
let fb = await server.setEventFallback(event, { type: "text", text: "Slate", enabled: true })
assert.equal(fb.ok, true)
const fbMeta = parseRunOnReady((calls[0].body as Record<string, unknown>).runOnReady as string)
assert.equal(fbMeta.fallback.type, "text")
assert.equal(fbMeta.fallback.text, "Slate")

resetCalls()
fb = await server.setEventFallback(event, { type: "image", assetRef: "/x.png" })
assert.equal(fb.ok, false)
assert.match(fb.error || "", /asset storage/, "image type rejected with explanation")
assert.equal(calls.length, 0, "no upstream call when fallback rejected")

resetCalls()
fb = await server.setEventFallback(event, { type: "frogus" })
assert.equal(fb.ok, false, "invalid type rejected")
assert.equal(calls.length, 0)

/* ------------------------------------------------------------------ */
/* audit ring buffer records mutations (slug-scoped)                    */
/* ------------------------------------------------------------------ */

const auditEntries = server.listEventAudit(event.meta.slug)
const actions = auditEntries.map((e) => e.action)
assert.ok(actions.includes("destination.delete"))
assert.ok(actions.includes("record.set"))
assert.ok(actions.includes("relay.set"))
assert.ok(actions.includes("token.rotate.status"))
assert.ok(actions.includes("token.rotate.config"))
assert.ok(actions.includes("login_code.regenerate"))
assert.ok(actions.includes("login_code.change"))
assert.ok(actions.includes("fallback.set"))
// audit detail must NOT contain plaintext secrets
const auditJson = JSON.stringify(auditEntries)
assert.equal(auditJson.includes(freshCode), false, "login code regen entry does not contain plaintext")
assert.equal(auditJson.includes("BrandNew99"), false, "login code change entry does not contain plaintext")

/* ------------------------------------------------------------------ */
/* getPublicHosts surfaces the env exactly as set                       */
/* ------------------------------------------------------------------ */

const hosts = server.getPublicHosts()
assert.equal(hosts.rtmpHost, "rtmp.example.com")
assert.equal(hosts.rtmpsHost, "rtmp.example.com")
assert.equal(hosts.srtHost, "srt.example.com")

console.log("test-relay-server.ts: all assertions passed")
