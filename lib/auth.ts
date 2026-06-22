export type DashboardCredentialMode = "basic" | "bearer"
export type LoginFailureCode = "connection" | "invalid_credentials" | "missing_api_permission" | "server_error"

/**
 * Client-side session metadata (no credential — stored in HttpOnly cookie).
 *
 * The actual credential lives in the server-side session store, keyed by
 * the `mtx_dashboard_session` HttpOnly cookie. This interface holds only
 * non-sensitive metadata for the UI (username, permissions, expiry).
 */
export interface DashboardSession {
  version: 2
  credentialMode: DashboardCredentialMode
  username?: string
  issuedAt: number
  expiresAt: number
  permissions: Record<string, boolean>
}

const DASHBOARD_SESSION_KEY = "mediamtx_dashboard_session"
const LEGACY_AUTH_KEY = "mediamtx_auth"
const LEGACY_USERNAME_KEY = "mediamtx_username"

export class DashboardLoginError extends Error {
  code: LoginFailureCode
  status?: number
  userMessage: string

  constructor(code: LoginFailureCode, userMessage: string, status?: number, cause?: unknown) {
    super(userMessage, { cause })
    this.name = "DashboardLoginError"
    this.code = code
    this.status = status
    this.userMessage = userMessage
  }
}

export interface DashboardSessionStorageAdapter {
  read(): string | null
  write(value: string): void
  remove(): void
}

function getBrowserSessionStorage(): Storage | null {
  if (typeof window === "undefined") return null
  return window.sessionStorage
}

export const dashboardSessionStorageAdapter: DashboardSessionStorageAdapter = {
  read() {
    return getBrowserSessionStorage()?.getItem(DASHBOARD_SESSION_KEY) ?? null
  },
  write(value: string) {
    getBrowserSessionStorage()?.setItem(DASHBOARD_SESSION_KEY, value)
  },
  remove() {
    getBrowserSessionStorage()?.removeItem(DASHBOARD_SESSION_KEY)
  },
}

function parseDashboardSession(raw: string | null): DashboardSession | null {
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw)
    if (parsed.version === 2) {
      if (parsed.credentialMode !== "basic" && parsed.credentialMode !== "bearer") return null
      if (typeof parsed.issuedAt !== "number" || typeof parsed.expiresAt !== "number") return null
      return {
        version: 2,
        credentialMode: parsed.credentialMode,
        username: typeof parsed.username === "string" ? parsed.username : undefined,
        issuedAt: parsed.issuedAt,
        expiresAt: parsed.expiresAt,
        permissions: normalizePermissions(parsed.permissions),
      }
    }

    // v1 sessions carried the credential — still readable for metadata,
    // but the credential is no longer extractable from client.
    if (parsed.version === 1) {
      if (parsed.credentialMode !== "basic" && parsed.credentialMode !== "bearer") return null
      if (typeof parsed.issuedAt !== "number" || typeof parsed.expiresAt !== "number") return null
      return {
        version: 2,
        credentialMode: parsed.credentialMode,
        username: typeof parsed.username === "string" ? parsed.username : undefined,
        issuedAt: parsed.issuedAt,
        expiresAt: parsed.expiresAt,
        permissions: normalizePermissions(parsed.permissions),
      }
    }

    return null
  } catch {
    return null
  }
}

function normalizePermissions(permissions: unknown): Record<string, boolean> {
  if (!permissions || typeof permissions !== "object") return {}
  const result: Record<string, boolean> = {}
  for (const [key, value] of Object.entries(permissions)) {
    if (typeof value === "boolean") result[key] = value
  }
  return result
}

export function createBasicAuthCredential(username: string, password: string) {
  const value = `${username}:${password}`
  if (typeof window !== "undefined" && window.btoa) return window.btoa(value)
  return Buffer.from(value, "utf8").toString("base64")
}

export function setDashboardSession(
  payload: { username?: string; permissions: Record<string, boolean>; credentialMode: DashboardCredentialMode },
  adapter = dashboardSessionStorageAdapter,
) {
  const now = Date.now()
  const session: DashboardSession = {
    version: 2,
    credentialMode: payload.credentialMode,
    username: payload.username?.trim() || undefined,
    issuedAt: now,
    expiresAt: now + 8 * 60 * 60 * 1000,
    permissions: normalizePermissions(payload.permissions),
  }
  adapter.write(JSON.stringify(session))
  const storage = getBrowserSessionStorage()
  storage?.removeItem(LEGACY_AUTH_KEY)
  storage?.removeItem(LEGACY_USERNAME_KEY)
}

export function getDashboardSession(adapter = dashboardSessionStorageAdapter, now = Date.now()): DashboardSession | null {
  const session = parseDashboardSession(adapter.read())
  if (!session) return null

  if (session.expiresAt <= now) {
    clearAuth(adapter)
    return null
  }

  return session
}

export function isSessionExpired(session: DashboardSession, now = Date.now()) {
  return session.expiresAt <= now
}

export function clearAuth(adapter = dashboardSessionStorageAdapter) {
  adapter.remove()
  const storage = getBrowserSessionStorage()
  storage?.removeItem(LEGACY_AUTH_KEY)
  storage?.removeItem(LEGACY_USERNAME_KEY)
}

