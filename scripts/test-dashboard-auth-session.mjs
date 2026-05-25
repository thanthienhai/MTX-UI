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
  "permissions: Record<MediaMtxAction, boolean>",
  "DashboardSessionStorageAdapter",
  "dashboardSessionStorageAdapter",
  "createDashboardSession",
  "isSessionExpired",
  "getSessionPermissions",
  "validateMediaMtxLogin",
  "DashboardLoginError",
]) {
  assert.ok(auth.includes(expected), `Auth session implementation missing: ${expected}`)
}

assert.ok(auth.includes("Basic ${session.credential}"), "Auth helper must generate Basic auth headers")
assert.ok(auth.includes("Bearer ${session.credential}"), "Auth helper must generate Bearer auth headers")
assert.ok(auth.includes("missing_api_permission"), "Login validation must classify missing API permission")
assert.ok(auth.includes("invalid_credentials"), "Login validation must classify invalid credentials")
assert.ok(auth.includes("connection"), "Login validation must classify connection failures")
assert.ok(auth.includes("clearAuth(adapter)"), "Expired sessions must be cleared through the auth adapter")

assert.ok(login.includes('useState<DashboardCredentialMode>("basic")'), "Login screen must support credential mode state")
assert.ok(login.includes('SelectItem value="basic"'), "Login screen must expose Basic Auth mode")
assert.ok(login.includes('SelectItem value="bearer"'), "Login screen must expose token/JWT mode")
assert.ok(login.includes("validateMediaMtxLogin"), "Login screen must validate credentials before storing sessions")
assert.ok(login.includes("setDashboardSession(session)"), "Login screen must store structured sessions")
assert.ok(!login.includes("sessionStorage.setItem"), "Login screen must not write raw sessionStorage credentials")

assert.ok(protectedRoute.includes("isAuthenticated()"), "Protected route must use shared auth expiry checks")

for (const expected of [
  "getSessionPermissions",
  "permissions.publish",
  "permissions.read",
  'requireMediaMtxAction(permissions, "publish")',
  'requireMediaMtxAction(permissions, "read")',
  "Quyền read đang bị tắt",
]) {
  assert.ok(dashboard.includes(expected), `Dashboard RBAC integration missing: ${expected}`)
}

for (const expected of [
  "Cau hinh xac thuc",
  "permissions[action]",
  'requireMediaMtxAction(permissions, "api")',
  "auth.config.patch",
]) {
  assert.ok(authConfigurationView.includes(expected), `Auth configuration RBAC integration missing: ${expected}`)
}

for (const expected of ["Kiểu xác thực", "Tên người dùng", "Mật khẩu", "Đăng nhập", "Token / JWT"]) {
  assert.ok(login.includes(expected), `Login screen missing Vietnamese copy: ${expected}`)
}
