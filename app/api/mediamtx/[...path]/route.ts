import { COOKIE_NAME, getServerSession } from "@/lib/server-session"

const DEFAULT_UPSTREAM_API_URL = "http://localhost:9997"

const HOP_BY_HOP_HEADERS = new Set([
  "connection",
  "content-length",
  "host",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
])

function normalizeUpstreamApiUrl() {
  const configuredUrl =
    process.env.MEDIAMTX_API_URL ||
    process.env.NEXT_PUBLIC_MEDIAMTX_SERVER_API_URL ||
    process.env.NEXT_PUBLIC_MEDIAMTX_API_URL ||
    DEFAULT_UPSTREAM_API_URL

  return configuredUrl.trim().replace(/\/+$/, "").replace(/\/v3\/config$/i, "").replace(/\/v3$/i, "")
}

function extractCookie(cookieHeader: string, name: string): string | null {
  if (!cookieHeader) return null
  for (const part of cookieHeader.split(";")) {
    const trimmed = part.trim()
    if (trimmed.startsWith(`${name}=`)) {
      return trimmed.slice(name.length + 1)
    }
  }
  return null
}

function resolveAuthHeader(request: Request): string | null {
  const cookieHeader = request.headers.get("cookie") || ""
  const sessionId = extractCookie(cookieHeader, COOKIE_NAME)
  if (sessionId) {
    const session = getServerSession(sessionId)
    if (session) {
      return session.credentialMode === "bearer" ? `Bearer ${session.credential}` : `Basic ${session.credential}`
    }
  }
  const auth = request.headers.get("authorization")
  return auth || null
}

function buildProxyHeaders(request: Request, authHeader: string | null) {
  const headers = new Headers()

  for (const header of ["accept", "content-type"]) {
    const value = request.headers.get(header)
    if (value) {
      headers.set(header, value)
    }
  }

  if (authHeader) {
    headers.set("authorization", authHeader)
  }

  return headers
}

function responseHeaders(headers: Headers) {
  const responseHeaders = new Headers(headers)

  for (const header of HOP_BY_HOP_HEADERS) {
    responseHeaders.delete(header)
  }

  return responseHeaders
}

async function proxyMediaMtxRequest(request: Request, context: { params: Promise<{ path?: string[] }> }) {
  const { path = [] } = await context.params
  const upstreamUrl = new URL(path.map(encodeURIComponent).join("/"), `${normalizeUpstreamApiUrl()}/`)
  const incomingUrl = new URL(request.url)
  upstreamUrl.search = incomingUrl.search

  const method = request.method.toUpperCase()
  const authHeader = resolveAuthHeader(request)
  const response = await fetch(upstreamUrl, {
    method,
    headers: buildProxyHeaders(request, authHeader),
    body: method === "GET" || method === "HEAD" ? undefined : await request.arrayBuffer(),
    cache: "no-store",
  })

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders(response.headers),
  })
}

export const GET = proxyMediaMtxRequest
export const POST = proxyMediaMtxRequest
export const PUT = proxyMediaMtxRequest
export const PATCH = proxyMediaMtxRequest
export const DELETE = proxyMediaMtxRequest
