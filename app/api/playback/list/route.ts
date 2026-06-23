import { resolveCredential, unauthorizedResponse } from "@/lib/server-auth"

const DEFAULT_PLAYBACK_URL = "http://localhost:9996"

const normalizePlaybackUrl = () => {
  const configuredUrl =
    process.env.MEDIAMTX_PLAYBACK_URL ||
    process.env.NEXT_PUBLIC_MEDIAMTX_PLAYBACK_URL ||
    DEFAULT_PLAYBACK_URL

  return configuredUrl.trim().replace(/\/+$/, "")
}

export async function GET(request: Request) {
  const cred = await resolveCredential(request)
  if (!cred) return unauthorizedResponse()

  const { searchParams } = new URL(request.url)
  const path = searchParams.get("path")
  const start = searchParams.get("start")
  const end = searchParams.get("end")

  if (!path) {
    return Response.json({ error: "Missing required query parameter: path" }, { status: 400 })
  }

  const upstreamUrl = new URL("list", `${normalizePlaybackUrl()}/`)
  upstreamUrl.searchParams.set("path", path)

  let segments: { start: string; duration: number }[] = []

  try {
    const response = await fetch(upstreamUrl, {
      cache: "no-store",
      headers: {
        Accept: "application/json",
        Authorization: cred.mode === "bearer" ? `Bearer ${cred.value}` : `Basic ${cred.value}`,
      },
    })

    if (!response.ok) {
      return Response.json(
        { error: `Playback server returned ${response.status}`, segments: [], total: 0 },
        { status: response.status },
      )
    }

    const data = await response.json()
    segments = data.segments || data || []
  } catch {
    return Response.json({ error: "Không thể kết nối tới Playback Server", segments: [], total: 0 }, { status: 502 })
  }

  // Filter by time range if provided
  if (start || end) {
    const startMs = start ? new Date(start).getTime() : 0
    const endMs = end ? new Date(end).getTime() : Infinity

    segments = segments.filter((seg) => {
      const segStartMs = new Date(seg.start).getTime()
      const segEndMs = segStartMs + (seg.duration || 0) * 1000
      return segStartMs >= startMs && segEndMs <= endMs
    })
  }

  return Response.json({ segments, total: segments.length })
}
