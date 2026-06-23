import { findEventByToken } from "@/lib/relay-server"

/**
 * Token-gated HLS preview proxy for public pages.
 *
 * Visitors hold a status token, not the internal MediaMTX hostname. This route
 * resolves the token to its backing path and streams HLS playlists/segments
 * from the internal HLS server, so the internal host is never exposed and the
 * preview cannot be used to enumerate other paths.
 *
 * Playlists use relative segment names, which resolve against this route's
 * own URL — so sub-requests stay gated by the same token. The original query
 * string is forwarded too, since Low-Latency HLS carries a `?session=` token
 * on child-playlist and part requests that the muxer needs to match.
 */

const DEFAULT_HLS_URL = "http://localhost:8888"

const internalHlsBase = (): string => {
  const configured =
    process.env.MEDIAMTX_HLS_URL || process.env.NEXT_PUBLIC_MEDIAMTX_HLS_URL || DEFAULT_HLS_URL
  return configured.trim().replace(/\/+$/, "")
}

export async function GET(request: Request, context: { params: Promise<{ token?: string; seg?: string[] }> }) {
  const { token, seg = [] } = await context.params
  if (!token) {
    return new Response("Not found", { status: 404 })
  }

  let event
  try {
    event = await findEventByToken(token, "status")
  } catch {
    return new Response("Upstream unavailable", { status: 502 })
  }
  if (!event) {
    return new Response("Not found", { status: 404 })
  }

  // Guard against traversal: only forward simple path segments.
  const safeSeg = seg.filter((s) => s && s !== "." && s !== ".." && !s.includes("/"))
  const tail = safeSeg.length > 0 ? safeSeg.map(encodeURIComponent).join("/") : "index.m3u8"
  // Forward the query string (e.g. LL-HLS `?session=...`) to the muxer.
  const search = new URL(request.url).search
  const upstream = `${internalHlsBase()}/${encodeURIComponent(event.pathName)}/${tail}${search}`

  let res: Response
  try {
    res = await fetch(upstream, { cache: "no-store" })
  } catch {
    return new Response("Upstream unavailable", { status: 502 })
  }

  const headers = new Headers()
  const contentType = res.headers.get("content-type")
  if (contentType) headers.set("content-type", contentType)
  headers.set("cache-control", "no-store")

  return new Response(res.body, { status: res.status, headers })
}
