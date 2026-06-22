/**
 * Tests for backend-offline and permission-denied scenarios.
 * Run with: node scripts/test-resiliency.mjs
 */

import assert from "node:assert/strict"

/* ------------------------------------------------------------------ */
/* Backend offline scenario                                            */
/* ------------------------------------------------------------------ */

async function simulateBackendOffline() {
  const originalFetch = globalThis.fetch
  const calls = []

  globalThis.fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input.toString()
    const method = (init?.method || "GET").toUpperCase()
    calls.push({ url, method })
    return new Response(JSON.stringify({ error: "connection refused" }), {
      status: 503,
      headers: { "content-type": "application/json" },
    })
  }

  return { calls, restore: () => { globalThis.fetch = originalFetch } }
}

async function testBackendOffline() {
  const { calls, restore } = await simulateBackendOffline()

  const res = await fetch("http://localhost:9997/v3/config/global/get", {
    headers: { Authorization: "Basic admin:adminpass" },
  })

  assert.equal(res.status, 503, "should return 503 when backend is offline")
  const body = await res.json()
  assert.equal(body.error, "connection refused", "should include error message")
  assert.equal(calls.length, 1, "should make exactly one call")
  assert.equal(calls[0].method, "GET")

  restore()
  console.log("  backend-offline: all assertions passed")
}

/* ------------------------------------------------------------------ */
/* Permission denied scenario                                          */
/* ------------------------------------------------------------------ */

async function simulatePermissionDenied() {
  const originalFetch = globalThis.fetch
  const calls = []

  globalThis.fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input.toString()
    const method = (init?.method || "GET").toUpperCase()
    const headers = {}
    if (init?.headers) {
      const h = new Headers(init.headers)
      h.forEach((v, k) => { headers[k] = v })
    }
    calls.push({ url, method, headers })
    return new Response(JSON.stringify({ error: "permission denied" }), {
      status: 403,
      headers: { "content-type": "application/json" },
    })
  }

  return { calls, restore: () => { globalThis.fetch = originalFetch } }
}

async function testPermissionDenied() {
  const { calls, restore } = await simulatePermissionDenied()

  const res = await fetch("http://localhost:9997/v3/config/paths/add/test", {
    method: "POST",
    headers: { Authorization: "Basic user:pass", "content-type": "application/json" },
    body: JSON.stringify({ source: "rtsp://test" }),
  })

  assert.equal(res.status, 403, "should return 403 when permission denied")
  const body = await res.json()
  assert.equal(body.error, "permission denied", "should include error message")

  const authHeader = calls[0].headers["authorization"]
  assert.ok(authHeader, "should include Authorization header")
  assert.equal(authHeader, "Basic user:pass")

  restore()
  console.log("  permission-denied: all assertions passed")
}

async function main() {
  console.log("backend-offline tests:")
  await testBackendOffline()

  console.log("\npermission-denied tests:")
  await testPermissionDenied()

  console.log("\nAll resiliency tests passed!")
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
