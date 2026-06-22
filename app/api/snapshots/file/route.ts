import { resolveSnapshotPath, isAuthenticated } from "@/lib/snapshot-utils"
import { existsSync } from "fs"
import { readFile } from "fs/promises"
import { extname } from "path"

const MIME_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
}

export async function GET(request: Request) {
  if (!(await isAuthenticated(request))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const path = searchParams.get("path")
  const name = searchParams.get("name")

  if (!path || !name) {
    return Response.json({ error: "Missing required query parameters: path, name" }, { status: 400 })
  }

  const filePath = resolveSnapshotPath(path, name)
  if (!filePath) {
    return Response.json({ error: "Invalid path or name" }, { status: 400 })
  }

  try {
    if (!existsSync(filePath)) {
      return Response.json({ error: "File not found" }, { status: 404 })
    }

    const ext = extname(name).toLowerCase()
    const contentType = MIME_TYPES[ext] || "application/octet-stream"
    const fileBuffer = await readFile(filePath)

    return new Response(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=3600",
        "Content-Disposition": `inline; filename="${name}"`,
      },
    })
  } catch {
    return Response.json({ error: "Cannot read snapshot file" }, { status: 500 })
  }
}
