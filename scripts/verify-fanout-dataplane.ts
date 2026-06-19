/**
 * DATA-PLANE verification: does the multi-destination fan-out actually RUN on
 * the MediaMTX server? The relay's runOnReady launches `ffmpeg ... -f tee`, so
 * this only works if the MediaMTX container ships ffmpeg.
 *
 * Trick: point ONE destination back at the same MediaMTX over RTMP
 * (rtmp://127.0.0.1:1935/<loop>). If ffmpeg runs, the loop path becomes a live
 * publisher we can observe via the API — proving the real relay path end-to-end
 * without any external platform.
 *
 * Run: node --import ./scripts/test-register.mjs scripts/verify-fanout-dataplane.ts
 */
import assert from "node:assert/strict"

const API = "http://103.179.189.128:9997"
process.env.MEDIAMTX_API_URL = API
process.env.MEDIAMTX_ADMIN_USER = "admin"
process.env.MEDIAMTX_ADMIN_PASS = "adminpass"
process.env.RELAY_SESSION_SECRET = "itest-secret"

const ADMIN_AUTH = "Basic " + Buffer.from("admin:adminpass").toString("base64")
const adminRoute = await import("@/app/api/relay/events/route")
const loginRoute = await import("@/app/api/public/config/[token]/login/route")
const configRoute = await import("@/app/api/public/config/[token]/route")
const { CONFIG_SESSION_COOKIE } = await import("@/lib/relay-server")
const { parseRunOnReady } = await import("@/lib/relay-event.mjs")

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const ctx = (p: Record<string, unknown>) => ({ params: Promise.resolve(p) })
const backend = (path: string, init?: RequestInit) =>
  fetch(`${API}${path}`, { ...init, headers: { authorization: ADMIN_AUTH, "content-type": "application/json", ...(init?.headers || {}) } })

const LOOP = "itest_relayloop_" + Math.random().toString(36).slice(2, 8)

async function cleanup() {
  // delete ITEST- config paths
  const list = (await (await backend("/v3/config/paths/list")).json()) as { items?: { name?: string; runOnReady?: string }[] }
  for (const it of list.items ?? []) {
    const m = it.runOnReady ? (parseRunOnReady(it.runOnReady) as { displayName?: string } | null) : null
    if (m?.displayName?.startsWith("ITEST-") && it.name) await backend(`/v3/config/paths/delete/${encodeURIComponent(it.name)}`, { method: "DELETE" })
  }
}

try {
  // 1. create event
  const created = await adminRoute.POST(
    new Request("http://t/x", { method: "POST", headers: { authorization: ADMIN_AUTH, "content-type": "application/json" }, body: JSON.stringify({ displayName: "ITEST-Fanout" }) }),
  )
  const ev = (await created.json()) as { pathKey: string; loginCode: string; configToken: string }
  console.log(`event: ${ev.pathKey}`)

  // 2. login → cookie
  const lr = await loginRoute.POST(
    new Request("http://t/x", { method: "POST", body: JSON.stringify({ code: ev.loginCode }) }),
    ctx({ token: ev.configToken }),
  )
  const session = lr.headers.get("set-cookie")!.match(new RegExp(`${CONFIG_SESSION_COOKIE}=([^;]*)`))![1]

  // 3. add a destination that loops back into this MediaMTX over RTMP
  const add = await configRoute.POST(
    new Request("http://t/x", {
      method: "POST",
      headers: { cookie: `${CONFIG_SESSION_COOKIE}=${session}` },
      body: JSON.stringify({ action: "add_destination", name: "loopback", platform: "custom", serverUrl: "rtmp://127.0.0.1:1935", streamKey: LOOP, enabled: true }),
    }),
    ctx({ token: ev.configToken }),
  )
  assert.equal(add.status, 200, "add loopback destination")
  console.log(`destination → rtmp://127.0.0.1:1935/${LOOP}`)

  // 4. make the event ready by pulling the running `test` feed (stands in for a vMix publisher)
  await backend(`/v3/config/paths/patch/${ev.pathKey}`, { method: "PATCH", body: JSON.stringify({ source: "rtsp://127.0.0.1:8554/test", sourceOnDemand: false }) })

  // 5. observe whether the loop path becomes a live publisher (= ffmpeg fan-out ran)
  let ready = false
  let lastSource = ""
  for (let i = 0; i < 30; i++) {
    await sleep(1000)
    const r = await backend(`/v3/paths/get/${LOOP}`)
    if (r.status === 200) {
      const p = (await r.json()) as { ready?: boolean; source?: { type?: string }; tracks?: string[] }
      lastSource = p.source?.type || ""
      if (p.ready) {
        ready = true
        console.log(`\n✓ FAN-OUT CHẠY THẬT: loop path ready, source=${lastSource}, tracks=${JSON.stringify(p.tracks)}`)
        break
      }
    }
  }

  if (!ready) {
    console.log("\n✗ Loop path KHÔNG ready sau 30s.")
    console.log("  → Nhiều khả năng MediaMTX container KHÔNG có ffmpeg, hoặc runOnReady không chạy.")
    console.log("  → Control plane vẫn đúng, nhưng relay đa nền tảng (fan-out) sẽ KHÔNG hoạt động cho tới khi có ffmpeg trong container.")
  }
} finally {
  await cleanup()
  console.log("cleaned up")
}
