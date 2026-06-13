import { findEventByToken, buildStatusPayload } from "@/lib/relay-server"

/**
 * Anonymous read-only status feed for a shared event.
 *
 * Reached with only a status token. Returns a secret-free projection: masked
 * destination keys, live runtime, and masked-ish ingest URLs. Never exposes
 * MediaMTX admin credentials, login-code hash, or raw destination keys.
 */
export async function GET(_request: Request, context: { params: Promise<{ token?: string }> }) {
  const { token } = await context.params
  if (!token) {
    return Response.json({ error: "Not found" }, { status: 404 })
  }

  let event
  try {
    event = await findEventByToken(token, "status")
  } catch {
    return Response.json({ error: "Upstream unavailable" }, { status: 502 })
  }

  if (!event) {
    return Response.json({ error: "Not found" }, { status: 404 })
  }

  try {
    const payload = await buildStatusPayload(event)
    return Response.json(payload, { headers: { "cache-control": "no-store" } })
  } catch {
    return Response.json({ error: "Upstream unavailable" }, { status: 502 })
  }
}
