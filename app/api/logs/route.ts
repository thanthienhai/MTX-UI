import fs from "node:fs/promises"
import path from "node:path"
import { isAuthenticated } from "@/lib/snapshot-utils"

const MAX_BYTES = 2 * 1024 * 1024 // 2 MiB tail cap

const resolveAllowedLogFile = (): string | null => {
  const configured = process.env.MEDIAMTX_LOG_FILE
  if (!configured) return null
  return path.resolve(configured)
}

export async function GET(request: Request) {
  if (!(await isAuthenticated(request))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const allowedFile = resolveAllowedLogFile()
  if (!allowedFile) {
    return Response.json(
      {
        error:
          "Log file path chưa cấu hình. Set env MEDIAMTX_LOG_FILE để dashboard có thể đọc log MediaMTX.",
      },
      { status: 503 },
    )
  }

  const { searchParams } = new URL(request.url)
  const bytesParam = Number(searchParams.get("bytes") || "")
  const wantBytes = Number.isFinite(bytesParam) && bytesParam > 0
    ? Math.min(Math.floor(bytesParam), MAX_BYTES)
    : MAX_BYTES

  try {
    const stat = await fs.stat(allowedFile)
    if (!stat.isFile()) {
      return Response.json({ error: "Log path không phải file" }, { status: 400 })
    }
    const start = Math.max(0, stat.size - wantBytes)
    const handle = await fs.open(allowedFile, "r")
    try {
      const buf = Buffer.alloc(stat.size - start)
      await handle.read(buf, 0, buf.length, start)
      return new Response(buf.toString("utf8"), {
        status: 200,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "X-Log-Size": String(stat.size),
          "X-Log-Truncated": start > 0 ? "1" : "0",
          "Cache-Control": "no-store",
        },
      })
    } finally {
      await handle.close()
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return Response.json({ error: `Không đọc được log: ${message}` }, { status: 500 })
  }
}
