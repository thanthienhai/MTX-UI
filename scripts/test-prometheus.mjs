import assert from "node:assert/strict"

import { parsePrometheus, indexByName, filterSamples, deltaSnapshots } from "../lib/prometheus.mjs"

// ── parsePrometheus: bare numeric lines ─────────────────────────────────────
{
  const out = parsePrometheus(`
# HELP up Whether the target is up
# TYPE up gauge
up 1
my_metric 3.14
`)
  assert.deepEqual(out, [
    { name: "up", labels: {}, value: 1 },
    { name: "my_metric", labels: {}, value: 3.14 },
  ])
}

// ── parsePrometheus: labels parsed correctly ────────────────────────────────
{
  const out = parsePrometheus(`paths_ready{name="cam1",state="ready"} 1`)
  assert.equal(out.length, 1)
  assert.equal(out[0].name, "paths_ready")
  assert.deepEqual(out[0].labels, { name: "cam1", state: "ready" })
  assert.equal(out[0].value, 1)
}

// ── parsePrometheus: escaped quotes and backslashes in label values ─────────
{
  const out = parsePrometheus(`m{a="b\\"c",d="e\\\\f"} 0`)
  assert.equal(out[0].labels.a, 'b"c')
  assert.equal(out[0].labels.d, "e\\f")
}

// ── parsePrometheus: special numeric values ─────────────────────────────────
{
  const out = parsePrometheus(`a 0\nb NaN\nc +Inf\nd -Inf\ne -1.5`)
  assert.equal(out[0].value, 0)
  assert.ok(Number.isNaN(out[1].value))
  assert.equal(out[2].value, Infinity)
  assert.equal(out[3].value, -Infinity)
  assert.equal(out[4].value, -1.5)
}

// ── parsePrometheus: trailing timestamp is ignored ──────────────────────────
{
  const out = parsePrometheus(`foo 5 1700000000000`)
  assert.equal(out.length, 1)
  assert.equal(out[0].value, 5)
}

// ── parsePrometheus: comment and blank lines skipped ────────────────────────
{
  const out = parsePrometheus(`
# nothing here

# HELP x desc
x 1
`)
  assert.equal(out.length, 1)
  assert.equal(out[0].name, "x")
}

// ── parsePrometheus: malformed lines skipped silently ───────────────────────
{
  const out = parsePrometheus(`not_a_metric_line_no_value
also_bad{ broken=`)
  assert.deepEqual(out, [])
}

// ── indexByName groups samples by name ──────────────────────────────────────
{
  const samples = parsePrometheus(`a{p="1"} 1\na{p="2"} 2\nb 3`)
  const idx = indexByName(samples)
  assert.equal(idx.get("a").length, 2)
  assert.equal(idx.get("b").length, 1)
}

// ── filterSamples by name and exact label ───────────────────────────────────
{
  const samples = parsePrometheus(`paths_readers{name="cam1"} 0\npaths_readers{name="cam2"} 3`)
  const cam1 = filterSamples(samples, "paths_readers", { name: "cam1" })
  assert.equal(cam1.length, 1)
  assert.equal(cam1[0].value, 0)
}

// ── filterSamples by RegExp label match ─────────────────────────────────────
{
  const samples = parsePrometheus(`m{name="cam_a"} 1\nm{name="cam_b"} 2\nm{name="other"} 3`)
  const matches = filterSamples(samples, "m", { name: /^cam_/ })
  assert.equal(matches.length, 2)
}

// ── deltaSnapshots computes per-fingerprint differences ─────────────────────
{
  const prev = parsePrometheus(`packets{name="cam1"} 10\npackets{name="cam2"} 5`)
  const curr = parsePrometheus(`packets{name="cam1"} 15\npackets{name="cam2"} 5`)
  const deltas = deltaSnapshots(prev, curr)
  const cam1 = deltas.find((d) => d.labels.name === "cam1")
  const cam2 = deltas.find((d) => d.labels.name === "cam2")
  assert.equal(cam1?.delta, 5)
  assert.equal(cam2?.delta, 0)
  // pathName extraction now goes via labels, no regex on fingerprint
  assert.equal(cam1?.labels.name, "cam1")
}

// ── deltaSnapshots: samples missing in prev are skipped ─────────────────────
{
  const prev = parsePrometheus(`a 1`)
  const curr = parsePrometheus(`a 2\nb 5`)
  const deltas = deltaSnapshots(prev, curr)
  assert.equal(deltas.length, 1)
  assert.equal(deltas[0].name, "a")
  assert.equal(deltas[0].delta, 1)
}

// ── deltaSnapshots: label order doesn't affect fingerprint ──────────────────
{
  const prev = parsePrometheus(`m{a="1",b="2"} 10`)
  const curr = parsePrometheus(`m{b="2",a="1"} 12`)
  const deltas = deltaSnapshots(prev, curr)
  assert.equal(deltas.length, 1)
  assert.equal(deltas[0].delta, 2)
}

console.log("prometheus parser: all tests passed")
