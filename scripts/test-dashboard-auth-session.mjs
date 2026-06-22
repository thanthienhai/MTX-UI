import assert from "node:assert/strict"
import fs from "node:fs"

const auth = fs.readFileSync("lib/auth.ts", "utf8")
const login = fs.readFileSync("app/login/page.tsx", "utf8")
const dashboard = fs.readFileSync("app/page.tsx", "utf8")
const authConfigurationView = fs.readFileSync("components/auth-configuration-view.tsx", "utf8")
const protectedRoute = fs.readFileSync("components/protected-route.tsx", "utf8")

for (const expected of [
  "interface DashboardSession",
  "credentialMode: DashboardCredentialMode",
  "issuedAt: number",
  "expiresAt: number",
  "permissions: Record<string, boolean>",
  "DashboardSessionStorageAdapter",
  "dashboardSessionStorageAdapter",
  "isSessionExpired",
  "getSessionPermissions",
  "validateMediaMtxLogin",
  "DashboardLoginError",
]) {
  assert.ok(auth.includes(expected), `Auth session implementation missing: ${expected}`)
}

// Auth headers now handled server-side via HttpOnly cookie (not client-side).
// validateMediaMtxLogin still exists for server-side use (login route handler).
// The deprecated getAuthHeader() returns "" on client — no raw credential exposed.
assert.ok(!auth.includes("credential,") || auth.includes("credentialMode"), "Client session must NOT expose raw credential")
assert.ok(auth.includes('return ""'), "getAuthHeader() must return empty string on client")
assert.ok(auth.includes('return null'), "getAuthToken() must return null on client")
assert.ok(auth.includes("missing_api_permission"), "Login validation must classify missing API permission")
assert.ok(auth.includes("invalid_credentials"), "Login validation must classify invalid credentials")
assert.ok(auth.includes("connection"), "Login validation must classify connection failures")
assert.ok(auth.includes("clearAuth(adapter)"), "Expired sessions must be cleared through the auth adapter")

assert.ok(login.includes('useState<DashboardCredentialMode>("basic")'), "Login screen must support credential mode state")
assert.ok(login.includes('SelectItem value="basic"'), "Login screen must expose Basic Auth mode")
assert.ok(login.includes('SelectItem value="bearer"'), "Login screen must expose token/JWT mode")
assert.ok(login.includes("/api/auth/login"), "Login screen must POST to /api/auth/login (server-validated, cookie-based)")
assert.ok(login.includes("setDashboardSession({"), "Login screen must store metadata-only session on client")
assert.ok(!login.includes("sessionStorage.setItem"), "Login screen must not write raw sessionStorage credentials")
assert.ok(!login.includes("validateMediaMtxLogin"), "Login screen must NOT validate credentials client-side")

assert.ok(protectedRoute.includes("/api/auth/me"), "Protected route must validate session via GET /api/auth/me")
assert.ok(protectedRoute.includes("checkAuth"), "Protected route must have async auth check function")

for (const expected of [
  "getSessionPermissions",
  "permissions.publish",
  "permissions.read",
  'requireMediaMtxAction(permissions, "publish")',
  "Quyền read đang bị tắt",
]) {
  assert.ok(dashboard.includes(expected), `Dashboard RBAC integration missing: ${expected}`)
}

// requireMediaMtxAction(permissions, "read") is used in recording-status-view.tsx
const recordingStatusView = fs.readFileSync("components/recording-status-view.tsx", "utf8")
assert.ok(recordingStatusView.includes('requireMediaMtxAction(permissions, "read")'), "Recording status view must gate read permission")

for (const expected of [
  "Cấu hình xác thực",
  "permissions[action]",
  'requireMediaMtxAction(permissions, "api")',
  "auth.config.patch",
]) {
  assert.ok(authConfigurationView.includes(expected), `Auth configuration RBAC integration missing: ${expected}`)
}

for (const expected of ["Kiểu xác thực", "Tên người dùng", "Mật khẩu", "Đăng nhập", "Token / JWT"]) {
  assert.ok(login.includes(expected), `Login screen missing Vietnamese copy: ${expected}`)
}
