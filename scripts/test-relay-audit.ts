/**
 * Tests for lib/relay-audit.ts — the in-memory audit ring buffer that backs
 * the public config page's "Lịch sử hành động" card.
 */

import assert from "node:assert/strict"
import { recordAudit, getAuditFor, _clearAudit } from "@/lib/relay-audit"

/* clean slate -------------------------------------------------------- */
_clearAudit()

/* empty buffer ------------------------------------------------------- */
assert.deepEqual(getAuditFor("missing"), [], "missing slug → empty list")

/* basic push + ordering ---------------------------------------------- */
recordAudit("evt-a", "destination.add", { platform: "facebook" })
recordAudit("evt-a", "destination.update", { id: "d1" })
recordAudit("evt-a", "relay.set", { enabled: true })

const entries = getAuditFor("evt-a")
assert.equal(entries.length, 3, "all entries returned within limit")
assert.equal(entries[0].action, "relay.set", "newest first")
assert.equal(entries[2].action, "destination.add", "oldest last")
assert.match(entries[0].ts, /^\d{4}-\d{2}-\d{2}T/, "ISO timestamp")
assert.deepEqual(entries[0].detail, { enabled: true }, "detail passed through")

/* scope is per slug --------------------------------------------------- */
recordAudit("evt-b", "record.set", { enabled: true })
assert.equal(getAuditFor("evt-a").length, 3, "evt-a unaffected by evt-b push")
assert.equal(getAuditFor("evt-b").length, 1, "evt-b has its own list")
assert.notEqual(getAuditFor("evt-a")[0].action, "record.set", "no cross-slug bleed")

/* guards: empty slug / action are no-ops ------------------------------ */
recordAudit("", "noop")
recordAudit("evt-a", "")
assert.equal(getAuditFor("evt-a").length, 3, "empty action ignored")

/* ring buffer caps at MAX (50) — older entries drop out --------------- */
_clearAudit()
for (let i = 0; i < 60; i++) {
  recordAudit("ring", "tick", { i })
}
const ring = getAuditFor("ring", 100)
assert.equal(ring.length, 50, "buffer capped to MAX (50)")
assert.equal(ring[0].detail?.i, 59, "newest survives")
assert.equal(ring[49].detail?.i, 10, "first 10 evicted")

/* limit parameter clips response without affecting storage ------------ */
assert.equal(getAuditFor("ring", 5).length, 5, "limit clips response")
assert.equal(getAuditFor("ring", 5)[0].detail?.i, 59, "still newest first")
assert.equal(getAuditFor("ring").length, 20, "default limit is 20")

/* recordAudit never throws on detail-less call ------------------------ */
assert.doesNotThrow(() => recordAudit("evt-c", "login_code.regenerate"))
const c = getAuditFor("evt-c")
assert.equal(c.length, 1)
assert.equal(c[0].detail, undefined, "detail can be omitted")

console.log("test-relay-audit.ts: all assertions passed")
