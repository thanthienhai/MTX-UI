/**
 * Focused verification for the HLS proxy query-string fix.
 * Confirms that a LL-HLS child playlist carrying `?session=...` now returns 200
 * THROUGH the token-gated proxy (previously the query was dropped → mismatch).
 *
 * Run: node --import ./scripts/test-register.mjs scripts/verify-hls-query.ts
 */
import assert from "node:assert/strict"

const API = "http://103.179.189.128:9997"
process.env.MEDIAMTX_API_URL = API
process.env.MEDIAMTX_ADMIN_USER = "admin"
process.env.MEDIAMTX_ADMIN_PASS = "adminpass"
process.env.MEDIAMTX_HLS_URL = "http://103.179.189.128:8888"
process.env.RELAY_SESSION_SECRET = "itest-secret"

const ADMIN_AUTH = "Basic " + Buffer.from("admin:adminpass").toString("base64")
const adminRoute = await import("@/app/api/relay/events/route")
const statusRoute = await import("@/app/api/public/status/[token]/route")
const hlsRoute = await import("@/app/api/public/hls/[token]/[...seg]/route")
const { parseRunOnReady } = await import("@/lib/relay-event.mjs")

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const ctx = (p: Record<string, unknown>) => ({ params: Promise.resolve(p) })
const backend = (path: string, init?: RequestInit) =>
  fetch(`${API}${path}`, { ...init, headers: { authorization: ADMIN_AUTH, "content-type": "application/json", ...(init?.headers || {}) } })

async function cleanup() {
  const list = (await (await backend("/v3/config/paths/list")).json()) as { items?: { name?: string; runOnReady?: string }[] }
  for (const it of list.items ?? []) {
    const m = it.runOnReady ? (parseRunOnReady(it.runOnReady) as { displayName?: string } | null) : null
    if (m?.displayName?.startsWith("ITEST-") && it.name) await backend(`/v3/config/paths/delete/${encodeURIComponent(it.name)}`, { method: "DELETE" })
  }
}

try {
  const created = await adminRoute.POST(
    new Request("http://t/x", { method: "POST", headers: { authorization: ADMIN_AUTH, "content-type": "application/json" }, body: JSON.stringify({ displayName: "ITEST-HLSQ" }) }),
  )
  const ev = (await created.json()) as { pathKey: string; statusToken: string }
  await backend(`/v3/config/paths/patch/${ev.pathKey}`, { method: "PATCH", body: JSON.stringify({ source: "rtsp://127.0.0.1:8554/test", sourceOnDemand: false }) })

  // wait for online
  let online = false
  for (let i = 0; i < 20 && !online; i++) {
    await sleep(1000)
    const sr = await statusRoute.GET(new Request("http://t/x"), ctx({ token: ev.statusToken }))
    online = !!((await sr.json()) as { runtime?: { online?: boolean } }).runtime?.online
  }
  assert.ok(online, "path online via test feed")
  console.log("✓ online")

  // fetch master playlist through proxy
  let master = ""
  for (let i = 0; i < 10; i++) {
    const hr = await hlsRoute.GET(new Request("http://t/x"), ctx({ token: ev.statusToken, seg: [] }))
    if (hr.status === 200) {
      master = await hr.text()
      if (master.includes("#EXTM3U")) break
    }
    await sleep(1000)
  }
  assert.ok(master.includes("#EXTM3U"), "master playlist fetched")
  console.log("✓ master playlist via proxy")

  // find a bare variant line (not a #-tag) that carries ?session=
  const child = master
    .split(/\r?\n/)
    .map((l) => l.trim())
    .find((l) => l && !l.startsWith("#") && l.includes(".m3u8") && l.includes("session="))
  assert.ok(child, "master references a child playlist with ?session=")
  const qi = child!.indexOf("?")
  const segName = child!.slice(0, qi)
  const query = child!.slice(qi + 1)
  console.log(`  child: ${segName}?${query.slice(0, 40)}...`)

  // request child WITH the session query through the proxy
  const withQ = await hlsRoute.GET(
    new Request(`http://t/x?${query}`),
    ctx({ token: ev.statusToken, seg: [segName] }),
  )
  const withQText = await withQ.text()
  assert.equal(withQ.status, 200, "child playlist with session → 200 through proxy")
  assert.ok(withQText.includes("#EXTM3U") || withQText.length > 0, "child playlist has content")
  console.log(`✓ child WITH ?session → ${withQ.status} (query forwarded OK)`)

  console.log("\nHLS query-string fix VERIFIED")
} finally {
  await cleanup()
  console.log("cleaned up")
}
