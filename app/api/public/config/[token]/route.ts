import {
  findEventByToken,
  buildConfigPayload,
  isValidConfigSession,
  CONFIG_SESSION_COOKIE,
  setEventRecord,
  setEventRelay,
  rotateEventStreamId,
  changeEventLoginCode,
  addEventDestination,
  updateEventDestination,
  deleteEventDestination,
  rotateEventStatusToken,
  rotateEventConfigToken,
  regenerateEventLoginCode,
  setEventFallback,
} from "@/lib/relay-server"

/** Hostname (no port) the owner reached this page on — used as the ingest-URL
 * host when no explicit NEXT_PUBLIC_MEDIAMTX_*_HOST is configured. Prefers the
 * proxy-forwarded host, then the Host header. */
const requestHostname = (request: Request): string | undefined => {
  const raw = request.headers.get("x-forwarded-host") || request.headers.get("host") || ""
  const first = raw.split(",")[0].trim()
  if (!first) return undefined
  // Strip a trailing :port (leaves bracketed IPv6 literals intact).
  return first.replace(/:\d+$/, "")
}

const readCookie = (request: Request, name: string): string | undefined => {
  const header = request.headers.get("cookie")
  if (!header) return undefined
  for (const part of header.split(";")) {
    const eq = part.indexOf("=")
    if (eq === -1) continue
    if (part.slice(0, eq).trim() === name) return part.slice(eq + 1).trim()
  }
  return undefined
}

const clearedCookie = (token: string): string => {
  return `${CONFIG_SESSION_COOKIE}=; HttpOnly; SameSite=Lax; Path=/api/public/config/${encodeURIComponent(token)}; Max-Age=0`
}

/** GET full owner config state. Requires a valid session cookie. */
export async function GET(request: Request, context: { params: Promise<{ token?: string }> }) {
  const { token } = await context.params
  if (!token) return Response.json({ error: "Not found" }, { status: 404 })

  let event
  try {
    event = await findEventByToken(token, "config")
  } catch {
    return Response.json({ error: "Upstream unavailable" }, { status: 502 })
  }
  if (!event) return Response.json({ error: "Not found" }, { status: 404 })

  const session = readCookie(request, CONFIG_SESSION_COOKIE)
  if (!isValidConfigSession(session, event.meta.configToken)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const payload = await buildConfigPayload(event, requestHostname(request))
    return Response.json(payload, { headers: { "cache-control": "no-store" } })
  } catch {
    return Response.json({ error: "Upstream unavailable" }, { status: 502 })
  }
}

/** POST an action. All actions require a valid session cookie. */
export async function POST(request: Request, context: { params: Promise<{ token?: string }> }) {
  const { token } = await context.params
  if (!token) return Response.json({ error: "Not found" }, { status: 404 })

  let body: Record<string, unknown> = {}
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    // empty body allowed for some actions
  }
  const action = typeof body.action === "string" ? body.action : ""

  // Logout needs no upstream lookup.
  if (action === "logout") {
    return Response.json({ ok: true }, { headers: { "set-cookie": clearedCookie(token) } })
  }

  let event
  try {
    event = await findEventByToken(token, "config")
  } catch {
    return Response.json({ error: "Upstream unavailable" }, { status: 502 })
  }
  if (!event) return Response.json({ error: "Not found" }, { status: 404 })

  const session = readCookie(request, CONFIG_SESSION_COOKIE)
  if (!isValidConfigSession(session, event.meta.configToken)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    switch (action) {
      case "set_record":
        await setEventRecord(event, !!body.enabled)
        return Response.json({ ok: true })
      case "set_relay":
        await setEventRelay(event, !!body.enabled)
        return Response.json({ ok: true })
      case "rotate_stream_id": {
        const slug = await rotateEventStreamId(event)
        return Response.json({ ok: true, slug })
      }
      case "change_config_code": {
        const newCode = typeof body.newCode === "string" ? body.newCode : ""
        if (newCode.length < 6) {
          return Response.json({ error: "Mã mới phải có ít nhất 6 ký tự" }, { status: 400 })
        }
        await changeEventLoginCode(event, newCode)
        return Response.json({ ok: true }, { headers: { "set-cookie": clearedCookie(token) } })
      }
      case "regenerate_login_code": {
        const code = await regenerateEventLoginCode(event)
        return Response.json({ ok: true, loginCode: code }, { headers: { "set-cookie": clearedCookie(token) } })
      }
      case "add_destination": {
        const r = await addEventDestination(event, body as never)
        if (!r.ok) return Response.json({ error: r.error }, { status: 400 })
        return Response.json({ ok: true })
      }
      case "update_destination": {
        const id = typeof body.id === "string" ? body.id : ""
        if (!id) return Response.json({ error: "Thiếu id" }, { status: 400 })
        const patch = (body.patch && typeof body.patch === "object" ? body.patch : {}) as Record<string, unknown>
        const r = await updateEventDestination(event, id, patch as never)
        if (!r.ok) return Response.json({ error: r.error }, { status: 400 })
        return Response.json({ ok: true })
      }
      case "delete_destination": {
        const id = typeof body.id === "string" ? body.id : ""
        if (!id) return Response.json({ error: "Thiếu id" }, { status: 400 })
        await deleteEventDestination(event, id)
        return Response.json({ ok: true })
      }
      case "rotate_status_token": {
        const statusToken = await rotateEventStatusToken(event)
        return Response.json({ ok: true, statusToken })
      }
      case "set_fallback": {
        const r = await setEventFallback(event, {
          type: typeof body.type === "string" ? body.type : "none",
          enabled: body.enabled !== false,
          text: typeof body.text === "string" ? body.text : undefined,
          assetRef: typeof body.assetRef === "string" ? body.assetRef : undefined,
          assetName: typeof body.assetName === "string" ? body.assetName : undefined,
          assetMime: typeof body.assetMime === "string" ? body.assetMime : undefined,
        })
        if (!r.ok) return Response.json({ error: r.error }, { status: 400 })
        return Response.json({ ok: true })
      }
      case "rotate_config_token": {
        const configToken = await rotateEventConfigToken(event)
        // Old session cookie is bound to the old token — kill it.
        return Response.json(
          { ok: true, configToken },
          { headers: { "set-cookie": clearedCookie(token) } },
        )
      }
      default:
        return Response.json({ error: "Hành động không hợp lệ" }, { status: 400 })
    }
  } catch {
    return Response.json({ error: "Thao tác thất bại" }, { status: 502 })
  }
}
