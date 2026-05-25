import assert from "node:assert/strict"
import fs from "node:fs"

const api = fs.readFileSync("lib/mediamtx-api.ts", "utf8")
const page = fs.readFileSync("app/page.tsx", "utf8")
const view = fs.readFileSync("components/global-config-view.tsx", "utf8")

for (const field of [
  "logLevel",
  "logDestinations",
  "logStructured",
  "logFile",
  "sysLogPrefix",
  "dumpPackets",
  "readTimeout",
  "writeTimeout",
  "writeQueueSize",
  "udpMaxPayloadSize",
  "udpReadBufferSize",
  "runOnConnect",
  "runOnConnectRestart",
  "runOnDisconnect",
  "rtspEncryption",
  "rtmpEncryption",
]) {
  assert.ok(api.includes(`${field}?`), `GlobalConf missing field: ${field}`)
  if (!field.endsWith("Encryption")) {
    assert.ok(view.includes(`"${field}"`), `GlobalConfigView missing field control or dirty key: ${field}`)
  }
}

assert.ok(api.includes('fetchMediaMtxApi<GlobalConf>("/v3/config/global/get")'), "getGlobalConfig must use global get endpoint")
assert.ok(api.includes('fetchMediaMtxApi<null, Partial<GlobalConf>>("/v3/config/global/patch"'), "patchGlobalConfig must use global patch endpoint")
assert.ok(api.includes('method: "PATCH"'), "patchGlobalConfig must send PATCH")
assert.ok(api.includes("MediaMtxApiError"), "Global config failures must use unified API error wrapper")

for (const expected of [
  "GlobalConfigView",
  'TabsTrigger value="config"',
  'TabsContent value="config"',
  "Cấu hình",
]) {
  assert.ok(page.includes(expected), `Dashboard missing configuration integration: ${expected}`)
}

for (const expected of [
  "computeDirtyFields",
  "setOriginalConfig",
  "lastSyncedAt",
  "có thay đổi chưa lưu",
  "Đang tải global configuration",
  "Không có dữ liệu cấu hình",
  "Cần quyền api để chỉnh sửa",
  'requireMediaMtxAction(permissions, "api")',
  "Xem trước payload",
  "JSON.stringify(pendingPatchPreview, null, 2)",
  "PATCH /v3/config/global/patch",
  "api.patchGlobalConfig(dirty as Partial<GlobalConf>)",
  "Đã cập nhật",
  "Một số trường bị lỗi",
  "Không có thay đổi để lưu",
  "appendAuditEvent",
  "payloadSummary: JSON.stringify(dirty)",
]) {
  assert.ok(view.includes(expected), `GlobalConfigView missing behavior: ${expected}`)
}

assert.ok(!view.includes("alert("), "GlobalConfigView must not use blocking browser alerts")
