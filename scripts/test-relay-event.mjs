import assert from "node:assert/strict"

import {
  META_PREFIX,
  META_VERSION,
  FANOUT_PREFIX,
  FANOUT_SEPARATOR,
  generateToken,
  generateStreamKey,
  generateLoginCode,
  hashLoginCode,
  verifyLoginCode,
  maskKey,
  buildIngestUrls,
  destinationUrl,
  buildRunOnReady,
  relayHasActiveCommand,
  buildFanoutRunOnReady,
  buildFanoutRunOnNotReady,
  fanoutPathName,
  isFanoutPathName,
  fanoutSourceUrl,
  parseFanoutMeta,
  encodeMeta,
  decodeMeta,
  parseRunOnReady,
  createEventMeta,
  toPublicStatus,
  createSessionToken,
  verifySessionToken,
  setMetaLoginCode,
  rotateMetaSlug,
  setMetaRelayEnabled,
  validateCustomPath,
  validateDestinationInput,
  addMetaDestination,
  updateMetaDestination,
  deleteMetaDestination,
  countEnabledDestinations,
  rotateMetaStatusToken,
  rotateMetaConfigToken,
  regenerateMetaLoginCode,
  setMetaFallback,
  FALLBACK_TYPES,
  buildRunOnNotReady,
  fallbackAssetUrl,
} from "../lib/relay-event.mjs"

/* tokens & keys --------------------------------------------------------- */
const t1 = generateToken()
const t2 = generateToken()
assert.notEqual(t1, t2, "tokens must be unique")
assert.match(t1, /^[A-Za-z0-9_-]+$/, "token is base64url")
assert.match(generateStreamKey(), /^[A-Za-z0-9]{20}$/, "stream key is 20 alnum")
assert.match(generateLoginCode(), /^[A-Za-z0-9]{11}$/, "login code is 11 chars")

/* login code hashing ---------------------------------------------------- */
const stored = hashLoginCode("WRx7nJJIqSY")
assert.ok(stored.salt && stored.hash, "hash returns salt+hash")
assert.equal(verifyLoginCode("WRx7nJJIqSY", stored), true, "correct code verifies")
assert.equal(verifyLoginCode("wrong", stored), false, "wrong code rejected")
assert.equal(verifyLoginCode("WRx7nJJIqSY", null), false, "null stored rejected")
assert.equal(verifyLoginCode("WRx7nJJIqSY", { salt: "x", hash: "y" }), false, "garbage stored rejected")

/* masking --------------------------------------------------------------- */
assert.equal(maskKey("Lcyn5IVmADuJGMi7vA1b"), "••••vA1b")
assert.equal(maskKey("ab"), "••")
assert.equal(maskKey(""), "")

/* ingest URLs ----------------------------------------------------------- */
const ingest = buildIngestUrls("Lcyn5IVmADuJGMi7vA1b", {
  rtmpHost: "rtmp.tk.name.vn",
  rtmpAddress: "rtmp.tk.name.vn:1935",
  rtmpsHost: "rtmp.tk.name.vn",
  rtmpsAddress: "rtmp.tk.name.vn:1936",
  srtHost: "srt.tk.name.vn",
  srtAddress: "srt.tk.name.vn:8890",
})
assert.equal(ingest.rtmp, "rtmp://rtmp.tk.name.vn:1935/Lcyn5IVmADuJGMi7vA1b")
assert.equal(ingest.rtmps, "rtmps://rtmp.tk.name.vn:1936/Lcyn5IVmADuJGMi7vA1b")
assert.equal(ingest.srt, "srt://srt.tk.name.vn:8890?streamid=publish:Lcyn5IVmADuJGMi7vA1b")

/* destination url join -------------------------------------------------- */
assert.equal(
  destinationUrl({ serverUrl: "rtmps://live-api.facebook.com:443/rtmp/", streamKey: "FB-KEY-123" }),
  "rtmps://live-api.facebook.com:443/rtmp/FB-KEY-123",
)
assert.equal(destinationUrl({ serverUrl: "", streamKey: "k" }), "k")

/* meta encode/decode round-trip ---------------------------------------- */
const sample = { version: META_VERSION, slug: "abc", displayName: "Tên có dấu", destinations: [] }
const encoded = encodeMeta(sample)
assert.match(encoded, /^[A-Za-z0-9_-]+$/, "encoded meta is base64url")
assert.deepEqual(decodeMeta(encoded), sample, "decode round-trips")
assert.equal(decodeMeta("!!!not-base64-json"), null, "bad meta decodes to null")

