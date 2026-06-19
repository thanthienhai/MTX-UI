import { Readable } from "node:stream"
import { getAssetForServe } from "@/lib/relay-assets"

export const runtime = "nodejs"

/**
 * Serve a stored fallback asset by id. Unauthenticated by design: the id is a
 * 128-bit random secret and the MediaMTX-side ffmpeg fetches this with no creds.
 * Supports Range so video players / ffmpeg can seek.
 */
export async function GET(request: Request, context: { params: Promise<{ id?: string }> }) {
  const { id } = await context.params
  const asset = id ? await getAssetForServe(id) : null
  if (!asset) return new Response("Not found", { status: 404 })

  const range = request.headers.get("range")
  const match = range ? /^bytes=(\d*)-(\d*)$/.exec(range.trim()) : null

  const baseHeaders: Record<string, string> = {
    "content-type": asset.mime,
    "accept-ranges": "bytes",
    "cache-control": "public, max-age=31536000, immutable",
  }

  if (match) {
    const startRaw = match[1]
    const endRaw = match[2]
    let start = startRaw ? parseInt(startRaw, 10) : 0
    let end = endRaw ? parseInt(endRaw, 10) : asset.size - 1
    if (Number.isNaN(start) || Number.isNaN(end) || start > end || start >= asset.size) {
      return new Response("Range Not Satisfiable", {
        status: 416,
        headers: { "content-range": `bytes */${asset.size}` },
      })
    }
    end = Math.min(end, asset.size - 1)
    const nodeStream = asset.createStream({ start, end })
    return new Response(Readable.toWeb(nodeStream) as unknown as ReadableStream, {
      status: 206,
      headers: {
        ...baseHeaders,
        "content-range": `bytes ${start}-${end}/${asset.size}`,
        "content-length": String(end - start + 1),
      },
    })
  }

  const nodeStream = asset.createStream()
  return new Response(Readable.toWeb(nodeStream) as unknown as ReadableStream, {
    status: 200,
    headers: { ...baseHeaders, "content-length": String(asset.size) },
  })
}
