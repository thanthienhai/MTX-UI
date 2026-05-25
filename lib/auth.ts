import { buildMediaMtxApiUrl } from "./mediamtx-url.mjs"
import {
  MEDIAMTX_ACTIONS,
  getDefaultMediaMtxPermissions,
  normalizeMediaMtxPermissions,
  type MediaMtxAction,
  type MediaMtxPermissionSet,
} from "./mediamtx-permissions"

export type DashboardCredentialMode = "basic" | "bearer"
export type LoginFailureCode = "connection" | "invalid_credentials" | "missing_api_permission" | "server_error"

export interface DashboardSession {
  version: 1
  credentialMode: DashboardCredentialMode
  username?: string
  credential: string
  issuedAt: number
  expiresAt: number
  permissions: Record<MediaMtxAction, boolean>
}

export interface CreateDashboardSessionInput {
  credentialMode: DashboardCredentialMode
  username?: string
  credential: string
  permissions?: MediaMtxPermissionSet
  now?: number
  ttlMs?: number
}

export interface ValidateMediaMtxLoginInput {
  credentialMode: DashboardCredentialMode
  username?: string
  password?: string
  token?: string
  ttlMs?: number
  fetchImpl?: typeof fetch
}

export interface ValidateMediaMtxLoginResult {
  session: DashboardSession
  globalConfig: unknown
}

const DASHBOARD_SESSION_KEY = "mediamtx_dashboard_session"
const LEGACY_AUTH_KEY = "mediamtx_auth"
const LEGACY_USERNAME_KEY = "mediamtx_username"
const DEFAULT_SESSION_TTL_MS = 8 * 60 * 60 * 1000

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

function readLegacySession(now = Date.now()): DashboardSession | null {
  const storage = getBrowserSessionStorage()
  const credential = storage?.getItem(LEGACY_AUTH_KEY)
  if (!credential) return null

  return createDashboardSession({
    credentialMode: "basic",
    username: storage?.getItem(LEGACY_USERNAME_KEY) || undefined,
    credential,
    now,
  })
}

function parseDashboardSession(raw: string | null): DashboardSession | null {
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw) as Partial<DashboardSession>
    if (parsed.version !== 1) return null
    if (parsed.credentialMode !== "basic" && parsed.credentialMode !== "bearer") return null
    if (typeof parsed.credential !== "string" || !parsed.credential) return null
    if (typeof parsed.issuedAt !== "number" || typeof parsed.expiresAt !== "number") return null

    return {
      version: 1,
      credentialMode: parsed.credentialMode,
      username: typeof parsed.username === "string" ? parsed.username : undefined,
      credential: parsed.credential,
      issuedAt: parsed.issuedAt,
      expiresAt: parsed.expiresAt,
      permissions: normalizeMediaMtxPermissions(parsed.permissions),
    }
  } catch {
    return null
  }
}

export function createBasicAuthCredential(username: string, password: string) {
  const value = `${username}:${password}`
  if (typeof window !== "undefined" && window.btoa) return window.btoa(value)
  return Buffer.from(value, "utf8").toString("base64")
}

export function createDashboardSession({
  credentialMode,
  username,
  credential,
  permissions,
  now = Date.now(),
  ttlMs = DEFAULT_SESSION_TTL_MS,
}: CreateDashboardSessionInput): DashboardSession {
  return {
    version: 1,
    credentialMode,
    username: username?.trim() || undefined,
    credential,
    issuedAt: now,
    expiresAt: now + ttlMs,
    permissions: normalizeMediaMtxPermissions(permissions),
  }
}

export function setDashboardSession(session: DashboardSession, adapter = dashboardSessionStorageAdapter) {
  adapter.write(JSON.stringify(session))
  const storage = getBrowserSessionStorage()
  storage?.removeItem(LEGACY_AUTH_KEY)
  storage?.removeItem(LEGACY_USERNAME_KEY)
}

export function getDashboardSession(adapter = dashboardSessionStorageAdapter, now = Date.now()): DashboardSession | null {
  const session = parseDashboardSession(adapter.read()) || readLegacySession(now)
  if (!session) return null

  if (isSessionExpired(session, now)) {
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

export function isAuthenticated(): boolean {
  return getDashboardSession() !== null
}

export function getAuthToken(): string | null {
  return getDashboardSession()?.credential ?? null
}

export function getUsername(): string | null {
  return getDashboardSession()?.username ?? null
}

export function setAuthToken(token: string, username: string) {
  setDashboardSession(createDashboardSession({ credentialMode: "basic", username, credential: token }))
}

export function getAuthHeader(session = getDashboardSession()): string {
  if (!session) return ""
  return session.credentialMode === "bearer" ? `Bearer ${session.credential}` : `Basic ${session.credential}`
}

export function getSessionPermissions(session = getDashboardSession()) {
  return session?.permissions ?? getDefaultMediaMtxPermissions()
}

function classifyLoginFailure(status: number): { code: LoginFailureCode; message: string } {
  if (status === 401) {
    return { code: "invalid_credentials", message: "Invalid MediaMTX username/password or token." }
  }

  if (status === 403) {
    return { code: "missing_api_permission", message: "This user is authenticated but does not have MediaMTX api permission." }
  }

  return { code: "server_error", message: `MediaMTX rejected the login probe (${status}).` }
}

function resolvePermissionsFromGlobalConfig(globalConfig: unknown, username?: string): MediaMtxPermissionSet {
  if (!username || !globalConfig || typeof globalConfig !== "object") return getDefaultMediaMtxPermissions()

  const users = (globalConfig as { authInternalUsers?: unknown }).authInternalUsers
  if (!Array.isArray(users)) return getDefaultMediaMtxPermissions()

  const user = users.find((item) => item && typeof item === "object" && (item as { user?: unknown }).user === username)
  const permissions = user && typeof user === "object" ? (user as { permissions?: unknown }).permissions : null
  if (!Array.isArray(permissions)) return getDefaultMediaMtxPermissions()

  const resolved: MediaMtxPermissionSet = {}
  for (const action of MEDIAMTX_ACTIONS) resolved[action] = false

  for (const permission of permissions) {
    if (!permission || typeof permission !== "object") continue
    const action = (permission as { action?: unknown }).action
    if (typeof action === "string" && MEDIAMTX_ACTIONS.includes(action as MediaMtxAction)) {
      resolved[action as MediaMtxAction] = true
    }
  }

  return resolved
}

export async function validateMediaMtxLogin({
  credentialMode,
  username,
  password,
  token,
  ttlMs,
  fetchImpl = fetch,
}: ValidateMediaMtxLoginInput): Promise<ValidateMediaMtxLoginResult> {
  const credential =
    credentialMode === "basic" ? createBasicAuthCredential(username || "", password || "") : (token || "").trim()

  if (!credential) {
    throw new DashboardLoginError("invalid_credentials", "Enter MediaMTX credentials before signing in.")
  }

  if (credentialMode === "basic" && !username?.trim()) {
    throw new DashboardLoginError("invalid_credentials", "Enter a MediaMTX username before signing in.")
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
      "Failed to connect to MediaMTX or the dashboard proxy. Check the MediaMTX API URL and network.",
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

  const permissions = normalizeMediaMtxPermissions(resolvePermissionsFromGlobalConfig(globalConfig, username))
  if (permissions.api === false) {
    throw new DashboardLoginError(
      "missing_api_permission",
      "This user is authenticated but does not have MediaMTX api permission.",
      response.status,
    )
  }

  return {
    globalConfig,
    session: createDashboardSession({
      credentialMode,
      username,
      credential,
      permissions,
      ttlMs,
    }),
  }
}