/* ingest runOnReady is ALWAYS a metadata no-op (fan-out lives elsewhere) */
const { meta } = createEventMeta({ displayName: "Nguyễn Cao Nguyên", quota: 10 })
assert.equal(meta.version, META_VERSION)
assert.match(meta.slug, /^[A-Za-z0-9]{20}$/)
assert.ok(meta.statusToken && meta.configToken)
assert.equal(meta.destinations, undefined, "new events carry NO destinations array in meta")
const ingestRor = buildRunOnReady(meta)
assert.ok(ingestRor.startsWith("sh -c "), "runOnReady wrapped in sh -c for real-shell semantics")
assert.ok(ingestRor.includes(": " + META_PREFIX), "ingest runOnReady is a no-op metadata comment")
assert.ok(!ingestRor.includes("ffmpeg "), "ingest path never runs ffmpeg")
assert.deepEqual(parseRunOnReady(ingestRor), meta, "meta survives in no-op runOnReady")
assert.equal(relayHasActiveCommand(), false, "ingest no-op must never auto-restart")

/* fan-out path naming + source ---------------------------------------- */
assert.equal(fanoutPathName("evt", "d1"), `evt${FANOUT_SEPARATOR}d1`, "fan-out path name composed")
assert.equal(isFanoutPathName("evt__fo__d1"), true, "fan-out name detected")
assert.equal(isFanoutPathName("evt"), false, "plain ingest name not a fan-out")
assert.equal(fanoutSourceUrl("evt"), "rtsp://localhost:8554/evt", "fan-out pulls the ingest over local rtsp")

/* per-destination fan-out runOnReady (push to ONE destination) --------- */
const destEnabled = { id: "d1", name: "FB", platform: "facebook", serverUrl: "rtmps://a/rtmp", streamKey: "k1", enabled: true, createdAt: "2026-01-01T00:00:00.000Z" }
const destDisabled = { id: "d2", name: "YT", platform: "youtube", serverUrl: "rtmp://b/live", streamKey: "k2", enabled: false, createdAt: "2026-01-02T00:00:00.000Z" }

const foRor = buildFanoutRunOnReady(destEnabled, { slug: "evt", relayEnabled: true })
assert.ok(foRor.startsWith("sh -c "), "fan-out runOnReady wrapped in sh -c")
assert.ok(foRor.includes("ffmpeg "), "enabled fan-out emits ffmpeg")
assert.ok(foRor.includes("-c copy"), "fan-out is passthrough copy")
assert.ok(foRor.includes("rtmps://a/rtmp/k1"), "pushes to the destination URL")
assert.ok(foRor.includes("rtsp://localhost:8554/evt__fo__d1"), "reads the local fan-out copy")
assert.deepEqual(
  parseFanoutMeta(foRor),
  { ...destEnabled, parentSlug: "evt", v: META_VERSION },
  "destination meta (incl. parentSlug) survives in RELAY_FANOUT comment",
)

const foDisabled = buildFanoutRunOnReady(destDisabled, { slug: "evt", relayEnabled: true })
assert.ok(!foDisabled.includes("ffmpeg "), "disabled destination => no ffmpeg")
assert.ok(foDisabled.includes(": " + FANOUT_PREFIX), "disabled destination still carries its meta as a no-op")
assert.deepEqual(parseFanoutMeta(foDisabled), { ...destDisabled, parentSlug: "evt", v: META_VERSION }, "disabled dest meta recoverable")

const foRelayOff = buildFanoutRunOnReady(destEnabled, { slug: "evt", relayEnabled: false })
assert.ok(!foRelayOff.includes("ffmpeg "), "relay master off => no ffmpeg even if dest enabled")

