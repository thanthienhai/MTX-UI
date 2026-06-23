import { findEventByToken, isValidConfigSession, CONFIG_SESSION_COOKIE } from "@/lib/relay-server"
import { saveAsset, isAllowedMime, fallbackKindForMime } from "@/lib/relay-assets"

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

/** Upload a fallback image/video asset. Requires a valid config session. */
export async function POST(request: Request, context: { params: Promise<{ token?: string }> }) {
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

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return Response.json({ error: "Yêu cầu không hợp lệ" }, { status: 400 })
  }
  const file = form.get("file")
  if (!(file instanceof File)) {
    return Response.json({ error: "Thiếu tệp tải lên" }, { status: 400 })
  }
  const mime = file.type || ""
  if (!isAllowedMime(mime)) {
    return Response.json({ error: "Định dạng không hỗ trợ (chỉ ảnh PNG/JPG/WEBP/GIF hoặc video MP4/WEBM/MOV)" }, { status: 400 })
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer())
    const stored = await saveAsset(buffer, { mime, originalName: file.name })
    return Response.json({
      ok: true,
      id: stored.id,
      name: stored.name,
      mime: stored.mime,
      size: stored.size,
      kind: fallbackKindForMime(stored.mime),
    })
  } catch (err) {
    const code = err instanceof Error ? err.message : "error"
    const msg =
      code === "too_large"
        ? "Tệp quá lớn"
        : code === "empty_file"
          ? "Tệp rỗng"
          : code === "unsupported_type"
            ? "Định dạng không hỗ trợ"
            : "Không lưu được tệp"
    return Response.json({ error: msg }, { status: 400 })
  }
}
