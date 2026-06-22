import { COOKIE_NAME, getServerSession, sessionToSafePayload } from "@/lib/server-session"

export async function GET(request: Request) {
  const cookieHeader = request.headers.get("cookie") || ""
  const sessionId = extractCookie(cookieHeader, COOKIE_NAME)

  if (!sessionId) {
    return Response.json({ authenticated: false }, { status: 401 })
  }

  const session = getServerSession(sessionId)
  if (!session) {
    return Response.json({ authenticated: false }, { status: 401 })
  }

  return Response.json({ authenticated: true, ...sessionToSafePayload(session) })
}

function extractCookie(cookieHeader: string, name: string): string | null {
  if (!cookieHeader) return null
  for (const part of cookieHeader.split(";")) {
    const trimmed = part.trim()
    if (trimmed.startsWith(`${name}=`)) {
      return trimmed.slice(name.length + 1)
    }
  }
  return null
}