/* per-destination fan-out runOnNotReady (own slate fallback) ----------- */
const foNotReady = buildFanoutRunOnNotReady(destEnabled, { type: "text", text: "Chờ chút", enabled: true }, { slug: "evt", relayEnabled: true })
assert.ok(foNotReady.startsWith("sh -c "), "fan-out standby wrapped in sh -c")
assert.ok(foNotReady.includes("ffprobe"), "standby monitors the ingest via ffprobe")
assert.ok(foNotReady.includes("drawtext"), "text slate uses drawtext")
assert.ok(foNotReady.includes("rtmps://a/rtmp/k1"), "standby tees to its own destination")
assert.ok(foNotReady.includes("rtsp://localhost:8554/evt"), "standby probes the ingest path")
assert.equal(
  buildFanoutRunOnNotReady(destEnabled, { type: "none" }, { slug: "evt", relayEnabled: true }),
  "",
  "no fallback => no standby",
)
assert.equal(
  buildFanoutRunOnNotReady(destDisabled, { type: "text", text: "x", enabled: true }, { slug: "evt", relayEnabled: true }),
  "",
  "disabled destination => no standby",
)
assert.equal(
  buildFanoutRunOnNotReady(destEnabled, { type: "text", text: "x", enabled: true }, { slug: "evt", relayEnabled: false }),
  "",
  "relay master off => no standby",
)

/* public projection strips secrets (destinations passed in) ------------ */
const pubDests = [destEnabled, destDisabled, { id: "d3", name: "Custom", platform: "custom", serverUrl: "rtmp://c/app", streamKey: "k3", enabled: true }]
const pub = toPublicStatus(meta, pubDests)
assert.equal(pub.displayName, "Nguyễn Cao Nguyên")
assert.equal(pub.destinations.length, 3)
assert.equal(pub.destinations[0].maskedKey, maskKey("k1"))
assert.ok(!JSON.stringify(pub).includes("k1"), "raw key never leaks in public projection")
assert.ok(!("loginCode" in pub), "login hash not exposed")
assert.deepEqual(toPublicStatus(meta).destinations, [], "no destinations arg => empty list")

/* parseRunOnReady ignores non-meta strings ----------------------------- */
assert.equal(parseRunOnReady("ffmpeg -i x -c copy out.flv"), null)
assert.equal(parseRunOnReady(""), null)
assert.equal(parseRunOnReady(undefined), null)

/* session token sign/verify -------------------------------------------- */
const secret = "test-secret-xyz"
const cfgToken = meta.configToken
const sess = createSessionToken(cfgToken, secret)
assert.equal(verifySessionToken(sess, cfgToken, secret), true, "valid session verifies")
assert.equal(verifySessionToken(sess, "other-token", secret), false, "session bound to its config token")
assert.equal(verifySessionToken(sess, cfgToken, "wrong-secret"), false, "wrong secret rejected")
assert.equal(verifySessionToken("garbage", cfgToken, secret), false, "garbage rejected")
assert.equal(verifySessionToken(createSessionToken(cfgToken, secret, -1000), cfgToken, secret), false, "expired rejected")

/* relayEnabled stays in ingest meta; ingest runOnReady remains a no-op -- */
const relayOff = setMetaRelayEnabled(meta, false)
assert.equal(relayOff.relayEnabled, false, "relay master flag persisted in meta")
const offRor = buildRunOnReady(relayOff)
assert.ok(!offRor.includes("ffmpeg "), "ingest runOnReady is always a no-op regardless of relay flag")
assert.deepEqual(parseRunOnReady(offRor), relayOff, "meta survives when relay off")
const relayOn = setMetaRelayEnabled(meta, true)
assert.equal(relayOn.relayEnabled, true, "relay master flag toggles back on")

/* login code mutation --------------------------------------------------- */
const changed = setMetaLoginCode(meta, "newSecret123")
assert.equal(verifyLoginCode("newSecret123", changed.loginCode), true, "new code verifies after change")
assert.equal(verifyLoginCode("Nguyễn", changed.loginCode), false, "old code no longer works")

/* slug rotation --------------------------------------------------------- */
const rot = rotateMetaSlug(meta)
assert.notEqual(rot.newSlug, rot.oldSlug, "slug actually rotates")
assert.equal(rot.meta.slug, rot.newSlug, "meta carries new slug")
assert.match(rot.newSlug, /^[A-Za-z0-9]{20}$/, "new slug is a valid key")
assert.equal(rot.meta.statusToken, meta.statusToken, "share tokens preserved on rotate")

