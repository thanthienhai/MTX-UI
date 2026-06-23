import { createEvent, listEventsForAdmin, RelayValidationError } from "@/lib/relay-server"
import { resolveCredential, unauthorizedResponse } from "@/lib/server-auth"

const authHeaderFromCred = async (request: Request): Promise<string | undefined> => {
  const cred = await resolveCredential(request)
  if (!cred) return undefined
  return cred.mode === "bearer" ? `Bearer ${cred.value}` : `Basic ${cred.value}`
}

/** Admin-only: list every relay event with live runtime for the dashboard. */
export async function GET(request: Request) {
  const cred = await resolveCredential(request)
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
  const cred = await resolveCredential(request)
  if (!cred) return unauthorizedResponse()

  let displayName = ""
  let quota = 10
  let path = ""
  try {
    const body = await request.json()
    displayName = typeof body?.displayName === "string" ? body.displayName.trim() : ""
    if (Number.isFinite(body?.quota)) quota = Number(body.quota)
    if (typeof body?.path === "string") path = body.path.trim()
  } catch {
    // fall through to validation
  }

  if (!displayName) {
    return Response.json({ error: "Cần nhập tên sự kiện" }, { status: 400 })
  }

  const authHeader = await authHeaderFromCred(request)
  try {
    const created = await createEvent({ displayName, quota, path }, authHeader)
    return Response.json(created, { status: 201 })
  } catch (err) {
    if (err instanceof RelayValidationError) {
      return Response.json({ error: err.message }, { status: 400 })
    }
    return Response.json({ error: "Không tạo được sự kiện" }, { status: 502 })
  }
}
