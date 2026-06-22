import { findEventByPath, regenerateEventLoginCode } from "@/lib/relay-server"
import { resolveCredential, unauthorizedResponse } from "@/lib/server-auth"

async function authHeaderFromCred(request: Request): Promise<string | undefined> {
  const cred = await resolveCredential(request)
  if (!cred) return undefined
  return cred.mode === "bearer" ? `Bearer ${cred.value}` : `Basic ${cred.value}`
}

/**
 * Admin-only: regenerate an event's login code. The new code is returned ONCE
 * (only a salted hash is persisted); the old code stops working immediately.
 */
export async function POST(request: Request, context: { params: Promise<{ slug?: string }> }) {
  const cred = await resolveCredential(request)
  if (!cred) return unauthorizedResponse()

  const { slug } = await context.params
  if (!slug) return Response.json({ error: "Thiếu định danh sự kiện" }, { status: 400 })

  const authHeader = await authHeaderFromCred(request)
  try {
    const event = await findEventByPath(slug)
    if (!event) return Response.json({ error: "Không tìm thấy sự kiện" }, { status: 404 })
    const loginCode = await regenerateEventLoginCode(event, authHeader)
    return Response.json({ ok: true, loginCode })
  } catch {
    return Response.json({ error: "Không đặt lại được mã đăng nhập" }, { status: 502 })
  }
}
