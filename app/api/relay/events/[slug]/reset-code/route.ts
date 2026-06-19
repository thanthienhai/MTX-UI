import { findEventByPath, regenerateEventLoginCode } from "@/lib/relay-server"
import { requireDashboardAuth, unauthorizedResponse } from "@/lib/server-auth"

/**
 * Admin-only: regenerate an event's login code. The new code is returned ONCE
 * (only a salted hash is persisted); the old code stops working immediately.
 */
export async function POST(request: Request, context: { params: Promise<{ slug?: string }> }) {
  const cred = requireDashboardAuth(request)
  if (!cred) return unauthorizedResponse()

  const { slug } = await context.params
  if (!slug) return Response.json({ error: "Thiếu định danh sự kiện" }, { status: 400 })

  const authHeader = request.headers.get("authorization") ?? undefined
  try {
    const event = await findEventByPath(slug)
    if (!event) return Response.json({ error: "Không tìm thấy sự kiện" }, { status: 404 })
    const loginCode = await regenerateEventLoginCode(event, authHeader)
    return Response.json({ ok: true, loginCode })
  } catch {
    return Response.json({ error: "Không đặt lại được mã đăng nhập" }, { status: 502 })
  }
}
