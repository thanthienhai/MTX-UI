import { deleteSnapshot, isAuthenticated } from "@/lib/snapshot-utils"

export async function POST(request: Request) {
  if (!(await isAuthenticated(request))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: { path?: string; name?: string }
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  if (!body.path || !body.name) {
    return Response.json({ error: "Missing required fields: path, name" }, { status: 400 })
  }

  const deleted = deleteSnapshot(body.path, body.name)

  if (!deleted) {
    return Response.json({ error: "Snapshot not found or could not be deleted" }, { status: 404 })
  }

  return Response.json({ success: true, message: `Deleted ${body.name}` })
}
