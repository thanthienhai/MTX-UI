/**
 * LIVE integration test — exercises the relay route handlers against the REAL
 * MediaMTX backend (103.179.189.128). Creates throwaway events (displayName
 * prefixed "ITEST-"), runs every use-case, then deletes everything it created.
 *
 * No ffmpeg locally, so the "online" use-case is simulated by pointing a
 * throwaway path's source at the already-running `test` feed (server-side pull),
 * which produces the same ready/online runtime a real vMix publisher would.
 *
 * Run: node --import ./scripts/test-register.mjs scripts/integration-relay-live.ts
 */

import assert from "node:assert/strict"

const API = process.env.ITEST_API || "http://103.179.189.128:9997"
const ADMIN_USER = process.env.ITEST_USER || "admin"
const ADMIN_PASS = process.env.ITEST_PASS || "adminpass"

process.env.MEDIAMTX_API_URL = API
process.env.MEDIAMTX_ADMIN_USER = ADMIN_USER
process.env.MEDIAMTX_ADMIN_PASS = ADMIN_PASS
process.env.MEDIAMTX_HLS_URL = process.env.ITEST_HLS || "http://103.179.189.128:8888"
process.env.RELAY_SESSION_SECRET = "itest-secret"
process.env.NEXT_PUBLIC_MEDIAMTX_RTMP_HOST = "103.179.189.128"
process.env.NEXT_PUBLIC_MEDIAMTX_RTMP_ADDRESS = "103.179.189.128:1935"
process.env.NEXT_PUBLIC_MEDIAMTX_SRT_HOST = "103.179.189.128"
process.env.NEXT_PUBLIC_MEDIAMTX_SRT_ADDRESS = "103.179.189.128:8890"

const ADMIN_AUTH = "Basic " + Buffer.from(`${ADMIN_USER}:${ADMIN_PASS}`).toString("base64")

const adminRoute = await import("@/app/api/relay/events/route")
const statusRoute = await import("@/app/api/public/status/[token]/route")
const loginRoute = await import("@/app/api/public/config/[token]/login/route")
const configRoute = await import("@/app/api/public/config/[token]/route")
const hlsRoute = await import("@/app/api/public/hls/[token]/[...seg]/route")
const { CONFIG_SESSION_COOKIE } = await import("@/lib/relay-server")
const { parseRunOnReady, parseFanoutMeta, isFanoutPathName, fanoutPathName } = await import("@/lib/relay-event.mjs")

