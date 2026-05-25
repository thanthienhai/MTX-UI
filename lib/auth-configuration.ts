import type { AuthInternalUser, AuthInternalUserPermission, GlobalConf } from "./mediamtx-api"

export const AUTH_ACTIONS = ["publish", "read", "playback", "api", "metrics", "pprof"] as const
export type AuthAction = (typeof AUTH_ACTIONS)[number]
export type AuthMethod = "internal" | "http" | "jwt"

export interface PermissionRow {
  id: string
  action: AuthAction
  path: string
  isRegex: boolean
}

export interface InternalUserForm {
  id: string
  user: string
  storedPass?: string
  passwordReplacement: string
  ipsText: string
  permissions: PermissionRow[]
}

export interface AuthConfigurationForm {
  authMethod: AuthMethod
  internalUsers: InternalUserForm[]
  http: {
    address: string
    fingerprint: string
    exclude: PermissionRow[]
  }
  jwt: {
    jwks: string
    jwksFingerprint: string
    claimKey: string
    issuer: string
    audience: string
    exclude: PermissionRow[]
  }
}

export interface AuthValidationResult {
  valid: boolean
  fieldErrors: Record<string, string>
}

const AUTH_PATCH_KEYS = [
  "authMethod",
  "authInternalUsers",
  "authHTTPAddress",
  "authHTTPFingerprint",
  "authHTTPExclude",
  "authJWTJWKS",
  "authJWTJWKSFingerprint",
  "authJWTClaimKey",
  "authJWTExclude",
  "authJWTIssuer",
  "authJWTAudience",
] as const

function createId(prefix: string, index: number) {
  return `${prefix}-${index}`
}

export function normalizeAuthMethod(value: unknown): AuthMethod {
  return value === "http" || value === "jwt" || value === "internal" ? value : "internal"
}

export function createPermissionRow(permission?: AuthInternalUserPermission, index = 0): PermissionRow {
  const action = AUTH_ACTIONS.includes(permission?.action as AuthAction) ? (permission?.action as AuthAction) : "read"
  const path = permission?.path || ""

  return {
    id: createId("perm", index),
    action,
    path,
    isRegex: path.startsWith("~") || path.startsWith("^") || path.includes(".*"),
  }
}

export function serializePermissionRows(rows: PermissionRow[]): AuthInternalUserPermission[] {
  return rows
    .filter((row) => AUTH_ACTIONS.includes(row.action))
    .map((row) => {
      const path = row.path.trim()
      return path ? { action: row.action, path } : { action: row.action }
    })
}

export function createEmptyInternalUser(index = 0): InternalUserForm {
  return {
    id: createId("user", index),
    user: "",
    passwordReplacement: "",
    ipsText: "",
    permissions: [],
  }
}

export function mapInternalUserToForm(user: AuthInternalUser, index: number): InternalUserForm {
  return {
    id: createId("user", index),
    user: user.user || "",
    storedPass: user.pass,
    passwordReplacement: "",
    ipsText: (user.ips || []).join("\n"),
    permissions: (user.permissions || []).map((permission, permissionIndex) =>
      createPermissionRow(permission, permissionIndex),
    ),
  }
}

export function mapGlobalConfigToAuthForm(config: GlobalConf | null | undefined): AuthConfigurationForm {
  return {
    authMethod: normalizeAuthMethod(config?.authMethod),
    internalUsers: (config?.authInternalUsers || []).map(mapInternalUserToForm),
    http: {
      address: config?.authHTTPAddress || "",
      fingerprint: config?.authHTTPFingerprint || "",
      exclude: (config?.authHTTPExclude || []).map(createPermissionRow),
    },
    jwt: {
      jwks: config?.authJWTJWKS || "",
      jwksFingerprint: config?.authJWTJWKSFingerprint || "",
      claimKey: config?.authJWTClaimKey || "",
      issuer: config?.authJWTIssuer || "",
      audience: config?.authJWTAudience || "",
      exclude: (config?.authJWTExclude || []).map(createPermissionRow),
    },
  }
}

