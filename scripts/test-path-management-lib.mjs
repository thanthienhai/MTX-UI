import assert from "node:assert/strict"

import {
  PATH_FIELD_REGISTRY,
  PATH_DEFAULTS_FIELDS,
  getPathFieldEntry,
  getFieldsForSourceType,
  detectSourceType,
  pathConfToFormValues,
  buildMinimalPatch,
  buildReplacePayload,
  buildAddPayload,
  mergeConfiguredAndRuntimePaths,
  diffPathAgainstDefaults,
  canResetToDefault,
  buildResetFieldPayload,
  buildApplyDefaultsPayloads,
  validateDefaultsPatch,
  exportDefaultsAsJson,
  exportDefaultsAsYaml,
  parseDefaultsJson,
  parseDefaultsYaml,
  validateImportedDefaults,
  buildImportPreviewPayload,
} from "../lib/path-management.mjs"

// ─── 2.1 Field Registry ──────────────────────────────────────────

assert.ok(PATH_FIELD_REGISTRY.length > 30, `PATH_FIELD_REGISTRY should have 30+ entries, got ${PATH_FIELD_REGISTRY.length}`)
assert.ok(PATH_DEFAULTS_FIELDS.includes("source"), "Path defaults should include source")
assert.ok(PATH_DEFAULTS_FIELDS.includes("record"), "Path defaults should include record")
assert.ok(PATH_DEFAULTS_FIELDS.includes("maxReaders"), "Path defaults should include maxReaders")
assert.ok(PATH_DEFAULTS_FIELDS.includes("useAbsoluteTimestamp"), "Path defaults should include useAbsoluteTimestamp")

const sourceEntry = getPathFieldEntry("source")
assert.equal(sourceEntry?.field, "source")
assert.equal(sourceEntry?.category, "source")

const rpiField = getFieldForSourceType("rpiCameraSource")
assert.ok(rpiField.some((e) => e.field === "rpiCameraWidth"), "Should include rpiCameraWidth for rpiCameraSource")
assert.ok(!rpiField.some((e) => e.field === "sourceRedirect"), "Should NOT include sourceRedirect for rpiCameraSource")

function getFieldForSourceType(sourceType) {
  return getFieldsForSourceType(sourceType)
}

// ─── 2.2 Form Mapping ───────────────────────────────────────────

assert.equal(detectSourceType(null), "publisher", "null source → publisher")
assert.equal(detectSourceType(""), "publisher", "empty source → publisher")
assert.equal(detectSourceType("publisher"), "publisher")
assert.equal(detectSourceType("rtsp://192.168.1.1/stream"), "rtspSource")
assert.equal(detectSourceType("rtsps://192.168.1.1/stream"), "rtspsSource")
assert.equal(detectSourceType("rtmp://example/live"), "rtmpSource")
assert.equal(detectSourceType("rtmps://example/live"), "rtmpsSource")
assert.equal(detectSourceType("http://example/stream.m3u8"), "hlsSource")
assert.equal(detectSourceType("https://example/stream.m3u8"), "hlsSource")
assert.equal(detectSourceType("srt://example:8890"), "srtSource")
assert.equal(detectSourceType("udp://localhost:8000"), "udpSource")
assert.equal(detectSourceType("/dev/video0"), "rpiCameraSource")

// Form values
const formValues = pathConfToFormValues({
  name: "cam1",
  source: "rtsp://192.168.1.1/stream",
  maxReaders: 5,
})
assert.equal(formValues.name, "cam1")
assert.equal(formValues._sourceType, "rtspSource")

// Minimal patch
const original = { name: "cam1", source: "rtsp://old", maxReaders: 5 }
const updated = { name: "cam1", source: "rtsp://new", maxReaders: 5 }
const patch = buildMinimalPatch(original, updated)
assert.deepEqual(patch, { source: "rtsp://new" }, "Should only include changed field")

const noChange = buildMinimalPatch(original, original)
assert.deepEqual(noChange, {}, "Should be empty when no changes")

// Replace payload
const replacePayload = buildReplacePayload({ name: "cam1", source: "rtsp://s", maxReaders: 0 })
assert.deepEqual(replacePayload, { name: "cam1", source: "rtsp://s", maxReaders: 0 })

// Add payload
const addPayload = buildAddPayload({ name: "cam1", source: "rtsp://s", maxReaders: 5, someInternal: "_hidden" })
assert.equal(addPayload.name, "cam1")
assert.equal(addPayload.source, "rtsp://s")
assert.equal(addPayload.someInternal, undefined, "Should exclude internal field")