/* destination input validation ----------------------------------------- */
assert.equal(validateDestinationInput({}).ok, false, "empty input rejected")
assert.equal(
  validateDestinationInput({ name: "x", platform: "facebook", serverUrl: "http://nope", streamKey: "k" }).ok,
  false,
  "http scheme rejected",
)
assert.equal(
  validateDestinationInput({ name: "x", platform: "twitch", serverUrl: "rtmp://a", streamKey: "k" }).ok,
  false,
  "unknown platform rejected",
)
const okV = validateDestinationInput({
  name: "  FB Main  ",
  platform: "facebook",
  serverUrl: "rtmps://live-api.facebook.com:443/rtmp/",
  streamKey: " key123 ",
})
assert.equal(okV.ok, true, "valid input accepted")
assert.equal(okV.normalized.name, "FB Main", "name trimmed")
assert.equal(okV.normalized.streamKey, "key123", "key trimmed")

/* destination CRUD ----------------------------------------------------- */
const base = createEventMeta({ displayName: "CRUD test", quota: 2 }).meta
const a1 = addMetaDestination(base, {
  name: "FB",
  platform: "facebook",
  serverUrl: "rtmps://a/rtmp/",
  streamKey: "k1",
  enabled: true,
})
assert.ok(!a1.error, "add #1 ok")
assert.equal(a1.meta.destinations.length, 1)
assert.match(a1.meta.destinations[0].id, /^[A-Za-z0-9_-]+$/)
assert.equal(a1.meta.destinations[0].serverUrl, "rtmps://a/rtmp", "trailing slash stripped")

const a2 = addMetaDestination(a1.meta, {
  name: "YT",
  platform: "youtube",
  serverUrl: "rtmp://b/live",
  streamKey: "k2",
  enabled: false,
})
assert.equal(a2.meta.destinations.length, 2)
assert.equal(countEnabledDestinations(a2.meta), 1, "only enabled ones counted")

const bad = addMetaDestination(a1.meta, { name: "", platform: "facebook", serverUrl: "rtmp://x", streamKey: "k" })
assert.ok(bad.error, "bad input returns error")

const id1 = a2.meta.destinations[0].id
const up1 = updateMetaDestination(a2.meta, id1, { enabled: false, name: "FB renamed" })
assert.ok(!up1.error, "patch ok")
assert.equal(up1.meta.destinations[0].enabled, false)
assert.equal(up1.meta.destinations[0].name, "FB renamed")
assert.equal(countEnabledDestinations(up1.meta), 0)

const upBadPlatform = updateMetaDestination(a2.meta, id1, { platform: "tiktok" })
assert.ok(upBadPlatform.error, "bad platform in patch rejected")
const upMissing = updateMetaDestination(a2.meta, "no-such-id", { enabled: true })
assert.ok(upMissing.error, "missing id rejected")

const del = deleteMetaDestination(a2.meta, id1)
assert.equal(del.destinations.length, 1, "destination removed")
assert.equal(del.destinations[0].name, "YT", "the right one stays")

/* custom ingest path validation ---------------------------------------- */
assert.deepEqual(validateCustomPath(""), { ok: true, value: "" }, "empty => auto-generate")
assert.deepEqual(validateCustomPath("  "), { ok: true, value: "" }, "whitespace => auto-generate")
assert.deepEqual(validateCustomPath("my-event_01"), { ok: true, value: "my-event_01" }, "alnum/_/- accepted")
assert.equal(validateCustomPath("ab").ok, false, "too short rejected")
assert.equal(validateCustomPath("has space").ok, false, "spaces rejected")
assert.equal(validateCustomPath("bad/slash").ok, false, "slash rejected")
assert.equal(validateCustomPath("evt__fo__d1").ok, false, "fan-out namespace reserved")
assert.equal(validateCustomPath("x".repeat(65)).ok, false, "over 64 chars rejected")

/* status / config token rotation -------------------------------------- */
const rotS = rotateMetaStatusToken(base)
assert.notEqual(rotS.statusToken, base.statusToken, "status token actually rotates")
assert.equal(rotS.configToken, base.configToken, "config token preserved")
const rotC = rotateMetaConfigToken(base)
assert.notEqual(rotC.configToken, base.configToken, "config token actually rotates")
assert.equal(rotC.statusToken, base.statusToken, "status token preserved")

/* regenerate login code ----------------------------------------------- */
const regen = regenerateMetaLoginCode(base)
assert.match(regen.loginCode, /^[A-Za-z0-9]{11}$/, "fresh code shape")
assert.equal(verifyLoginCode(regen.loginCode, regen.meta.loginCode), true, "new code verifies")
assert.notEqual(regen.meta.loginCode.hash, base.loginCode.hash, "hash changed")

