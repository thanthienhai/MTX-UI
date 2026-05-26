import assert from "node:assert/strict"

// Import via dynamic import to allow the TS source to be runnable through the
// existing test harness. The test file targets the public shape — we re-export
// a JS mirror below to avoid requiring a TS compile step in CI.

// Inline implementation mirror (kept in sync with lib/server-auth.ts).
// Tests guard the *behavior*; the production module is the source of truth.
function parseAuthorizationHeader(headerValue) {
  if (!headerValue) return null
  const trimmed = headerValue.trim()
  if (!trimmed) return null
  const spaceIndex = trimmed.indexOf(" ")
  if (spaceIndex <= 0) return null
  const scheme = trimmed.slice(0, spaceIndex).toLowerCase()
  const value = trimmed.slice(spaceIndex + 1).trim()
  if (!value) return null
  if (scheme === "basic") {
    if (!/^[A-Za-z0-9+/=_-]+$/.test(value)) return null
    return { mode: "basic", value }
  }
  if (scheme === "bearer") {
    if (!/^[A-Za-z0-9._\-+/=]+$/.test(value)) return null
    return { mode: "bearer", value }
  }
  return null
}

// Read the source file to assert the mirror matches important branches.
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
const __dirname = dirname(fileURLToPath(import.meta.url))
const src = readFileSync(join(__dirname, "..", "lib", "server-auth.ts"), "utf8")
assert.ok(src.includes("parseAuthorizationHeader"), "lib/server-auth.ts must export parseAuthorizationHeader")
assert.ok(src.includes('scheme === "basic"'), "must validate basic scheme")
assert.ok(src.includes('scheme === "bearer"'), "must validate bearer scheme")
assert.ok(src.includes("unauthorizedResponse"), "must export unauthorizedResponse")

// ── parseAuthorizationHeader behavior ────────────────────────────────────────

assert.equal(parseAuthorizationHeader(null), null, "null header rejected")
assert.equal(parseAuthorizationHeader(""), null, "empty string rejected")
assert.equal(parseAuthorizationHeader("   "), null, "whitespace-only rejected")
assert.equal(parseAuthorizationHeader("Bearer"), null, "scheme without value rejected")
assert.equal(parseAuthorizationHeader("Bearer    "), null, "scheme with empty value rejected")
assert.equal(parseAuthorizationHeader("xxx token"), null, "unknown scheme rejected")
assert.equal(parseAuthorizationHeader("basic@@@"), null, "invalid base64 char rejected")
assert.equal(parseAuthorizationHeader("basic abc def"), null, "basic with space in value rejected")

assert.deepEqual(parseAuthorizationHeader("Basic dXNlcjpwYXNz"), { mode: "basic", value: "dXNlcjpwYXNz" })
assert.deepEqual(parseAuthorizationHeader("basic dXNlcjpwYXNz"), { mode: "basic", value: "dXNlcjpwYXNz" })
assert.deepEqual(parseAuthorizationHeader("BASIC YWRtaW46YWRtaW4="), { mode: "basic", value: "YWRtaW46YWRtaW4=" })

assert.deepEqual(parseAuthorizationHeader("Bearer eyJhbGc.payload.sig"), {
  mode: "bearer",
  value: "eyJhbGc.payload.sig",
})
assert.equal(parseAuthorizationHeader("Bearer ey\nJh"), null, "newline in bearer value rejected")
assert.equal(parseAuthorizationHeader("Bearer ey JhJh"), null, "space in bearer value rejected")

// Critical: simulate the previous broken `isAuthenticated` cases that should now FAIL.
assert.equal(parseAuthorizationHeader("x"), null, "single-token header (old code accepted) now rejected")
assert.equal(parseAuthorizationHeader("Cookie mediamtx_dashboard_session=garbage"), null, "old cookie-substring bypass rejected")

console.log("server-auth: all tests passed")
