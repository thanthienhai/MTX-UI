import assert from "node:assert/strict"
import fs from "node:fs"

const component = fs.readFileSync("components/auth-configuration-view.tsx", "utf8")
const page = fs.readFileSync("app/page.tsx", "utf8")

for (const expected of [
  "api.getGlobalConfig()",
  "api.patchAuthConfiguration(patch)",
  "api.testHttpAuthEndpoint",
  "api.refreshJwks()",
  "requireMediaMtxAction(permissions, \"api\")",
  "buildAuthConfigurationPatch",
  "mapGlobalConfigToAuthForm",
  "validateAuthForm",
  "passwordReplacement",
  "authHTTPAddress",
  "authHTTPFingerprint",
  "authHTTPExclude",
  "authJWTJWKS",
  "authJWTJWKSFingerprint",
  "authJWTClaimKey",
  "authJWTIssuer",
  "authJWTAudience",
  "authJWTExclude",
  "JSON.stringify(patchPreview, null, 2)",
  "auth.config.patch",
  "auth.http.test",
  "auth.jwks.refresh",
]) {
  assert.ok(component.includes(expected), `Auth configuration view is missing: ${expected}`)
}

for (const action of ["publish", "read", "playback", "api", "metrics", "pprof"]) {
  assert.ok(component.includes(action), `Permission matrix missing action: ${action}`)
}

for (const expected of [
  "AuthConfigurationView",
  "permissions={permissions}",
  "appendAuditEvent={appendAuditEvent}",
]) {
  assert.ok(page.includes(expected), `Dashboard auth tab is not wired correctly: ${expected}`)
}

assert.ok(!page.includes("Người dùng mặc định (any)"), "Static sample internal user card should be removed")
