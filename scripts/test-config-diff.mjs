import assert from "node:assert/strict"
import { deepEqual, diffObjects, diffPathsBundle, buildApplyPlan } from "../lib/config-diff.mjs"

// ── deepEqual primitives ───────────────────────────────────────────────────
assert.equal(deepEqual(1, 1), true)
assert.equal(deepEqual("a", "a"), true)
assert.equal(deepEqual(null, null), true)
assert.equal(deepEqual(undefined, undefined), true)
assert.equal(deepEqual(null, undefined), false)
assert.equal(deepEqual(0, false), false)
assert.equal(deepEqual("1", 1), false)

// ── deepEqual arrays order matters ─────────────────────────────────────────
assert.equal(deepEqual([1, 2, 3], [1, 2, 3]), true)
assert.equal(deepEqual([1, 2, 3], [1, 3, 2]), false)
assert.equal(deepEqual([1, 2], [1, 2, 3]), false)

// ── deepEqual objects insensitive to key order ─────────────────────────────
assert.equal(deepEqual({ a: 1, b: 2 }, { b: 2, a: 1 }), true)
assert.equal(deepEqual({ a: 1, b: 2 }, { a: 1, b: 3 }), false)
assert.equal(deepEqual({ a: 1 }, { a: 1, b: 2 }), false, "extra key in b breaks equality")

// ── deepEqual nested ───────────────────────────────────────────────────────
assert.equal(deepEqual({ a: { b: [1, 2] } }, { a: { b: [1, 2] } }), true)
assert.equal(deepEqual({ a: { b: [1, 2] } }, { a: { b: [1, 3] } }), false)

// ── diffObjects: only different keys included ───────────────────────────────
{
  const a = { name: "cam1", source: "rtsp://...", record: false }
  const b = { name: "cam1", source: "rtsp://...", record: true, extra: 1 }
  const entries = diffObjects(a, b, "path", "cam1")
  const fields = entries.map((e) => e.field).sort()
  assert.deepEqual(fields, ["extra", "record"])
  for (const e of entries) {
    assert.equal(e.scope, "path")
    assert.equal(e.pathName, "cam1")
  }
}

// ── diffObjects: undefined-vs-missing treated as equal ──────────────────────
{
  // {a:1} vs {a:1, b:undefined} — b is "missing in a", undefined in b → entry
  // included because key b appears in incoming
  const entries = diffObjects({ a: 1 }, { a: 1, b: undefined }, "global")
  // Whether b is treated equal depends on deepEqual(undefined, undefined) = true
  // Since current?.[b] === undefined === incoming.b, the diff should be empty
  assert.equal(entries.length, 0)
}

// ── diffPathsBundle: new path tagged newPath:true ───────────────────────────
{
  const incoming = [
    { name: "existing", source: "rtsp://changed" },
    { name: "fresh", source: "publisher" },
  ]
  const current = [{ name: "existing", source: "rtsp://old" }]
  const entries = diffPathsBundle(incoming, current)
  const existingEntries = entries.filter((e) => e.pathName === "existing")
  const freshEntries = entries.filter((e) => e.pathName === "fresh")
  assert.ok(existingEntries.length > 0)
  assert.equal(existingEntries[0].newPath, undefined, "existing path is not new")
  assert.ok(freshEntries.length > 0)
  for (const e of freshEntries) assert.equal(e.newPath, true, "new path must be tagged")
}

// ── buildApplyPlan: new-path entries bypass selection ──────────────────────
{
  const entries = [
    { scope: "global", field: "logLevel", current: "info", incoming: "debug" },
    { scope: "path", pathName: "fresh", field: "source", current: undefined, incoming: "publisher", newPath: true },
    { scope: "path", pathName: "fresh", field: "record", current: undefined, incoming: true, newPath: true },
    { scope: "path", pathName: "existing", field: "record", current: false, incoming: true },
  ]
  const key = (d) => `${d.scope}::${d.pathName ?? ""}::${d.field}`
  const selected = new Set([key(entries[0])]) // only globalPatch selected
  const plan = buildApplyPlan(entries, selected, key)

  assert.deepEqual(plan.globalPatch, { logLevel: "debug" })
  assert.deepEqual(plan.defaultsPatch, {})
  assert.equal(plan.newPaths.has("fresh"), true)
  assert.equal(plan.pathPatches.has("fresh"), true, "new path always applied regardless of selection")
  assert.equal(plan.pathPatches.has("existing"), false, "deselected existing path field not applied")
}

// ── buildApplyPlan: existing path with mixed selection ──────────────────────
{
  const entries = [
    { scope: "path", pathName: "cam1", field: "record", current: false, incoming: true },
    { scope: "path", pathName: "cam1", field: "source", current: "rtsp://a", incoming: "rtsp://b" },
  ]
  const key = (d) => `${d.scope}::${d.pathName ?? ""}::${d.field}`
  const selected = new Set([key(entries[0])])
  const plan = buildApplyPlan(entries, selected, key)
  assert.deepEqual(plan.pathPatches.get("cam1"), { record: true }, "only selected field is in patch")
  assert.equal(plan.newPaths.has("cam1"), false)
}

console.log("config-diff: all tests passed")