/**
 * Check if the client has a cached session. This is a fast client-side check
 * that reads sessionStorage. For production-critical auth, always validate
 * via GET /api/auth/me (which checks the HttpOnly cookie server-side).
 */
export function isAuthenticated(): boolean {
  return getDashboardSession() !== null
}

export function getUsername(): string | null {
  return getDashboardSession()?.username ?? null
}

/**
 * @deprecated Auth is now handled via HttpOnly cookie.
 * This function always returns empty string on the client.
 * The server proxy injects the Authorization header from the session cookie.
 */
export function getAuthHeader(): string {
  return ""
}

/**
 * @deprecated Auth is now handled via HttpOnly cookie.
 * This function always returns null on the client.
 */
export function getAuthToken(): string | null {
  return null
}

export function getSessionPermissions(session = getDashboardSession()) {
  return session?.permissions ?? {}
}

/**
 * Server-side login validation (used by /api/auth/login route handler).
 * Returns the credential string for server session storage.
 */
export async function validateMediaMtxLogin({
  credentialMode,
  username,
  password,
  token,
  ttlMs,
  fetchImpl = fetch,
}: {
  credentialMode: DashboardCredentialMode
  username?: string
  password?: string
  token?: string
  ttlMs?: number
  fetchImpl?: typeof fetch
}): Promise<{
  credential: string
  permissions: Record<string, boolean>
  globalConfig: unknown
}> {
  const { buildMediaMtxApiUrl } = await import("./mediamtx-url.mjs")
  const { MEDIAMTX_ACTIONS } = await import("./mediamtx-permissions")

  const credential =
    credentialMode === "basic" ? createBasicAuthCredential(username || "", password || "") : (token || "").trim()

  if (!credential) {
    throw new DashboardLoginError("invalid_credentials", "Nhập thông tin đăng nhập MediaMTX trước khi đăng nhập.")
  }

  if (credentialMode === "basic" && !username?.trim()) {
    throw new DashboardLoginError("invalid_credentials", "Nhập tên người dùng MediaMTX trước khi đăng nhập.")
  }

  let response: Response
  try {
    response = await fetchImpl(buildMediaMtxApiUrl("/v3/config/global/get"), {
      headers: {
        Accept: "application/json",
        Authorization: credentialMode === "bearer" ? `Bearer ${credential}` : `Basic ${credential}`,
      },
      cache: "no-store",
    })
  } catch (cause) {
    throw new DashboardLoginError(
      "connection",
      "Không thể kết nối MediaMTX hoặc proxy dashboard. Kiểm tra URL API MediaMTX và mạng.",
      undefined,
      cause,
    )
  }

  let globalConfig: unknown = null
  if (response.headers.get("content-type")?.includes("application/json")) {
    try {
      globalConfig = await response.json()
    } catch {
      globalConfig = null
    }
  }

  if (!response.ok) {
    const failure = classifyLoginFailure(response.status)
    throw new DashboardLoginError(failure.code, failure.message, response.status)
  }

  const permissions = resolvePermissionsFromGlobalConfig(globalConfig, username)
  if (permissions.api === false) {
    throw new DashboardLoginError(
      "missing_api_permission",
      "Tài khoản đã xác thực nhưng chưa có quyền MediaMTX `api`.",
      response.status,
    )
  }

  return { credential, permissions, globalConfig }
}

function classifyLoginFailure(status: number): { code: LoginFailureCode; message: string } {
  if (status === 401) {
    return { code: "invalid_credentials", message: "Tên đăng nhập, mật khẩu hoặc token MediaMTX không hợp lệ." }
  }
  if (status === 403) {
    return { code: "missing_api_permission", message: "Tài khoản đã xác thực nhưng chưa có quyền MediaMTX `api`." }
  }
  return { code: "server_error", message: `MediaMTX từ chối kiểm tra đăng nhập (${status}).` }
}

function resolvePermissionsFromGlobalConfig(globalConfig: unknown, username?: string): Record<string, boolean> {
  if (!username || !globalConfig || typeof globalConfig !== "object") return {}
  const users = (globalConfig as { authInternalUsers?: unknown }).authInternalUsers
  if (!Array.isArray(users)) return {}

  const user = users.find(
    (item) => item && typeof item === "object" && (item as { user?: unknown }).user === username,
  )
  const permissions = user && typeof user === "object" ? (user as { permissions?: unknown }).permissions : null
  if (!Array.isArray(permissions)) return {}

  const resolved: Record<string, boolean> = {}
  const { MEDIAMTX_ACTIONS } = { MEDIAMTX_ACTIONS: ["api", "metrics", "pprof", "publish", "read", "playback"] }
  for (const action of MEDIAMTX_ACTIONS) resolved[action] = false

  for (const permission of permissions) {
    if (!permission || typeof permission !== "object") continue
    const action = (permission as { action?: unknown }).action
    if (typeof action === "string" && MEDIAMTX_ACTIONS.includes(action)) {
      resolved[action] = true
    }
  }

  return resolved
}

function createDashboardSession() {
  throw new Error("createDashboardSession is removed. Use setDashboardSession with metadata only.")
}
