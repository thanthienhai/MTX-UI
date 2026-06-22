import { COOKIE_NAME, deleteServerSession } from "@/lib/server-session"

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

export async function POST(request: Request) {
  const cookieHeader = request.headers.get("cookie") || ""
  const sessionId = extractCookie(cookieHeader, COOKIE_NAME)

  if (sessionId) {
    deleteServerSession(sessionId)
  }

  const clearCookie =
    `${COOKIE_NAME}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Set-Cookie": clearCookie,
    },
  })
}
