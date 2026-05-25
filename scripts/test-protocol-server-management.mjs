import assert from "node:assert/strict"
import fs from "node:fs"

import {
  buildProtocolConfigPatch,
  extractSrtMetrics,
  maskProtocolPayload,
  parseStringArray,
  PROTOCOL_FIELD_GROUPS,
  PROTOCOL_FIELD_METADATA,
  summarizeProtocolPayload,
  validateProtocolConfigPatch,
} from "../lib/protocol-server-management.mjs"

const requiredGroups = ["rtsp", "rtmp", "hls", "webrtc", "srt", "rtpMpegts"]
for (const group of requiredGroups) {
  assert.ok(PROTOCOL_FIELD_GROUPS[group], `Missing protocol field group: ${group}`)
  assert.ok(PROTOCOL_FIELD_GROUPS[group].fields.length > 0, `Protocol group has no fields: ${group}`)
}

for (const field of [
  "rtspTransports",
  "rtspEncryption",
  "rtspAuthMethods",
  "rtmpEncryption",
  "hlsVariant",
  "webrtcICEServers2",
  "rtspDemuxMpegts",
]) {
  assert.ok(PROTOCOL_FIELD_METADATA[field], `Missing protocol metadata for ${field}`)
}

assert.deepEqual(parseStringArray("udp, multicast, tcp"), ["udp", "multicast", "tcp"])
assert.deepEqual(parseStringArray(["basic", "digest"]), ["basic", "digest"])

const original = { rtsp: true, rtspAddress: ":8554", rtspTransports: ["udp", "tcp"], unknown: "keep" }
const current = { ...original, rtspAddress: ":8555", rtspTransports: ["tcp"], rtmpAddress: ":1935" }
assert.deepEqual(
  buildProtocolConfigPatch(original, current, ["rtsp", "rtspAddress", "rtspTransports", "unknown"]),
  { rtspAddress: ":8555", rtspTransports: ["tcp"] },
)

assert.deepEqual(validateProtocolConfigPatch({ rtspEncryption: "optional", rtspTransports: ["udp", "tcp"] }), {})
assert.equal(validateProtocolConfigPatch({ rtspEncryption: "bad" }).rtspEncryption, "Giá trị không được hỗ trợ.")
assert.equal(validateProtocolConfigPatch({ rtspAddress: "" }).rtspAddress, "Cần nhập địa chỉ hợp lệ.")
assert.equal(validateProtocolConfigPatch({ multicastRTPPort: -1 }).multicastRTPPort, "Cần nhập số không âm.")
assert.equal(validateProtocolConfigPatch({ webrtcICEServers2: "{}" }).webrtcICEServers2, "Cần nhập JSON array.")

assert.deepEqual(maskProtocolPayload({ rtspServerKey: "secret", hlsAddress: ":8888" }), {
  rtspServerKey: "[masked]",
  hlsAddress: ":8888",
})
assert.equal(summarizeProtocolPayload({ rtmpServerCert: "secret" }), "{\"rtmpServerCert\":\"[masked]\"}")

assert.deepEqual(extractSrtMetrics({
  rttMs: 12,
  packetsLost: 3,
  packetsRetransmitted: 2,
  sendRateBps: 1200,
  receiveRateBps: 900,
}), {
  rtt: 12,
  loss: 3,
  retransmit: 2,
  sendRate: 1200,
  receiveRate: 900,
})

const component = fs.readFileSync("components/protocol-server-management.tsx", "utf8")
for (const expected of [
  "api.rtspConnections.list",
  "api.rtspSessions.kick",
  "api.rtmpConnections.kick",
  "api.rtmpsConnections.kick",
  "api.getHlsMuxers",
  "api.webrtcSessions.kick",
  "api.srtConnections.kick",
  "requireMediaMtxAction(permissions, \"api\")",
  "permissions.read !== false",
  "permissions.publish !== false",
  "summarizeProtocolPayload",
]) {
  assert.ok(component.includes(expected), `Protocol component missing expected wiring: ${expected}`)
}
