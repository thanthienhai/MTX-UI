import { createEvent, listEventsForAdmin } from "@/lib/relay-server"
import { requireDashboardAuth, unauthorizedResponse } from "@/lib/server-auth"

/** Admin-only: list every relay event with live runtime for the dashboard. */
export async function GET(request: Request) {
  const cred = requireDashboardAuth(request)
  if (!cred) return unauthorizedResponse()
  try {
    const events = await listEventsForAdmin()
    return Response.json({ events }, { headers: { "cache-control": "no-store" } })
  } catch {
    return Response.json({ error: "Không tải được danh sách sự kiện" }, { status: 502 })
  }
}

/**
 * Admin-only: create a new relay event (a MediaMTX path keyed by a secret).
 *
 * Gated by the dashboard auth header, which is forwarded to MediaMTX for the
 * write so the path is created under the logged-in admin's credentials. Returns
 * the freshly generated login code ONCE — it is never recoverable afterwards
 * (only a salted hash is stored).
 */
export async function POST(request: Request) {
  const cred = requireDashboardAuth(request)
  if (!cred) return unauthorizedResponse()

  let displayName = ""
  let quota = 10
  try {
    const body = await request.json()
    displayName = typeof body?.displayName === "string" ? body.displayName.trim() : ""
    if (Number.isFinite(body?.quota)) quota = Number(body.quota)
  } catch {
    // fall through to validation
  }

  if (!displayName) {
    return Response.json({ error: "Cần nhập tên sự kiện" }, { status: 400 })
  }

  const authHeader = request.headers.get("authorization") ?? undefined
  try {
    const created = await createEvent({ displayName, quota }, authHeader)
    return Response.json(created, { status: 201 })
  } catch {
    return Response.json({ error: "Không tạo được sự kiện" }, { status: 502 })
  }
}
