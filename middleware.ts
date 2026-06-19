import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

// This app uses zero Server Actions — every mutation goes through /api route
// handlers via fetch. Bots/scanners routinely POST a forged `Next-Action`
// header (e.g. value "x") to page routes, which Next's action router cannot
// resolve and logs as `Failed to find Server Action "x"`. Short-circuit those
// requests so they never reach the action router and never spam the logs.
export function middleware(req: NextRequest) {
  if (req.method === "POST" && req.headers.has("next-action")) {
    return new NextResponse(null, { status: 404 })
  }
  return NextResponse.next()
}

export const config = {
  // Skip static assets and image optimizer; only inspect real page/route traffic.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
