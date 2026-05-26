import { getLatestSnapshot, isAuthenticated } from "@/lib/snapshot-utils"

export async function GET(request: Request) {
  if (!isAuthenticated(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const path = searchParams.get("path")
  const doRedirect = searchParams.get("redirect") === "true"

  if (!path) {
    return Response.json({ error: "Missing required query parameter: path" }, { status: 400 })
  }

  const latest = getLatestSnapshot(path)

  if (!latest) {
    if (doRedirect) {
      return Response.json({ error: "No snapshots found" }, { status: 404 })
    }
    return Response.json({ snapshot: null })
  }

  if (doRedirect) {
    return Response.redirect(new URL(latest.url, request.url), 302)
  }

  return Response.json({ snapshot: latest })
}
