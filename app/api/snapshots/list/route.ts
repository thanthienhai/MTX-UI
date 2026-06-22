import { listSnapshots, isAuthenticated } from "@/lib/snapshot-utils"

export async function GET(request: Request) {
  if (!(await isAuthenticated(request))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const path = searchParams.get("path")

  if (!path) {
    return Response.json({ error: "Missing required query parameter: path" }, { status: 400 })
  }

  const snapshots = listSnapshots(path)

  return Response.json({ snapshots })
}