export function serializeInternalUser(user: InternalUserForm): AuthInternalUser {
  const payload: AuthInternalUser = {
    user: user.user.trim(),
  }
  const replacement = user.passwordReplacement.trim()
  if (replacement) payload.pass = replacement
  else if (user.storedPass) payload.pass = user.storedPass

  const ips = user.ipsText
    .split(/\r?\n|,/)
    .map((ip) => ip.trim())
    .filter(Boolean)
  if (ips.length > 0) payload.ips = ips

  const permissions = serializePermissionRows(user.permissions)
  if (permissions.length > 0) payload.permissions = permissions

  return payload
}

export function serializeAuthForm(form: AuthConfigurationForm): Pick<
  GlobalConf,
  | "authMethod"
  | "authInternalUsers"
  | "authHTTPAddress"
  | "authHTTPFingerprint"
  | "authHTTPExclude"
  | "authJWTJWKS"
  | "authJWTJWKSFingerprint"
  | "authJWTClaimKey"
  | "authJWTExclude"
  | "authJWTIssuer"
  | "authJWTAudience"
> {
  return {
    authMethod: form.authMethod,
    authInternalUsers: form.internalUsers.map(serializeInternalUser),
    authHTTPAddress: form.http.address.trim(),
    authHTTPFingerprint: form.http.fingerprint.trim(),
    authHTTPExclude: serializePermissionRows(form.http.exclude),
    authJWTJWKS: form.jwt.jwks.trim(),
    authJWTJWKSFingerprint: form.jwt.jwksFingerprint.trim(),
    authJWTClaimKey: form.jwt.claimKey.trim(),
    authJWTExclude: serializePermissionRows(form.jwt.exclude),
    authJWTIssuer: form.jwt.issuer.trim(),
    authJWTAudience: form.jwt.audience.trim(),
  }
}

function stableStringify(value: unknown) {
  return JSON.stringify(value ?? null)
}

export function buildAuthConfigurationPatch(
  originalConfig: GlobalConf | null | undefined,
  currentForm: AuthConfigurationForm,
): Partial<GlobalConf> {
  const original = serializeAuthForm(mapGlobalConfigToAuthForm(originalConfig))
  const current = serializeAuthForm(currentForm)
  const patch: Partial<GlobalConf> = {}

  for (const key of AUTH_PATCH_KEYS) {
    if (stableStringify(original[key]) !== stableStringify(current[key])) {
      patch[key] = current[key] as never
    }
  }

  return patch
}

export function createPermissionRowForAction(action: AuthAction): PermissionRow {
  return {
    id: `${action}-${Date.now()}`,
    action,
    path: "",
    isRegex: false,
  }
}

export function validateAuthForm(form: AuthConfigurationForm): AuthValidationResult {
  const fieldErrors: Record<string, string> = {}
  const users = new Set<string>()

  form.internalUsers.forEach((user, index) => {
    const label = `internalUsers.${index}`
    const username = user.user.trim()
    if (!username) fieldErrors[`${label}.user`] = "Tên người dùng là bắt buộc"
    if (username && users.has(username)) fieldErrors[`${label}.user`] = "Tên người dùng bị trùng"
    users.add(username)

    for (const ip of user.ipsText.split(/\r?\n|,/).map((value) => value.trim())) {
      if (ip.includes(" ")) fieldErrors[`${label}.ips`] = "IP allowlist không được chứa khoảng trắng"
    }

    user.permissions.forEach((permission, permissionIndex) => {
      if (!AUTH_ACTIONS.includes(permission.action)) {
        fieldErrors[`${label}.permissions.${permissionIndex}.action`] = "Quyền không hợp lệ"
      }
      if (permission.isRegex && !permission.path.trim()) {
        fieldErrors[`${label}.permissions.${permissionIndex}.path`] = "Regex path là bắt buộc"
      }
    })
  })

  if (form.authMethod === "http" && !form.http.address.trim()) {
    fieldErrors["http.address"] = "HTTP auth address là bắt buộc"
  }

  if (form.authMethod === "jwt" && !form.jwt.jwks.trim()) {
    fieldErrors["jwt.jwks"] = "JWT JWKS URL là bắt buộc"
  }

  if (form.authMethod === "jwt" && !form.jwt.claimKey.trim()) {
    fieldErrors["jwt.claimKey"] = "JWT claim key là bắt buộc"
  }

  return {
    valid: Object.keys(fieldErrors).length === 0,
    fieldErrors,
  }
}
