/**
 * Pinpoint which ffmpeg capability the standby slate needs but this MediaMTX
 * build may lack. Each probe pulls the server `test` feed (→ runOnReady fires)
 * and tees to a loopback RTMP path we observe via the API.
 *
 *   copy   : -i test -c copy -f tee flv          (positive control = fan-out path)
 *   x264   : -i test -c:v libx264 -c:a aac -tee  (tests the H.264 ENCODER)
 *   lavfi  : -f lavfi color+anullsrc -libx264    (tests lavfi sources)
 *   draw   : lavfi + drawtext + libx264          (tests the drawtext FONT)
 *
 * Run: node --import ./scripts/test-register.mjs scripts/integration-fallback-diag.ts
 */
const API = "http://103.179.189.128:9997"
const ADMIN_AUTH = "Basic " + Buffer.from("admin:adminpass").toString("base64")
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const backend = (path: string, init?: RequestInit) =>
  fetch(`${API}${path}`, { ...init, headers: { authorization: ADMIN_AUTH, "content-type": "application/json", ...(init?.headers || {}) } })

const TEST_SRC = "rtsp://127.0.0.1:8554/test"
const shellQuote = (v: string) => `'${v.replace(/'/g, `'\\''`)}'`
const shInit = (ff: string) => `sh -c ${shellQuote(ff)}`
const tee = (loop: string) => `-f tee '[f=flv:onfail=ignore]rtmp://127.0.0.1:1935/${loop}'`
const H = "ffmpeg -nostdin -hide_banner -loglevel warning"
const X264 = "-c:v libx264 -preset veryfast -pix_fmt yuv420p"
const AAC = "-c:a aac -b:a 128k -ar 44100 -ac 2"

function cmd(kind: string, loop: string): string {
  if (kind === "copy") return shInit(`${H} -timeout 5000000 -i ${TEST_SRC} -c copy -map 0 ${tee(loop)}`)
  if (kind === "x264") return shInit(`${H} -timeout 5000000 -i ${TEST_SRC} ${X264} ${AAC} ${tee(loop)}`)
  if (kind === "lavfi")
    return shInit(`${H} -re -f lavfi -i color=c=black:s=1280x720:r=30 -f lavfi -i anullsrc=r=44100:cl=stereo -map 0:v -map 1:a ${X264} ${AAC} ${tee(loop)}`)
  // draw
  return shInit(
    `${H} -re -f lavfi -i color=c=black:s=1280x720:r=30 -f lavfi -i anullsrc=r=44100:cl=stereo ` +
      `-filter_complex '[0:v]drawtext=fontcolor=white:fontsize=44:x=(w-text_w)/2:y=(h-text_h)/2:text=ITEST[v]' -map '[v]' -map 1:a ${X264} ${AAC} ${tee(loop)}`,
  )
}

const KINDS = ["copy", "x264", "lavfi", "draw"] as const
const rand = Math.random().toString(36).slice(2, 7)
const probes = KINDS.map((k) => ({ kind: k, path: `itest_dg_${k}_${rand}`, loop: `itest_dl_${k}_${rand}` }))

async function cleanup() {
  const list = (await (await backend("/v3/config/paths/list")).json()) as { items?: { name?: string }[] }
  for (const it of list.items ?? []) if (it.name?.startsWith("itest_")) await backend(`/v3/config/paths/delete/${encodeURIComponent(it.name)}`, { method: "DELETE" })
}

try {
  await cleanup()
  for (const p of probes)
    await backend(`/v3/config/paths/add/${encodeURIComponent(p.path)}`, {
      method: "POST",
      body: JSON.stringify({ source: TEST_SRC, sourceOnDemand: false, runOnReady: cmd(p.kind, p.loop), runOnReadyRestart: false }),
    })
  console.log("diagnostics launched; polling up to 40s …")
  const out: Record<string, boolean> = {}
  const deadline = Date.now() + 40000
  while (Date.now() < deadline && Object.keys(out).length < probes.length) {
    await sleep(2000)
    for (const p of probes) {
      if (out[p.kind] !== undefined) continue
      const r = await backend(`/v3/paths/get/${encodeURIComponent(p.loop)}`)
      if (r.status === 200 && ((await r.json()) as { ready?: boolean }).ready) {
        out[p.kind] = true
        console.log(`  ✓ ${p.kind} → LOOP ready`)
      }
    }
  }
  console.log("\nRESULT:")
  for (const p of probes) console.log(`  ${p.kind.padEnd(6)} : ${out[p.kind] ? "PASS ✅" : "FAIL ❌"}`)
  console.log("\nINTERPRET:")
  console.log("  copy PASS + x264 FAIL  → ffmpeg is COPY-ONLY (no H.264 encoder) → standby slate cannot run.")
  console.log("                           Fix: deploy MediaMTX with a FULL ffmpeg (libx264 + aac).")
  console.log("  x264 PASS + lavfi FAIL → lavfi sources missing")
  console.log("  lavfi PASS + draw FAIL → drawtext font missing (needs -fontfile)")
  console.log("  ALL PASS               → this image can run the image/video/text fallback slate.")
} finally {
  await cleanup()
  console.log("cleaned up")
}
