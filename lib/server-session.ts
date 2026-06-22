import { randomUUID } from "node:crypto"

const SESSION_TTL_MS = 8 * 60 * 60 * 1000
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000

export interface ServerSession {
  id: string
  credentialMode: "basic" | "bearer"
  credential: string
  username?: string
  permissions: Record<string, boolean>
  createdAt: number
  expiresAt: number
}

const sessions = new Map<string, ServerSession>()

let cleanupTimer: ReturnType<typeof setInterval> | null = null

function startCleanup() {
  if (cleanupTimer) return
  cleanupTimer = setInterval(() => {
    const now = Date.now()
    for (const [id, session] of sessions) {
      if (session.expiresAt <= now) sessions.delete(id)
    }
  }, CLEANUP_INTERVAL_MS)
  if (typeof cleanupTimer?.unref === "function") cleanupTimer.unref()
}

function stopCleanup() {
  if (cleanupTimer) {
    clearInterval(cleanupTimer)
    cleanupTimer = null
  }
}

export function createServerSession(
  credentialMode: "basic" | "bearer",
  credential: string,
  permissions: Record<string, boolean>,
  username?: string,
): ServerSession {
  const now = Date.now()
  const session: ServerSession = {
    id: randomUUID(),
    credentialMode,
    credential,
    username,
    permissions,
    createdAt: now,
    expiresAt: now + SESSION_TTL_MS,
  }
  sessions.set(session.id, session)
  startCleanup()
  return session
}

export function getServerSession(sessionId: string | undefined | null): ServerSession | null {
  if (!sessionId) return null
  const session = sessions.get(sessionId)
  if (!session) return null
  if (session.expiresAt <= Date.now()) {
    sessions.delete(sessionId)
    return null
  }
  return session
}

export function deleteServerSession(sessionId: string | undefined | null): boolean {
  if (!sessionId) return false
  const existed = sessions.has(sessionId)
  sessions.delete(sessionId)
  if (sessions.size === 0) stopCleanup()
  return existed
}

export function sessionToSafePayload(session: ServerSession) {
  return {
    username: session.username ?? null,
    permissions: { ...session.permissions },
    credentialMode: session.credentialMode,
    createdAt: session.createdAt,
    expiresAt: session.expiresAt,
  }
}

export const COOKIE_NAME = "mtx_dashboard_session"
export const SESSION_TTL_SECONDS = Math.floor(SESSION_TTL_MS / 1000)
