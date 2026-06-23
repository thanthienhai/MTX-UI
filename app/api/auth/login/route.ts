import { createBasicAuthCredential, DashboardLoginError } from "@/lib/auth"
import {
  COOKIE_NAME,
  createServerSession,
  sessionToSafePayload,
  SESSION_TTL_SECONDS,
} from "@/lib/server-session"
import { MEDIAMTX_ACTIONS, normalizeMediaMtxPermissions } from "@/lib/mediamtx-permissions"
import type { MediaMtxAction } from "@/lib/mediamtx-permissions"

const isHttpsRequest = (request: Request): boolean => {
  const proto = request.headers.get("x-forwarded-proto") || ""
  if (proto === "https") return true
  return request.url.startsWith("https://")
}

const resolvePermissionsFromGlobalConfig = (globalConfig: unknown, username?: string): Record<string, boolean> => {
  if (!username || !globalConfig || typeof globalConfig !== "object") return {}

  const users = (globalConfig as { authInternalUsers?: unknown }).authInternalUsers
  if (!Array.isArray(users)) return {}

  const user = users.find(
    (item) => item && typeof item === "object" && (item as { user?: unknown }).user === username,
  )
  const permissions = user && typeof user === "object" ? (user as { permissions?: unknown }).permissions : null
  if (!Array.isArray(permissions)) return {}

  const resolved: Record<string, boolean> = {}
  for (const action of MEDIAMTX_ACTIONS) resolved[action] = false

  for (const permission of permissions) {
    if (!permission || typeof permission !== "object") continue
    const action = (permission as { action?: unknown }).action
    if (typeof action === "string" && MEDIAMTX_ACTIONS.includes(action as MediaMtxAction)) {
      resolved[action as MediaMtxAction] = true
    }
  }

  return resolved
}

const classifyLoginFailure = (status: number): { code: string; message: string } => {
  if (status === 401) {
    return { code: "invalid_credentials", message: "Tên đăng nhập, mật khẩu hoặc token MediaMTX không hợp lệ." }
  }
  if (status === 403) {
    return { code: "missing_api_permission", message: "Tài khoản đã xác thực nhưng chưa có quyền MediaMTX `api`." }
  }
  return { code: "server_error", message: `MediaMTX từ chối kiểm tra đăng nhập (${status}).` }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { credentialMode, username, password, token } = body || {}

    if (credentialMode !== "basic" && credentialMode !== "bearer") {
      return Response.json({ error: "credentialMode must be 'basic' or 'bearer'" }, { status: 400 })
    }

    const credential =
      credentialMode === "basic"
        ? createBasicAuthCredential(username || "", password || "")
        : (token || "").trim()

    if (!credential) {
      return Response.json({ error: "Thiếu thông tin đăng nhập." }, { status: 400 })
    }

    if (credentialMode === "basic" && !username?.trim()) {
      return Response.json({ error: "Thiếu tên người dùng." }, { status: 400 })
    }

    let response: Response
    try {
      const upstreamBase =
        process.env.MEDIAMTX_API_URL ||
        process.env.NEXT_PUBLIC_MEDIAMTX_SERVER_API_URL ||
        process.env.NEXT_PUBLIC_MEDIAMTX_API_URL ||
        "http://localhost:9997"
      const upstreamUrl = `${upstreamBase.replace(/\/+$/, "")}/v3/config/global/get`
      response = await fetch(
        upstreamUrl,
        {
          headers: {
            Accept: "application/json",
            Authorization: credentialMode === "bearer" ? `Bearer ${credential}` : `Basic ${credential}`,
          },
          cache: "no-store",
        },
      )
    } catch {
      return Response.json(
        {
          code: "connection",
          error: "Không thể kết nối MediaMTX hoặc proxy dashboard. Kiểm tra URL API MediaMTX và mạng.",
        },
        { status: 502 },
      )
    }

    let globalConfig: unknown = null
    if (response.headers.get("content-type")?.includes("application/json")) {
      try {
        globalConfig = await response.json()
      } catch {
        globalConfig = null
      }
    }

    if (!response.ok) {
      const failure = classifyLoginFailure(response.status)
      return Response.json({ code: failure.code, error: failure.message }, { status: response.status })
    }

    const permissions = normalizeMediaMtxPermissions(resolvePermissionsFromGlobalConfig(globalConfig, username))
    if (permissions.api === false) {
      return Response.json(
        { code: "missing_api_permission", error: "Tài khoản đã xác thực nhưng chưa có quyền MediaMTX `api`." },
        { status: 403 },
      )
    }

    const session = createServerSession(credentialMode, credential, permissions, username)
    const secure = isHttpsRequest(request) ? "; Secure" : ""
    const cookie =
      `${COOKIE_NAME}=${session.id}; HttpOnly; SameSite=Lax` +
      `; Path=/; Max-Age=${SESSION_TTL_SECONDS}${secure}`

    return new Response(JSON.stringify(sessionToSafePayload(session)), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Set-Cookie": cookie,
      },
    })
  } catch (err) {
    if (err instanceof DashboardLoginError) {
      return Response.json({ code: err.code, error: err.userMessage }, { status: err.status || 401 })
    }
    if (err instanceof SyntaxError) {
      return Response.json({ error: "Yêu cầu không đúng định dạng JSON." }, { status: 400 })
    }
    return Response.json({ error: "Lỗi máy chủ nội bộ." }, { status: 500 })
  }
}