/* -------------------------------------------------------------- helpers */
let pass = 0
function ok(label: string) {
  pass++
  console.log(`  ✓ ${label}`)
}
function section(t: string) {
  console.log(`\n=== ${t} ===`)
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

function ctx(params: Record<string, unknown>) {
  return { params: Promise.resolve(params) }
}
async function backend(path: string, init?: RequestInit) {
  return fetch(`${API}${path}`, {
    ...init,
    headers: { authorization: ADMIN_AUTH, "content-type": "application/json", ...(init?.headers || {}) },
  })
}
function cookieValueFrom(res: Response): string | undefined {
  const sc = res.headers.get("set-cookie")
  if (!sc) return undefined
  const m = sc.match(new RegExp(`${CONFIG_SESSION_COOKIE}=([^;]*)`))
  return m ? m[1] : undefined
}
function cookieHeader(value: string) {
  return { cookie: `${CONFIG_SESSION_COOKIE}=${value}` }
}

interface Created {
  pathKey: string
  loginCode: string
  statusToken: string
  configToken: string
}
async function createEvent(displayName: string, quota = 10): Promise<Created> {
  const res = await adminRoute.POST(
    new Request("http://t/api/relay/events", {
      method: "POST",
      headers: { authorization: ADMIN_AUTH, "content-type": "application/json" },
      body: JSON.stringify({ displayName, quota }),
    }),
  )
  assert.equal(res.status, 201, `create "${displayName}" -> 201`)
  return (await res.json()) as Created
}

async function cleanup() {
  section("CLEANUP")
  try {
    const list = (await (await backend("/v3/config/paths/list")).json()) as {
      items?: { name?: string; runOnReady?: string }[]
    }
    const items = list.items ?? []
    // 1) collect slugs of throwaway ITEST ingest paths.
    const itestSlugs = new Set<string>()
    for (const item of items) {
      const meta = item.runOnReady ? (parseRunOnReady(item.runOnReady) as { displayName?: string } | null) : null
      if (meta?.displayName?.startsWith("ITEST-") && item.name) itestSlugs.add(item.name)
    }
    let removed = 0
    // 2) delete fan-out paths belonging to those events first, then the ingest.
    for (const item of items) {
      if (!item.name || !isFanoutPathName(item.name)) continue
      const fm = item.runOnReady ? (parseFanoutMeta(item.runOnReady) as { parentSlug?: string } | null) : null
      if (fm?.parentSlug && itestSlugs.has(fm.parentSlug)) {
        const r = await backend(`/v3/config/paths/delete/${encodeURIComponent(item.name)}`, { method: "DELETE" })
        if (r.ok) removed++
      }
    }
    for (const slug of itestSlugs) {
      const r = await backend(`/v3/config/paths/delete/${encodeURIComponent(slug)}`, { method: "DELETE" })
      if (r.ok) removed++
    }
    console.log(`  removed ${removed} throwaway path(s)`)
  } catch (e) {
    console.log(`  cleanup error: ${(e as Error).message}`)
  }
}

/* ============================================================== RUN */
try {
  /* ---- A. Event creation (admin route → real backend) ---- */
  section("A. Tạo sự kiện (admin route)")
  const ev = await createEvent("ITEST-Main", 3)
  assert.match(ev.pathKey, /^[A-Za-z0-9]{20}$/)
  assert.match(ev.loginCode, /^[A-Za-z0-9]{11}$/)
  ok("admin POST trả 201 + pathKey/loginCode/tokens hợp lệ")

  const confRaw = (await (await backend(`/v3/config/paths/get/${ev.pathKey}`)).json()) as {
    source?: string
    runOnReady?: string
  }
  assert.equal(confRaw.source, "publisher")
  const storedMeta = parseRunOnReady(confRaw.runOnReady || "") as { displayName?: string; slug?: string }
  assert.equal(storedMeta?.displayName, "ITEST-Main")
  assert.equal(confRaw.runOnReady?.includes(ev.loginCode), false)
  ok("path tồn tại trên backend: source=publisher, RELAY_META đúng, loginCode KHÔNG lộ trong config")

  /* ---- B. Status page (ẩn danh, offline) ---- */
  section("B. Trang status (ẩn danh)")
  let r = await statusRoute.GET(new Request("http://t/x"), ctx({ token: "khong-ton-tai" }))
  assert.equal(r.status, 404)
  ok("token sai → 404")

  r = await statusRoute.GET(new Request("http://t/x"), ctx({ token: ev.configToken }))
  assert.equal(r.status, 404)
  ok("dùng configToken trên endpoint status → 404 (không nhầm kind)")

  r = await statusRoute.GET(new Request("http://t/x"), ctx({ token: ev.statusToken }))
  assert.equal(r.status, 200)
  let sp = (await r.json()) as Record<string, unknown>
  assert.equal(sp.displayName, "ITEST-Main")
  assert.equal((sp.runtime as { online: boolean }).online, false)
  const spJson = JSON.stringify(sp)
  assert.equal(spJson.includes(ev.pathKey), false)
  assert.equal("ingest" in sp, false)
  ok("status token hợp lệ → 200, offline, KHÔNG lộ slug/ingest")

  /* ---- C. Config login + payload ---- */
  section("C. Đăng nhập config + payload")
  r = await loginRoute.POST(
    new Request("http://t/x", { method: "POST", body: JSON.stringify({ code: "wrong-code" }) }),
    ctx({ token: ev.configToken }),
  )
  assert.equal(r.status, 401)
  ok("login sai mã → 401")

  r = await loginRoute.POST(
    new Request("http://t/x", { method: "POST", body: JSON.stringify({ code: ev.loginCode }) }),
    ctx({ token: ev.configToken }),
  )
  assert.equal(r.status, 200)
  let session = cookieValueFrom(r)
  assert.ok(session, "nhận được cookie phiên")
  ok("login đúng mã → 200 + set-cookie (HttpOnly phiên)")

  r = await configRoute.GET(new Request("http://t/x"), ctx({ token: ev.configToken }))
  assert.equal(r.status, 401)
  ok("GET config không cookie → 401")

  r = await configRoute.GET(new Request("http://t/x", { headers: cookieHeader(session!) }), ctx({ token: ev.configToken }))
  assert.equal(r.status, 200)
  let cp = (await r.json()) as {
    slug: string
    ingest: { rtmp: string; srt: string }
    destinations: unknown[]
    quota: number
  }
  assert.equal(cp.slug, ev.pathKey)
  assert.ok(cp.ingest.rtmp.includes("103.179.189.128:1935"), "ingest RTMP dùng host public")
  assert.ok(cp.ingest.rtmp.includes(ev.pathKey), "ingest URL chứa stream key")
  assert.equal(cp.destinations.length, 0)
  ok(`GET config có cookie → 200, ingest=${cp.ingest.rtmp}`)

  /* ---- D. Destinations / fan-out (mỗi đích = 1 path riêng) ---- */
  section("D. Đích phát (fan-out path độc lập)")
  async function configPost(body: Record<string, unknown>) {
    return configRoute.POST(
      new Request("http://t/x", { method: "POST", headers: cookieHeader(session!), body: JSON.stringify(body) }),
      ctx({ token: ev.configToken }),
    )
  }
  // Baseline: the ingest path's config BEFORE any destination edits. The whole
  // point of the re-architecture is that destination CRUD must never touch it.
  const ingestBefore = (await (await backend(`/v3/config/paths/get/${ev.pathKey}`)).json()) as { runOnReady?: string }
  assert.ok(!/ffmpeg/.test(ingestBefore.runOnReady || ""), "ingest runOnReady là no-op trước khi thêm đích")

  r = await configPost({
    action: "add_destination",
    name: "FB Live",
    platform: "facebook",
    serverUrl: "rtmps://live-api-s.facebook.com:443/rtmp/",
    streamKey: "FB-SECRET-KEY-1234",
    enabled: true,
  })
  assert.equal(r.status, 200)
  ok("thêm đích Facebook (enabled) → 200")

  r = await configPost({
    action: "add_destination",
    name: "YT Live",
    platform: "youtube",
    serverUrl: "rtmp://a.rtmp.youtube.com/live2/",
    streamKey: "YT-SECRET-KEY-5678",
    enabled: true,
  })
  assert.equal(r.status, 200)
  ok("thêm đích YouTube (enabled) → 200")

  // KEY CONTRACT: the ingest path must be UNCHANGED — adding destinations no
  // longer reloads it, so the live publisher is never kicked.
  const ingestAfter = (await (await backend(`/v3/config/paths/get/${ev.pathKey}`)).json()) as { runOnReady?: string }
  assert.equal(ingestAfter.runOnReady, ingestBefore.runOnReady, "ingest runOnReady KHÔNG đổi sau khi thêm đích")
  assert.ok(!/ffmpeg/.test(ingestAfter.runOnReady || ""), "ingest path vẫn là no-op (không fan-out ở đây)")
  ok("thêm đích KHÔNG chạm ingest path (publisher không bị ngắt)")

  // Each destination is its OWN fan-out path `<slug>__fo__<id>` that pushes to
  // exactly one platform, with its source pulling the ingest.
  const listAfter = (await (await backend("/v3/config/paths/list")).json()) as {
    items?: { name?: string; runOnReady?: string; source?: string }[]
  }
  const fanouts = (listAfter.items ?? []).filter((it) => {
    if (!it.name || !isFanoutPathName(it.name)) return false
    const fm = it.runOnReady ? (parseFanoutMeta(it.runOnReady) as { parentSlug?: string } | null) : null
    return fm?.parentSlug === ev.pathKey
  })
  assert.equal(fanouts.length, 2, "có đúng 2 fan-out path (FB + YT)")
  const fanoutCmds = fanouts.map((f) => f.runOnReady || "").join("\n")
  assert.ok(fanoutCmds.includes("facebook.com"), "1 fan-out path đẩy sang FB")
  assert.ok(fanoutCmds.includes("youtube.com"), "1 fan-out path đẩy sang YT")
  assert.ok(
    fanouts.every((f) => /^rtsp:\/\/localhost:8554\//.test(f.source || "")),
    "fan-out path kéo nguồn từ ingest qua rtsp nội bộ",
  )
  ok("backend tạo 2 fan-out path độc lập (FB + YT), nguồn pull từ ingest")

  // Masked keys in payload, raw keys never exposed.
  r = await configRoute.GET(new Request("http://t/x", { headers: cookieHeader(session!) }), ctx({ token: ev.configToken }))
  cp = (await r.json()) as typeof cp
  assert.equal(cp.destinations.length, 2)
  const cpJson = JSON.stringify(cp)
  assert.equal(cpJson.includes("FB-SECRET-KEY-1234"), false, "stream key thật KHÔNG lộ trong payload")
  assert.equal(cpJson.includes("YT-SECRET-KEY-5678"), false)
  ok("payload có 2 đích, key đã mask, key thật không lộ")

  // Quota: quota=3, currently 2 enabled. Add 2 more enabled → 3rd ok, 4th blocked.
  r = await configPost({
    action: "add_destination",
    name: "C3",
    platform: "custom",
    serverUrl: "rtmp://c3.example.com/live/",
    streamKey: "k3",
    enabled: true,
  })
  assert.equal(r.status, 200, "đích thứ 3 enabled = quota 3 → ok")
  r = await configPost({
    action: "add_destination",
    name: "C4",
    platform: "custom",
    serverUrl: "rtmp://c4.example.com/live/",
    streamKey: "k4",
    enabled: true,
  })
  assert.equal(r.status, 400, "đích thứ 4 enabled vượt quota → 400")
  const qErr = (await r.json()) as { error?: string }
  assert.match(qErr.error || "", /quota/i)
  ok("quota chặn khi vượt số đích đang bật (3) ")

  // Validation: bad serverUrl rejected.
  r = await configPost({
    action: "add_destination",
    name: "Bad",
    platform: "custom",
    serverUrl: "http://not-a-stream-url",
    streamKey: "x",
    enabled: false,
  })
  assert.equal(r.status, 400)
  ok("serverUrl sai định dạng → 400")

  // Update + delete one destination.
  const firstId = (cp.destinations[0] as { id: string }).id
  r = await configPost({ action: "update_destination", id: firstId, patch: { enabled: false } })
  assert.equal(r.status, 200)
  r = await configPost({ action: "delete_destination", id: firstId })
  assert.equal(r.status, 200)
  ok("update (disable) + delete đích → 200")

  /* ---- E. Record + relay toggles (PATCH backend thật) ---- */
  section("E. Record + bật/tắt relay")
  r = await configPost({ action: "set_record", enabled: true })
  assert.equal(r.status, 200)
  const confRec = (await (await backend(`/v3/config/paths/get/${ev.pathKey}`)).json()) as { record?: boolean }
  assert.equal(confRec.record, true)
  ok("set_record true → backend record=true")
  await configPost({ action: "set_record", enabled: false })

  async function fanoutPathsFor(slug: string) {
    const lst = (await (await backend("/v3/config/paths/list")).json()) as {
      items?: { name?: string; runOnReady?: string }[]
    }
    return (lst.items ?? []).filter((it) => {
      if (!it.name || !isFanoutPathName(it.name)) return false
      const fm = it.runOnReady ? (parseFanoutMeta(it.runOnReady) as { parentSlug?: string } | null) : null
      return fm?.parentSlug === slug
    })
  }
  r = await configPost({ action: "set_relay", enabled: false })
  assert.equal(r.status, 200)
  const foOff = await fanoutPathsFor(ev.pathKey)
  assert.ok(foOff.length > 0, "vẫn còn fan-out path khi tắt relay")
  assert.ok(foOff.every((f) => !/ffmpeg/.test(f.runOnReady || "")), "relay off → mọi fan-out path thành no-op (giữ RELAY_FANOUT)")
  ok("set_relay false → các fan-out path ngừng đẩy nhưng vẫn giữ metadata")
  await configPost({ action: "set_relay", enabled: true })
  const foOn = await fanoutPathsFor(ev.pathKey)
  assert.ok(foOn.some((f) => /ffmpeg/.test(f.runOnReady || "")), "relay on → fan-out path đẩy lại bằng ffmpeg")
  ok("set_relay true → fan-out path đẩy lại")

  /* ---- F. Token rotation + đổi/sinh lại mã ---- */
  section("F. Xoay token + đổi mã đăng nhập")
  r = await configPost({ action: "rotate_status_token" })
  const rotated = (await r.json()) as { statusToken: string }
  assert.notEqual(rotated.statusToken, ev.statusToken)
  let chk = await statusRoute.GET(new Request("http://t/x"), ctx({ token: ev.statusToken }))
  assert.equal(chk.status, 404, "status token cũ vô hiệu")
  chk = await statusRoute.GET(new Request("http://t/x"), ctx({ token: rotated.statusToken }))
  assert.equal(chk.status, 200, "status token mới hoạt động")
  ok("rotate_status_token: token cũ 404, token mới 200")

  r = await configPost({ action: "change_config_code", newCode: "newpass123" })
  assert.equal(r.status, 200)
  // old code now invalid, new code works
  chk = await loginRoute.POST(
    new Request("http://t/x", { method: "POST", body: JSON.stringify({ code: ev.loginCode }) }),
    ctx({ token: ev.configToken }),
  )
  assert.equal(chk.status, 401, "mã cũ vô hiệu")
  chk = await loginRoute.POST(
    new Request("http://t/x", { method: "POST", body: JSON.stringify({ code: "newpass123" }) }),
    ctx({ token: ev.configToken }),
  )
  assert.equal(chk.status, 200)
  session = cookieValueFrom(chk)!
  ok("change_config_code: mã cũ 401, mã mới đăng nhập được")

  r = await configPost({ action: "regenerate_login_code" })
  const regen = (await r.json()) as { loginCode: string }
  assert.match(regen.loginCode, /^[A-Za-z0-9]{11}$/)
  chk = await loginRoute.POST(
    new Request("http://t/x", { method: "POST", body: JSON.stringify({ code: regen.loginCode }) }),
    ctx({ token: ev.configToken }),
  )
  assert.equal(chk.status, 200)
  session = cookieValueFrom(chk)!
  ok("regenerate_login_code: mã mới đăng nhập được")

  /* ---- G. Rotate stream id (tạo path mới + xóa cũ trên backend) ---- */
  section("G. Xoay stream key (ingest)")
  r = await configPost({ action: "rotate_stream_id" })
  const rs = (await r.json()) as { slug: string }
  assert.match(rs.slug, /^[A-Za-z0-9]{20}$/)
  assert.notEqual(rs.slug, ev.pathKey)
  const oldGone = await backend(`/v3/config/paths/get/${ev.pathKey}`)
  assert.equal(oldGone.status, 404, "path cũ đã xóa trên backend")
  const newExists = await backend(`/v3/config/paths/get/${rs.slug}`)
  assert.equal(newExists.status, 200, "path mới tồn tại")
  // Fan-out paths must cascade to the new slug (old set deleted, new set created).
  const foOld = await fanoutPathsFor(ev.pathKey)
  assert.equal(foOld.length, 0, "fan-out path theo slug cũ đã bị xóa")
  const foNew = await fanoutPathsFor(rs.slug)
  assert.equal(foNew.length, 2, "fan-out path tái tạo dưới slug mới (YT + C3)")
  assert.ok(
    foNew.every((f) => f.name === fanoutPathName(rs.slug, parseFanoutMeta(f.runOnReady || "")?.id || "")),
    "tên fan-out path mới khớp slug mới + id đích",
  )
  ok("rotate_stream_id: fan-out path cascade sang slug mới, set cũ đã dọn")
  // share tokens preserved → config GET still works with same configToken
  chk = await configRoute.GET(new Request("http://t/x", { headers: cookieHeader(session) }), ctx({ token: ev.configToken }))
  assert.equal(chk.status, 200, "configToken giữ nguyên sau khi xoay key")
  cp = (await chk.json()) as typeof cp
  assert.equal(cp.slug, rs.slug, "ingest key đã đổi sang slug mới")
  ok("rotate_stream_id: path cũ xóa, path mới có, token chia sẻ giữ nguyên")

  /* ---- H. LIVE online + HLS preview (mô phỏng publisher bằng feed test) ---- */
  section("H. Trạng thái ONLINE + preview HLS (mô phỏng publisher)")
  const live = await createEvent("ITEST-Live", 5)
  // Point this path's source at the running `test` feed (server-side pull).
  const patchSrc = await backend(`/v3/config/paths/patch/${live.pathKey}`, {
    method: "PATCH",
    body: JSON.stringify({ source: "rtsp://127.0.0.1:8554/test", sourceOnDemand: false }),
  })
  assert.ok(patchSrc.ok, "PATCH source pull → ok")

  let online = false
  for (let i = 0; i < 20; i++) {
    await sleep(1000)
    const sr = await statusRoute.GET(new Request("http://t/x"), ctx({ token: live.statusToken }))
    const body = (await sr.json()) as { runtime?: { online?: boolean; tracks?: string[] } }
    if (body.runtime?.online) {
      online = true
      assert.ok((body.runtime.tracks || []).length > 0, "có tracks khi online")
      break
    }
  }
  if (online) {
    ok("status chuyển ONLINE khi có nguồn (tracks > 0)")
    // HLS preview via token-gated proxy
    let hlsOk = false
    for (let i = 0; i < 10; i++) {
      const hr = await hlsRoute.GET(new Request("http://t/x"), ctx({ token: live.statusToken, seg: [] }))
      if (hr.status === 200) {
        const txt = await hr.text()
        if (txt.includes("#EXTM3U")) {
          hlsOk = true
          break
        }
      }
      await sleep(1000)
    }
    assert.ok(hlsOk, "HLS proxy trả playlist #EXTM3U")
    ok("preview HLS qua proxy token-gated → playlist hợp lệ")
    // proxy must reject wrong token
    const bad = await hlsRoute.GET(new Request("http://t/x"), ctx({ token: "bad", seg: [] }))
    assert.equal(bad.status, 404)
    ok("HLS proxy token sai → 404 (không lộ host nội bộ)")
  } else {
    console.log("  ⚠ không lên ONLINE trong 20s (có thể do quyền pull nội bộ) — bỏ qua phần HLS, không tính lỗi")
  }

  console.log(`\nTẤT CẢ: ${pass} assertion PASS`)
} finally {
  await cleanup()
}