// ─── 2.4 Merge Utilities ────────────────────────────────────────

const configuredPaths = [
  { name: "cam1", source: "rtsp://s1" },
  { name: "cam2", source: "rtsp://s2" },
  { name: "cam_offline", source: "rtsp://s3" },
]

const runtimePaths = [
  {
    name: "cam1",
    confName: "cam1",
    source: { type: "rtspSource", id: "192.168.1.1" },
    ready: true,
    readyTime: "2024-01-01T00:00:00Z",
    tracks: ["video", "audio"],
    bytesReceived: 1000,
    bytesSent: 2000,
    readers: [{ type: "rtspSession", id: "sess1" }],
  },
  {
    name: "runtime_only",
    confName: "runtime_only",
    source: { type: "rtmpConn", id: "192.168.1.2" },
    ready: true,
    readyTime: "2024-01-01T00:00:00Z",
    tracks: ["video"],
    bytesReceived: 500,
    bytesSent: 1000,
    readers: [],
  },
]

const merged = mergeConfiguredAndRuntimePaths(configuredPaths, runtimePaths)

// cam1: matched
const cam1 = merged.find((r) => r.name === "cam1")
assert.ok(cam1, "cam1 should be in merged")
assert.equal(cam1.hasConfig, true)
assert.equal(cam1.hasRuntime, true)
assert.equal(cam1.isReady, true)
assert.equal(cam1.readerCount, 1)
assert.equal(cam1.bytesReceived, 1000)
assert.equal(cam1.tracks.length, 2)

// cam_offline: config-only
const offline = merged.find((r) => r.name === "cam_offline")
assert.ok(offline, "cam_offline should be in merged")
assert.equal(offline.hasConfig, true)
assert.equal(offline.hasRuntime, false)
assert.equal(offline.isReady, false)

// runtime_only: runtime-only
const runtimeOnly = merged.find((r) => r.name === "runtime_only")
assert.ok(runtimeOnly, "runtime_only should be in merged")
assert.equal(runtimeOnly.hasConfig, false)
assert.equal(runtimeOnly.hasRuntime, true)
assert.equal(runtimeOnly.sourceType, "rtmpConn")

// ─── 2.5 Defaults Utilities ──────────────────────────────────────

const pathDefaults = {
  source: "publisher",
  maxReaders: 10,
  record: false,
  overridePublisher: false,
  useAbsoluteTimestamp: true,
}

const pathConf = {
  name: "cam1",
  source: "rtsp://s",
  maxReaders: 5,
  record: false,
  overridePublisher: true,
  useAbsoluteTimestamp: false,
}

const diffs = diffPathAgainstDefaults(pathConf, pathDefaults)
const overrideFields = diffs.filter((d) => d.isOverride)
assert.ok(overrideFields.length >= 3, `Should have 3+ overrides, got ${overrideFields.length}`)
const maxReadersDiff = diffs.find((d) => d.field === "maxReaders")
assert.equal(maxReadersDiff?.pathValue, 5)
assert.equal(maxReadersDiff?.defaultValue, 10)
assert.equal(maxReadersDiff?.isOverride, true)

// Reset
assert.equal(canResetToDefault(pathDefaults, "maxReaders"), true)
assert.equal(canResetToDefault(pathDefaults, "nonexistent"), false)

const resetPayload = buildResetFieldPayload(pathDefaults, "maxReaders")
assert.deepEqual(resetPayload, { maxReaders: 10 })
assert.equal(buildResetFieldPayload(pathDefaults, "nonexistent"), null)

// Apply to all
const applyPayloads = buildApplyDefaultsPayloads(
  [{ name: "cam1", maxReaders: 5 }, { name: "cam2" }],
  pathDefaults,
)
assert.equal(applyPayloads.length, 2, "Should generate patches for both paths")
const appliedCam1 = applyPayloads.find((p) => p.pathName === "cam1")
assert.ok(appliedCam1.patch.maxReaders !== undefined)

// Validation
assert.deepEqual(validateDefaultsPatch({ maxReaders: 5 }), {}, "Valid number → no errors")
const numErrors = validateDefaultsPatch({ maxReaders: "abc" })
assert.ok(numErrors.maxReaders, "Invalid number → error")
const boolErrors = validateDefaultsPatch({ record: "notbool" })
assert.ok(boolErrors.record, "Invalid boolean → error")
const durErrors = validateDefaultsPatch({ sourceOnDemandStartTimeout: "invalid" })
assert.ok(durErrors.sourceOnDemandStartTimeout, "Invalid duration → error")
assert.deepEqual(validateDefaultsPatch({ sourceOnDemandStartTimeout: "10s" }), {}, "Valid duration → no error")

