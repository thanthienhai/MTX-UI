import { requireDashboardAuth, unauthorizedResponse } from "@/lib/server-auth"

const DEFAULT_PLAYBACK_URL = "http://localhost:9996"

function normalizePlaybackUrl() {
  const configuredUrl =
    process.env.MEDIAMTX_PLAYBACK_URL ||
    process.env.NEXT_PUBLIC_MEDIAMTX_PLAYBACK_URL ||
    DEFAULT_PLAYBACK_URL

  return configuredUrl.trim().replace(/\/+$/, "")
}

/**
 * Build a safe Content-Disposition filename. Strips quotes, CR/LF and
 * anything that isn't filename-safe to prevent header injection.
 */
function safeFilename(base: string, ext: string): string {
  const cleaned = base.replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 120) || "recording"
  return `${cleaned}.${ext}`
}

export async function GET(request: Request) {
  const cred = requireDashboardAuth(request)
  if (!cred) return unauthorizedResponse()

  const { searchParams } = new URL(request.url)
  const path = searchParams.get("path")
  const start = searchParams.get("start")
  const duration = searchParams.get("duration")
  const format = searchParams.get("format") || "fmp4"

  if (!path) {
    return Response.json({ error: "Missing required query parameter: path" }, { status: 400 })
  }

  if (!start) {
    return Response.json({ error: "Missing required query parameter: start" }, { status: 400 })
  }

  const upstreamUrl = new URL("get", `${normalizePlaybackUrl()}/`)
  upstreamUrl.searchParams.set("path", path)
  upstreamUrl.searchParams.set("start", start)
  if (duration) upstreamUrl.searchParams.set("duration", duration)
  upstreamUrl.searchParams.set("format", format === "mp4" ? "mp4" : "fmp4")

  try {
    const response = await fetch(upstreamUrl, {
      cache: "no-store",
      headers: {
        Authorization: cred.mode === "bearer" ? `Bearer ${cred.value}` : `Basic ${cred.value}`,
      },
    })

    if (!response.ok) {
      return Response.json({ error: `Playback server returned ${response.status}` }, { status: response.status })
    }

    const contentType = "video/mp4"
    const filename = safeFilename(`${path}_${start}`, format === "mp4" ? "mp4" : "fmp4")
    const contentDisposition = `attachment; filename="${filename}"`

    return new Response(response.body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": contentDisposition,
        "Cache-Control": "no-store",
      },
    })
  } catch {
    return Response.json({ error: "Không thể kết nối tới Playback Server" }, { status: 502 })
  }
}