/* fallback meta storage ------------------------------------------------ */
assert.deepEqual(FALLBACK_TYPES, ["none", "text", "image", "video"], "fallback types frozen")
const fbText = setMetaFallback(base, { type: "text", text: "Đang gián đoạn" })
assert.equal(fbText.fallback.type, "text")
assert.equal(fbText.fallback.text, "Đang gián đoạn")
assert.equal(fbText.fallback.enabled, true, "enabled defaults to true")
const fbImg = setMetaFallback(base, { type: "image", assetRef: "/uploads/slate.png" })
assert.equal(fbImg.fallback.type, "image")
assert.equal(fbImg.fallback.assetRef, "/uploads/slate.png", "asset ref stored even when runtime unsupported")
const fbBogus = setMetaFallback(base, { type: "frogus" })
assert.equal(fbBogus.fallback, undefined, "invalid type degrades to none (removed)")
const fbCleared = setMetaFallback(fbText, { type: "none" })
assert.equal("fallback" in fbCleared, false, "none clears the field")
// Long text gets clamped
const fbLong = setMetaFallback(base, { type: "text", text: "x".repeat(500) })
assert.ok(fbLong.fallback.text.length <= 200, "text clamped to 200 chars")
// image/video carry display metadata
const fbImg2 = setMetaFallback(base, {
  type: "video",
  assetRef: "abc123",
  assetName: "loop.mp4",
  assetMime: "video/mp4",
})
assert.equal(fbImg2.fallback.assetName, "loop.mp4", "asset name stored")
assert.equal(fbImg2.fallback.assetMime, "video/mp4", "asset mime stored")

/* fallback asset URL --------------------------------------------------- */
assert.equal(
  fallbackAssetUrl("http://fe:3000/", "abc123"),
  "http://fe:3000/api/public/asset/abc123",
  "asset url joined + trailing slash trimmed",
)
assert.equal(fallbackAssetUrl("", "abc123"), "", "no base => empty")
assert.equal(fallbackAssetUrl("http://fe:3000", ""), "", "no ref => empty")

/* runOnNotReady standby builder --------------------------------------- */
// a1.meta has one enabled destination -> rtmps://a/rtmp/k1
const metaText = setMetaFallback({ ...a1.meta, relayEnabled: true }, { type: "text", text: "Chờ chút" })
const ronr = buildRunOnNotReady(metaText)
assert.ok(ronr.startsWith("sh -c "), "wrapped in sh -c for MediaMTX exec")
assert.ok(ronr.includes("ffprobe"), "monitors source via ffprobe")
assert.ok(ronr.includes("drawtext"), "text slate uses drawtext")
assert.ok(ronr.includes("rtmps://a/rtmp/k1"), "tees to the enabled destination")
assert.ok(ronr.includes("rtsp://localhost:8554/"), "probes local rtsp source")

// image/video need a resolvable asset base url
const metaImg = setMetaFallback({ ...a1.meta, relayEnabled: true }, { type: "image", assetRef: "img1" })
assert.equal(buildRunOnNotReady(metaImg), "", "image without asset base url => no standby")
const ronrImg = buildRunOnNotReady(metaImg, { assetBaseUrl: "http://fe:3000" })
assert.ok(ronrImg.includes("-loop 1"), "image looped")
assert.ok(ronrImg.includes("http://fe:3000/api/public/asset/img1"), "reads asset over http")

const metaVid = setMetaFallback({ ...a1.meta, relayEnabled: true }, { type: "video", assetRef: "vid1" })
const ronrVid = buildRunOnNotReady(metaVid, { assetBaseUrl: "http://fe:3000" })
assert.ok(ronrVid.includes("-stream_loop -1"), "video looped infinitely")

// off / no-destinations / relay-stopped => cleared
assert.equal(buildRunOnNotReady({ ...metaText, fallback: { type: "text", text: "x", enabled: false } }), "", "disabled => empty")
assert.equal(buildRunOnNotReady({ ...base, fallback: { type: "text", text: "x", enabled: true } }), "", "no destinations => empty")
assert.equal(buildRunOnNotReady({ ...metaText, relayEnabled: false }), "", "relay stopped => empty")

console.log("test-relay-event.mjs: all assertions passed")