// ─── 2.6 Import/Export ──────────────────────────────────────────

// JSON export
const jsonOut = exportDefaultsAsJson(pathDefaults, false)
const parsed = JSON.parse(jsonOut)
assert.equal(parsed.maxReaders, 10)
assert.equal(parsed.useAbsoluteTimestamp, true)

// YAML export
const yamlOut = exportDefaultsAsYaml(pathDefaults)
assert.ok(yamlOut.includes("maxReaders: 10"))
assert.ok(yamlOut.includes("useAbsoluteTimestamp: true"))
assert.ok(yamlOut.includes("record: false"))
assert.ok(yamlOut.includes("# pathDefaults"))

// JSON parse
const valid = parseDefaultsJson('{"maxReaders": 5}')
assert.equal(valid.ok, true)
assert.equal(valid.ok && valid.data.maxReaders, 5)

const invalid = parseDefaultsJson("not json")
assert.equal(invalid.ok, false)
assert.ok(invalid.ok === false && invalid.error.includes("không hợp lệ"))

const wrongType = parseDefaultsJson("[1,2,3]")
assert.equal(wrongType.ok, false)

// YAML parse
const yamlParsed = parseDefaultsYaml("maxReaders: 10\nrecord: true\nsourceOnDemandStartTimeout: 10s")
assert.equal(yamlParsed.ok, true)
if (yamlParsed.ok) {
  assert.equal(yamlParsed.data.maxReaders, 10)
  assert.equal(yamlParsed.data.record, true)
  assert.equal(yamlParsed.data.sourceOnDemandStartTimeout, "10s")
}

const yamlWithComment = parseDefaultsYaml("# comment\nmaxReaders: 5\n# another\nrecord: false")
assert.equal(yamlWithComment.ok, true)
if (yamlWithComment.ok) {
  assert.equal(yamlWithComment.data.maxReaders, 5)
  assert.equal(yamlWithComment.data.record, false)
}

// Validation
const validated = validateImportedDefaults({ maxReaders: 5, record: true })
assert.equal(validated.ok, true)

const validatedErrors = validateImportedDefaults({ record: "notbool" })
assert.equal(validatedErrors.ok, false)

// Import preview
const preview = buildImportPreviewPayload(
  { maxReaders: 5, record: true },
  { maxReaders: 10, record: true },
)
assert.equal(preview.changed.maxReaders.to, 5)
assert.equal(preview.changed.maxReaders.from, 10)
assert.ok(preview.unchanged.includes("record"), "record is unchanged")

// ── validateRecordPathTemplateStrict + getRecordPathTemplateHints ─────────
const pathLib = await import("../lib/path-management.mjs")
const { validateRecordPathTemplateStrict, getRecordPathTemplateHints, validateRecordPathTemplate } = pathLib

// Strict: unknown tokens reject
assert.equal(
  validateRecordPathTemplateStrict("./rec/%path/%Z"),
  validateRecordPathTemplateStrict("./rec/%path/%Z"),
)
assert.ok(validateRecordPathTemplateStrict("./rec/%path/%Z")?.includes("%Z"))

// Strict: known tokens pass
assert.equal(validateRecordPathTemplateStrict("./rec/%path/%Y-%m-%d_%H-%M-%S-%f"), null)
assert.equal(validateRecordPathTemplateStrict(""), null)
assert.equal(validateRecordPathTemplateStrict("./rec/anything-no-token"), null)

// Hints: missing %path
{
  const hints = getRecordPathTemplateHints("./rec/%f.mp4")
  assert.ok(hints.some((h) => h.includes("%path")))
}
// Hints: missing time variable
{
  const hints = getRecordPathTemplateHints("./rec/%path/file")
  assert.ok(hints.some((h) => h.includes("biến thời gian")))
}
// Hints: clean template returns no hints
assert.deepEqual(getRecordPathTemplateHints("./rec/%path/%Y-%m-%d_%H-%M-%S-%f"), [])

// Legacy wrapper still returns first issue
assert.equal(validateRecordPathTemplate("./rec/%path/%Y-%m-%d_%H-%M-%S-%f"), null)
assert.ok(validateRecordPathTemplate("./rec/%Z")?.length)

console.log("path-management: record template hints passed")

