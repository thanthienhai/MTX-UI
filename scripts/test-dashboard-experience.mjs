import assert from "node:assert/strict"
import fs from "node:fs"

const page = fs.readFileSync("app/page.tsx", "utf8")
const layout = fs.readFileSync("app/layout.tsx", "utf8")
const polling = fs.readFileSync("hooks/use-refresh-polling.ts", "utf8")

assert.ok(!page.includes("alert("), "Dashboard must not use browser alert() for operation feedback")

for (const expected of [
  "useNotifications",
  "LoadingState",
  "EmptyState",
  "ErrorState",
  "createAuditEvent",
  "saveAuditEvents",
  "requireMediaMtxAction",
  "useRefreshPolling",
  "buildMediaMtxMetricsUrl",
  "buildMediaMtxPprofUrl",
  "refreshJwks",
  "rtspTlsEnabled ? api.rtspsConnections.list() : Promise.resolve([])",
  "rtmpTlsEnabled ? api.rtmpsConnections.list() : Promise.resolve([])",
]) {
  assert.ok(page.includes(expected), `Dashboard missing integration: ${expected}`)
}

assert.ok(layout.includes("NotificationProvider"), "App shell must include NotificationProvider")

for (const expected of ["setInterval", "clearInterval", "document.visibilityState", "enabled", "intervalMs"]) {
  assert.ok(polling.includes(expected), `Polling hook missing behavior: ${expected}`)
}
