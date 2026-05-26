/**
 * Server-side helpers to validate that an incoming Next.js Route Handler
 * request carries a MediaMTX dashboard session credential.
 *
 * The dashboard stores the session in browser sessionStorage, so it cannot
 * arrive as a server cookie. Clients MUST explicitly forward an
 * `Authorization` header (Basic or Bearer) on every request to internal
 * routes that need protection. This module only validates the *shape* of
 * the header — credential correctness is delegated to MediaMTX upstream
 * when the request is actually proxied.
 */

export type CredentialMode = "basic" | "bearer"

export interface ParsedCredential {
  mode: CredentialMode
  value: string
}

/**
 * Parse and validate an Authorization header. Returns null if the header is
 * missing, empty, malformed, or uses an unsupported scheme.
 */
export function parseAuthorizationHeader(headerValue: string | null): ParsedCredential | null {
  if (!headerValue) return null
  const trimmed = headerValue.trim()
  if (!trimmed) return null

  const spaceIndex = trimmed.indexOf(" ")
  if (spaceIndex <= 0) return null

  const scheme = trimmed.slice(0, spaceIndex).toLowerCase()
  const value = trimmed.slice(spaceIndex + 1).trim()
  if (!value) return null

  if (scheme === "basic") {
    // base64 of "user:pass" — strict character set check, no decode
    if (!/^[A-Za-z0-9+/=_-]+$/.test(value)) return null
    return { mode: "basic", value }
  }

  if (scheme === "bearer") {
    // JWT-ish — no whitespace, no header injection chars
    if (!/^[A-Za-z0-9._\-+/=]+$/.test(value)) return null
    return { mode: "bearer", value }
  }

  return null
}

/**
 * Convenience: returns true if the request carries a syntactically valid
 * Authorization header. Use as a gate on Route Handlers that must not be
 * publicly callable. Credential is NOT verified against MediaMTX here.
 */
export function requireDashboardAuth(request: Request): ParsedCredential | null {
  return parseAuthorizationHeader(request.headers.get("authorization"))
}

/**
 * Build a Response.json 401 for routes that gate via requireDashboardAuth.
 */
export function unauthorizedResponse() {
  return Response.json({ error: "Unauthorized" }, { status: 401 })
}
