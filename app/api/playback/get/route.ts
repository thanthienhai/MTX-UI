const DEFAULT_PLAYBACK_URL = "http://localhost:9996"

function normalizePlaybackUrl() {
  const configuredUrl =
    process.env.MEDIAMTX_PLAYBACK_URL ||
    process.env.NEXT_PUBLIC_MEDIAMTX_PLAYBACK_URL ||
    DEFAULT_PLAYBACK_URL

  return configuredUrl.trim().replace(/\/+$/, "")
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const path = searchParams.get("path")
  const start = searchParams.get("start")
  const format = searchParams.get("format") || "fmp4"

  if (!path) {
    return Response.json({ error: "Missing required query parameter: path" }, { status: 400 })
  }

  if (!start) {
    return Response.json({ error: "Missing required query parameter: start" }, { status: 400 })
  }

  const encodedPath = encodeURIComponent(path)
  const upstreamUrl = new URL(`${encodedPath}/${encodeURIComponent(start)}`, `${normalizePlaybackUrl()}/`)

  if (format === "mp4") {
    upstreamUrl.searchParams.set("format", "mp4")
  }

  try {
    const response = await fetch(upstreamUrl, {
      cache: "no-store",
    })

    if (!response.ok) {
      return Response.json({ error: `Playback server returned ${response.status}` }, { status: response.status })
    }

    const contentType = format === "mp4" ? "video/mp4" : "video/mp4"
    const contentDisposition =
      format === "mp4"
        ? `attachment; filename="${path}_${start}.mp4"`
        : `attachment; filename="${path}_${start}.fmp4"`

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
