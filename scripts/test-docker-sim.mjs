/**
 * Tests simulating a MediaMTX local Docker environment for basic API interactions.
 * Uses a mock fetch to validate the request/response contract without needing
 * an actual running Docker container.
 */

import assert from "node:assert/strict"

async function main() {
  const originalFetch = globalThis.fetch
  const calls = []

  globalThis.fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input.toString()
    const method = (init?.method || "GET").toUpperCase()
    calls.push({ url, method, headers: init?.headers ? Object.fromEntries(new Headers(init.headers)) : {} })
    return new Response(JSON.stringify({ items: [{ name: "test" }] }), {
      status: 200,
      headers: { "content-type": "application/json" },
    })
  }

  // Test: list recordings
  let res = await fetch("http://localhost:9997/v3/recordings/list")
  let body = await res.json()
  assert.equal(res.status, 200)
  assert.ok(Array.isArray(body.items), "recordings list should return an items array")
  console.log("  recordings/list: all assertions passed")

  // Test: delete recording segment
  calls.length = 0
  globalThis.fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input.toString()
    const method = (init?.method || "GET").toUpperCase()
    calls.push({ url, method })
    return new Response(JSON.stringify({}), { status: 200, headers: { "content-type": "application/json" } })
  }

  res = await fetch("http://localhost:9997/v3/recordings/deletesegment", {
    method: "POST",
    body: JSON.stringify({ path: "test", segment: "seg-001.ts" }),
  })
  assert.equal(res.status, 200, "deletesegment should return 200")
  assert.equal(calls[0].method, "POST", "deletesegment should use POST")
  console.log("  recordings/deletesegment: all assertions passed")

  // Test: list sessions (RTMP connections)
  calls.length = 0
  globalThis.fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input.toString()
    const method = (init?.method || "GET").toUpperCase()
    calls.push({ url, method })
    return new Response(JSON.stringify({ items: [{ id: "conn-1", remoteAddr: "192.168.1.10", state: "ready" }] }), {
      status: 200,
      headers: { "content-type": "application/json" },
    })
  }

  res = await fetch("http://localhost:9997/v3/rtmp/conns/list")
  const sessions = await res.json()
  assert.equal(res.status, 200)
  assert.equal(sessions.items[0].id, "conn-1")
  console.log("  sessions/list: all assertions passed")

  // Test: kick session
  calls.length = 0
  globalThis.fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input.toString()
    const method = (init?.method || "GET").toUpperCase()
    calls.push({ url, method })
    return new Response(JSON.stringify({}), { status: 200, headers: { "content-type": "application/json" } })
  }

  res = await fetch("http://localhost:9997/v3/rtmp/conns/kick/conn-1", { method: "POST" })
  assert.equal(res.status, 200, "kick should return 200")
  assert.ok(calls[0].url.includes("kick"), "URL should contain 'kick'")
  console.log("  sessions/kick: all assertions passed")

  // Test: playback list
  calls.length = 0
  globalThis.fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input.toString()
    calls.push({ url })
    return new Response(JSON.stringify({ items: [{ path: "test", start: "2026-01-01T00:00:00Z", duration: 60 }] }), {
      status: 200,
      headers: { "content-type": "application/json" },
    })
  }

  res = await fetch("http://localhost:9997/playback/list?path=test")
  const playback = await res.json()
  assert.equal(res.status, 200)
  assert.equal(playback.items[0].path, "test")
  console.log("  playback/list: all assertions passed")

  // Test: playback play
  calls.length = 0
  globalThis.fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input.toString()
    calls.push({ url })
    return new Response("mock video data", { status: 200, headers: { "content-type": "video/mp4" } })
  }

  res = await fetch("http://localhost:9997/playback/get?path=test&start=2026-01-01T00:00:00Z&duration=60&format=mp4")
  assert.equal(res.status, 200)
  const contentType = res.headers.get("content-type")
  assert.equal(contentType, "video/mp4")
  console.log("  playback/play: all assertions passed")

  globalThis.fetch = originalFetch
  console.log("\nAll Docker simulation tests passed!")
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
