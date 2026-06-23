import { findEventByToken, verifyEventLoginCode, issueConfigSession, CONFIG_SESSION_COOKIE } from "@/lib/relay-server"

const SESSION_TTL_SECONDS = 2 * 60 * 60

// Only mark the session cookie `Secure` when the request actually arrived over
// HTTPS — keying it off NODE_ENV alone breaks plain-HTTP deployments, where the
// browser silently drops a Secure cookie and the login can never stick (401 loop).
const isHttpsRequest = (request: Request): boolean => {
  const forwarded = request.headers.get("x-forwarded-proto")
  if (forwarded) return forwarded.split(",")[0].trim().toLowerCase() === "https"
  try {
    return new URL(request.url).protocol === "https:"
  } catch {
    return false
  }
}

/**
 * Exchange a login code for a signed, httpOnly session cookie scoped to this
 * event's config API path. The code is verified server-side against the
 * event's stored hash; neither the code nor the hash is ever returned.
 */
export async function POST(request: Request, context: { params: Promise<{ token?: string }> }) {
  const { token } = await context.params
  if (!token) {
    return Response.json({ error: "Not found" }, { status: 404 })
  }

  let code = ""
  try {
    const body = await request.json()
    code = typeof body?.code === "string" ? body.code : ""
  } catch {
    // tolerate empty/invalid body — treated as wrong code below
  }

  let event
  try {
    event = await findEventByToken(token, "config")
  } catch {
    return Response.json({ error: "Upstream unavailable" }, { status: 502 })
  }
  if (!event) {
    return Response.json({ error: "Not found" }, { status: 404 })
  }

  if (!code || !verifyEventLoginCode(event.meta, code)) {
    // Uniform 401 — do not distinguish "no such event" from "wrong code".
    return Response.json({ error: "Mã đăng nhập không đúng" }, { status: 401 })
  }

  const session = issueConfigSession(event.meta.configToken)
  const secure = isHttpsRequest(request) ? "; Secure" : ""
  const cookie =
    `${CONFIG_SESSION_COOKIE}=${session}; HttpOnly; SameSite=Lax` +
    `; Path=/api/public/config/${encodeURIComponent(token)}; Max-Age=${SESSION_TTL_SECONDS}${secure}`

  return Response.json({ ok: true }, { status: 200, headers: { "set-cookie": cookie } })
}
