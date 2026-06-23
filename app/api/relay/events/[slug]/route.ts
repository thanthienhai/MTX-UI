import { deleteEvent, findEventByPath } from "@/lib/relay-server"
import { resolveCredential, unauthorizedResponse } from "@/lib/server-auth"

const authHeaderFromCred = async (request: Request): Promise<string | undefined> => {
  const cred = await resolveCredential(request)
  if (!cred) return undefined
  return cred.mode === "bearer" ? `Bearer ${cred.value}` : `Basic ${cred.value}`
}

/**
 * Admin-only: delete a relay event by its path key (= ingest key).
 *
 * The write is forwarded with the logged-in admin's Authorization header so
 * MediaMTX removes the path under their credentials.
 */
export async function DELETE(request: Request, context: { params: Promise<{ slug?: string }> }) {
  const cred = await resolveCredential(request)
  if (!cred) return unauthorizedResponse()

  const { slug } = await context.params
  if (!slug) return Response.json({ error: "Thiếu định danh sự kiện" }, { status: 400 })

  const authHeader = await authHeaderFromCred(request)
  try {
    const event = await findEventByPath(slug)
    if (!event) return Response.json({ error: "Không tìm thấy sự kiện" }, { status: 404 })
    await deleteEvent(event.pathName, authHeader)
    return Response.json({ ok: true })
  } catch {
    return Response.json({ error: "Không xóa được sự kiện" }, { status: 502 })
  }
}
