import assert from "node:assert/strict"
import fs from "node:fs"

import {
  buildPathStreamUrls,
  isRegexPathName,
  isAllOthersPathName,
  getPathNameMode,
} from "../lib/mediamtx-url.mjs"

// ── Path Name Mode Helpers ──────────────────────────────────────────

assert.equal(isRegexPathName("~^camera\\d+$"), true, "should detect regex path name")
assert.equal(isRegexPathName("camera1"), false, "normal name is not regex")
assert.equal(isRegexPathName("all_others"), false, "all_others is not regex")
assert.equal(isRegexPathName("~"), false, "single tilde is not regex (no pattern)")

assert.equal(isAllOthersPathName("all_others"), true, "should detect all_others")
assert.equal(isAllOthersPathName("camera1"), false, "normal name is not all_others")
assert.equal(isAllOthersPathName("~^camera"), false, "regex name is not all_others")

assert.equal(getPathNameMode("camera1"), "normal", "normal path name mode")
assert.equal(getPathNameMode("~^camera\\d+$"), "regex", "regex path name mode")
assert.equal(getPathNameMode("all_others"), "all_others", "all_others path name mode")
assert.equal(getPathNameMode(""), "normal", "empty string defaults to normal")
assert.equal(getPathNameMode(null), "normal", "null defaults to normal")

// ── Stream URL Generation ──────────────────────────────────────────

// Normal path name
const normalUrls = buildPathStreamUrls("mystream", {
  hlsUrl: "http://localhost:8888",
  playbackUrl: "http://localhost:8888",
  rtspAddress: ":8554",
  rtspsAddress: ":8322",
  rtmpAddress: ":1935",
  srtAddress: ":8890",
})

assert.equal(normalUrls.rtsp, "rtsp://localhost:8554/mystream")
assert.equal(normalUrls.rtsps, "rtsps://localhost:8322/mystream")
assert.equal(normalUrls.rtmp, "rtmp://localhost:1935/mystream")
assert.equal(normalUrls.hls, "http://localhost:8888/mystream/index.m3u8")
assert.equal(normalUrls.webrtc, "http://localhost:8888/mystream/whep")
assert.equal(normalUrls.srt, "srt://localhost:8890?streamid=mystream")

// Regex path name (special characters encoded)
const regexUrls = buildPathStreamUrls("~^camera\\d+$", {
  rtspAddress: ":8554",
})

assert.equal(regexUrls.rtsp, "rtsp://localhost:8554/~%5Ecamera%5Cd%2B%24",
  "regex path name special chars should be encoded")

// all_others path name
const allOthersUrls = buildPathStreamUrls("all_others", {
  rtspAddress: ":8554",
})

assert.equal(allOthersUrls.rtsp, "rtsp://localhost:8554/all_others",
  "all_others path name should be preserved as-is")

// Path name with spaces
const spacedUrls = buildPathStreamUrls("cam 1", {
  rtspAddress: ":8554",
})

assert.equal(spacedUrls.rtsp, "rtsp://localhost:8554/cam%201",
  "path names with spaces should be encoded")

// Null URLs when address not provided
const noAddressUrls = buildPathStreamUrls("mystream", {})
assert.equal(noAddressUrls.rtsp, null, "RTSP URL should be null when no address")
assert.equal(noAddressUrls.rtsps, null, "RTSPS URL should be null when no address")
assert.equal(noAddressUrls.rtmp, null, "RTMP URL should be null when no address")
assert.equal(noAddressUrls.srt, null, "SRT URL should be null when no address")

// ── Kick resolution ────────────────────────────────────────────────

// Test resolveReaderKick via string parsing since we can't import the actual client without fetch mocking
const sourceContent = fs.readFileSync("lib/mediamtx-api.ts", "utf8")

assert.ok(sourceContent.includes("resolveReaderKick"), "resolveReaderKick function must exist")
assert.ok(sourceContent.includes("getKickableReaders"), "getKickableReaders function must exist")

const readerKickPatterns = [
  "rtspSessions",
  "rtmpConnections",
  "srtConnections",
  "webrtcSessions",
]
for (const client of readerKickPatterns) {
  assert.ok(sourceContent.includes(`${client}.kick`), `Reader kick resolution missing ${client}.kick`)
}

const unsupportedPatterns = [
  "rtspConnections",
  "hlsMuxers",
]
for (const client of unsupportedPatterns) {
  assert.ok(sourceContent.includes(`${client}`), `Unsupported reader type missing: ${client}`)
}

// ── API client coverage ────────────────────────────────────────────

assert.ok(sourceContent.includes("replacePath"), "replacePath client helper must exist")
assert.ok(sourceContent.includes("deletePath"), "deletePath client helper must exist")
assert.ok(sourceContent.includes("patchPathDefaults"), "patchPathDefaults client helper must exist")
assert.ok(sourceContent.includes("getPathDefaults"), "getPathDefaults client helper must exist")
assert.ok(sourceContent.includes("getPathConfig("), "getPathConfig (single path get) must exist")
assert.ok(sourceContent.includes("getPath("), "getPath (runtime path get) must exist")
assert.ok(sourceContent.includes("getPaths("), "getPaths (runtime path list) must exist")
assert.ok(sourceContent.includes("getPathConfigs("), "getPathConfigs (config path list) must exist")

// ── Type extensions ────────────────────────────────────────────────

assert.ok(sourceContent.includes("useAbsoluteTimestamp?"), "PathConf must have useAbsoluteTimestamp field")
assert.ok(sourceContent.includes("bytesReceived?"), "PathReader must have optional bytesReceived")
assert.ok(sourceContent.includes("bytesSent?"), "PathReader must have optional bytesSent")

// ── URL builder exports ────────────────────────────────────────────

const urlSource = fs.readFileSync("lib/mediamtx-url.mjs", "utf8")

assert.ok(urlSource.includes("buildPathStreamUrls"), "buildPathStreamUrls must exist")
assert.ok(urlSource.includes("isRegexPathName"), "isRegexPathName must exist")
assert.ok(urlSource.includes("isAllOthersPathName"), "isAllOthersPathName must exist")
assert.ok(urlSource.includes("getPathNameMode"), "getPathNameMode must exist")
