"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { ErrorState, LoadingState } from "@/components/module-state"
import { useNotifications } from "@/components/notification-provider"
import {
  AUTH_ACTIONS,
  buildAuthConfigurationPatch,
  createEmptyInternalUser,
  createPermissionRowForAction,
  mapGlobalConfigToAuthForm,
  type AuthAction,
  type AuthConfigurationForm,
  type AuthMethod,
  type InternalUserForm,
  type PermissionRow,
  validateAuthForm,
} from "@/lib/auth-configuration"
import * as api from "@/lib/mediamtx-api"
import type { GlobalConf } from "@/lib/mediamtx-api"
import { requireMediaMtxAction, type MediaMtxPermissionSet } from "@/lib/mediamtx-permissions"
import type { DashboardAuditEvent } from "@/lib/dashboard-audit"
import { Plus, RefreshCw, Save, TestTube2, Trash2 } from "lucide-react"

interface AuthConfigurationViewProps {
  permissions: MediaMtxPermissionSet
  username?: string | null
  appendAuditEvent?: (event: Omit<DashboardAuditEvent, "id" | "timestamp">) => void
}

const textareaClassName =
  "min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"

function formatTimestamp(iso: string | null) {
  if (!iso) return "Chưa có"
  try {
    return new Date(iso).toLocaleTimeString()
  } catch {
    return "Không rõ"
  }
}

function updatePermission(rows: PermissionRow[], action: AuthAction, updates: Partial<PermissionRow>) {
  const existing = rows.find((row) => row.action === action)
  if (!existing) return [...rows, { ...createPermissionRowForAction(action), ...updates }]
  return rows.map((row) => (row.action === action ? { ...row, ...updates } : row))
}

function removePermission(rows: PermissionRow[], action: AuthAction) {
  return rows.filter((row) => row.action !== action)
}

function PermissionMatrix({
  label,
  rows,
  disabled,
  fieldPrefix,
  fieldErrors,
  onChange,
}: {
  label: string
  rows: PermissionRow[]
  disabled: boolean
  fieldPrefix: string
  fieldErrors: Record<string, string>
  onChange: (rows: PermissionRow[]) => void
}) {
  return (
    <div className="space-y-3">
      <Label>{label}</Label>
      <div className="overflow-x-auto rounded-md border">
        <div className="min-w-[680px] divide-y">
          {AUTH_ACTIONS.map((action) => {
            const row = rows.find((item) => item.action === action)
            const isEnabled = Boolean(row)
            const pathError = fieldErrors[`${fieldPrefix}.${action}.path`]
            return (
              <div key={action} className="grid grid-cols-[120px_90px_1fr_120px] items-start gap-3 p-3">
                <div className="pt-2 font-mono text-sm">{action}</div>
                <div className="pt-1">
                  <Switch
                    checked={isEnabled}
                    disabled={disabled}
                    onCheckedChange={(checked) =>
                      onChange(checked ? updatePermission(rows, action, {}) : removePermission(rows, action))
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Input
                    value={row?.path || ""}
                    disabled={disabled || !isEnabled}
                    placeholder="Path tùy chọn"
                    onChange={(event) => onChange(updatePermission(rows, action, { path: event.target.value }))}
                  />
                  {pathError ? <p className="text-xs text-[#cf202f]">{pathError}</p> : null}
                </div>
                <div className="flex items-center gap-2 pt-2">
                  <Switch
                    checked={row?.isRegex || false}
                    disabled={disabled || !isEnabled}
                    onCheckedChange={(checked) => onChange(updatePermission(rows, action, { isRegex: checked }))}
                  />
                  <span className="text-xs text-muted-foreground">Regex</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export function AuthConfigurationView({ permissions, username, appendAuditEvent }: AuthConfigurationViewProps) {
  const { notify } = useNotifications()
  const canUseApi = permissions.api !== false
  const [originalConfig, setOriginalConfig] = useState<GlobalConf | null>(null)
  const [form, setForm] = useState<AuthConfigurationForm>(() => mapGlobalConfigToAuthForm(null))
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isTestingHttp, setIsTestingHttp] = useState(false)
  const [isRefreshingJwks, setIsRefreshingJwks] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [patchPreview, setPatchPreview] = useState<Partial<GlobalConf> | null>(null)
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null)

  const patch = useMemo(() => buildAuthConfigurationPatch(originalConfig, form), [form, originalConfig])
  const hasPatch = Object.keys(patch).length > 0

  const fetchAuthConfig = useCallback(async () => {
    if (!canUseApi) return
    setIsLoading(true)
    setLoadError(null)
    try {
      const config = await api.getGlobalConfig()
      setOriginalConfig(config)
      setForm(mapGlobalConfigToAuthForm(config))
      setFieldErrors({})
      setPatchPreview(null)
      setLastSyncedAt(new Date().toISOString())
    } catch (error) {
      const message = api.getMediaMtxErrorMessage(error)
      setLoadError(message)
      notify({ type: "error", title: "Không thể tải cấu hình xác thực", message })
    } finally {
      setIsLoading(false)
    }
  }, [canUseApi, notify])

  useEffect(() => {
    fetchAuthConfig()
  }, [fetchAuthConfig])

  const updateForm = (updater: (current: AuthConfigurationForm) => AuthConfigurationForm) => {
    setForm((current) => updater(current))
    setPatchPreview(null)
  }

  const updateUser = (userId: string, updater: (user: InternalUserForm) => InternalUserForm) => {
    updateForm((current) => ({
      ...current,
      internalUsers: current.internalUsers.map((user) => (user.id === userId ? updater(user) : user)),
    }))
  }

  const showPreview = () => {
    const validation = validateAuthForm(form)
    setFieldErrors(validation.fieldErrors)
    if (!validation.valid) {
      notify({ type: "error", title: "Cấu hình xác thực chưa hợp lệ", message: "Kiểm tra các trường bị lỗi." })
      return
    }
    setPatchPreview(patch)
  }

  const saveAuthConfig = async () => {
    const validation = validateAuthForm(form)
    setFieldErrors(validation.fieldErrors)
    if (!validation.valid) {
      notify({ type: "error", title: "Cấu hình xác thực chưa hợp lệ", message: "Kiểm tra các trường bị lỗi." })
      return
    }
    if (!hasPatch) {
      notify({ type: "info", title: "Không có thay đổi để lưu" })
      return
    }

    setIsSaving(true)
    try {
      requireMediaMtxAction(permissions, "api")
      await api.patchAuthConfiguration(patch)
      const refreshed = await api.getGlobalConfig()
      setOriginalConfig(refreshed)
      setForm(mapGlobalConfigToAuthForm(refreshed))
      setPatchPreview(null)
      setLastSyncedAt(new Date().toISOString())
      notify({ type: "success", title: "Đã cập nhật xác thực", message: "Cấu hình auth đã được patch." })
      appendAuditEvent?.({
        actor: username,
        action: "auth.config.patch",
        target: "global",
        payloadSummary: JSON.stringify(patch),
        result: "success",
      })
    } catch (error) {
      const message = api.getMediaMtxErrorMessage(error)
      notify({ type: "error", title: "Không thể cập nhật xác thực", message })
      appendAuditEvent?.({
        actor: username,
        action: "auth.config.patch",
        target: "global",
        payloadSummary: JSON.stringify(patch),
        result: "failure",
        errorSummary: message,
      })
    } finally {
      setIsSaving(false)
    }
  }

  const testHttpAuth = async () => {
    setIsTestingHttp(true)
    try {
      requireMediaMtxAction(permissions, "api")
      await api.testHttpAuthEndpoint({
        address: form.http.address.trim(),
        fingerprint: form.http.fingerprint.trim() || undefined,
        action: "api",
        path: "",
        user: username || undefined,
      })
      notify({ type: "success", title: "HTTP auth test thành công" })
      appendAuditEvent?.({ actor: username, action: "auth.http.test", target: "http", result: "success" })
    } catch (error) {
      const message = api.getMediaMtxErrorMessage(error)
      notify({ type: "error", title: "HTTP auth test thất bại", message })
      appendAuditEvent?.({
        actor: username,
        action: "auth.http.test",
        target: "http",
        result: "failure",
        errorSummary: message,
      })
    } finally {
      setIsTestingHttp(false)
    }
  }

  const refreshJwks = async () => {
    setIsRefreshingJwks(true)
    try {
      requireMediaMtxAction(permissions, "api")
      await api.refreshJwks()
      notify({ type: "success", title: "Đã refresh JWKS" })
      appendAuditEvent?.({ actor: username, action: "auth.jwks.refresh", target: "jwks", result: "success" })
    } catch (error) {
      const message = api.getMediaMtxErrorMessage(error)
      notify({ type: "error", title: "Không thể refresh JWKS", message })
      appendAuditEvent?.({
        actor: username,
        action: "auth.jwks.refresh",
        target: "jwks",
        result: "failure",
        errorSummary: message,
      })
    } finally {
      setIsRefreshingJwks(false)
    }
  }

  if (!canUseApi) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Cấu hình xác thực</CardTitle>
          <CardDescription>Cần quyền api để quản lý cấu hình xác thực MediaMTX.</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  if (isLoading) return <LoadingState label="Đang tải cấu hình xác thực..." />
  if (loadError) return <ErrorState message={loadError} onRetry={fetchAuthConfig} />

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle>Cấu hình xác thực</CardTitle>
              <CardDescription>Đồng bộ lúc {formatTimestamp(lastSyncedAt)}</CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={fetchAuthConfig} disabled={isSaving}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Tải lại
              </Button>
              <Button variant="outline" onClick={showPreview} disabled={isSaving || !hasPatch}>
                Xem payload
              </Button>
              <Button onClick={saveAuthConfig} disabled={isSaving || !hasPatch}>
                <Save className="mr-2 h-4 w-4" />
                {isSaving ? "Đang lưu..." : "Lưu auth"}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-[260px_1fr]">
            <div className="space-y-2">
              <Label>authMethod</Label>
              <Select
                value={form.authMethod}
                onValueChange={(value) =>
                  updateForm((current) => ({ ...current, authMethod: value as AuthMethod }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="internal">Internal</SelectItem>
                  <SelectItem value="http">HTTP</SelectItem>
                  <SelectItem value="jwt">JWT</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              {(["api", "metrics", "pprof", "publish", "read", "playback"] as const).map((action) => (
                <div key={action} className="flex items-center justify-between rounded-md border p-3">
                  <Label className="font-mono text-sm">{action}</Label>
                  <Badge variant={permissions[action] !== false ? "default" : "secondary"}>
                    {permissions[action] !== false ? "Được cấp" : "Không có"}
                  </Badge>
                </div>
              ))}
            </div>
          </div>

          {patchPreview ? (
            <div className="space-y-2">
              <Label>Payload se gui</Label>
              <pre className="max-h-72 overflow-auto rounded-md border bg-muted p-3 text-xs">
                {JSON.stringify(patchPreview, null, 2)}
              </pre>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle>Internal users</CardTitle>
              <CardDescription>Quản lý `authInternalUsers`, IP allowlist và permission matrix.</CardDescription>
            </div>
            <Button
              onClick={() =>
                updateForm((current) => ({
                  ...current,
                  internalUsers: [...current.internalUsers, createEmptyInternalUser(current.internalUsers.length)],
                }))
              }
            >
              <Plus className="mr-2 h-4 w-4" />
              Thêm user
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {form.internalUsers.length === 0 ? (
            <div className="rounded-md border border-dashed p-6 text-sm text-muted-foreground">
              Chưa có internal user nào.
            </div>
          ) : null}
          {form.internalUsers.map((user, index) => (
            <div key={user.id} className="space-y-4 rounded-md border p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="font-medium">{user.user || `User ${index + 1}`}</h3>
                  <p className="text-xs text-muted-foreground">
                    {user.storedPass ? "Đang có mật khẩu đã lưu" : "Chưa có mật khẩu đã lưu"}
                  </p>
                </div>
                <Button
                  variant="outline"
                  onClick={() =>
                    updateForm((current) => ({
                      ...current,
                      internalUsers: current.internalUsers.filter((item) => item.id !== user.id),
                    }))
                  }
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Xóa
                </Button>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label>Username</Label>
                  <Input
                    value={user.user}
                    placeholder="any hoặc username"
                    onChange={(event) => updateUser(user.id, (current) => ({ ...current, user: event.target.value }))}
                  />
                  {fieldErrors[`internalUsers.${index}.user`] ? (
                    <p className="text-xs text-[#cf202f]">{fieldErrors[`internalUsers.${index}.user`]}</p>
                  ) : null}
                </div>
                <div className="space-y-2">
                  <Label>Thay mật khẩu</Label>
                  <Input
                    value={user.passwordReplacement}
                    type="password"
                    placeholder="Bỏ trống để giữ mật khẩu"
                    onChange={(event) =>
                      updateUser(user.id, (current) => ({ ...current, passwordReplacement: event.target.value }))
                    }
                  />
                  <p className="text-xs text-muted-foreground">Chấp nhận plain text hoặc hash Argon2/SHA256 có prefix.</p>
                </div>
                <div className="space-y-2">
                  <Label>IP allowlist</Label>
                  <textarea
                    className={textareaClassName}
                    value={user.ipsText}
                    placeholder="Mỗi IP/CIDR một dòng hoặc phân tách bằng dấu phẩy"
                    onChange={(event) =>
                      updateUser(user.id, (current) => ({ ...current, ipsText: event.target.value }))
                    }
                  />
                  {fieldErrors[`internalUsers.${index}.ips`] ? (
                    <p className="text-xs text-[#cf202f]">{fieldErrors[`internalUsers.${index}.ips`]}</p>
                  ) : null}
                </div>
              </div>
              <PermissionMatrix
                label="Permissions"
                rows={user.permissions}
                disabled={false}
                fieldPrefix={`internalUsers.${index}.permissions`}
                fieldErrors={fieldErrors}
                onChange={(rows) => updateUser(user.id, (current) => ({ ...current, permissions: rows }))}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle>HTTP auth</CardTitle>
              <CardDescription>Thiết lập `authHTTPAddress`, fingerprint và exclude rules.</CardDescription>
            </div>
            <Button variant="outline" onClick={testHttpAuth} disabled={isTestingHttp || !form.http.address.trim()}>
              <TestTube2 className="mr-2 h-4 w-4" />
              {isTestingHttp ? "Đang test..." : "Test auth endpoint"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>authHTTPAddress</Label>
              <Input
                value={form.http.address}
                placeholder="https://auth.example.com/auth"
                onChange={(event) =>
                  updateForm((current) => ({ ...current, http: { ...current.http, address: event.target.value } }))
                }
              />
              {fieldErrors["http.address"] ? <p className="text-xs text-[#cf202f]">{fieldErrors["http.address"]}</p> : null}
            </div>
            <div className="space-y-2">
              <Label>authHTTPFingerprint</Label>
              <Input
                value={form.http.fingerprint}
                onChange={(event) =>
                  updateForm((current) => ({
                    ...current,
                    http: { ...current.http, fingerprint: event.target.value },
                  }))
                }
              />
            </div>
          </div>
          <PermissionMatrix
            label="authHTTPExclude"
            rows={form.http.exclude}
            disabled={false}
            fieldPrefix="http.exclude"
            fieldErrors={fieldErrors}
            onChange={(rows) => updateForm((current) => ({ ...current, http: { ...current.http, exclude: rows } }))}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle>JWT auth</CardTitle>
              <CardDescription>Thiết lập JWKS, claim, issuer, audience và exclude rules.</CardDescription>
            </div>
            <Button variant="outline" onClick={refreshJwks} disabled={isRefreshingJwks}>
              <RefreshCw className="mr-2 h-4 w-4" />
              {isRefreshingJwks ? "Đang refresh..." : "Refresh JWKS"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>authJWTJWKS</Label>
              <Input
                value={form.jwt.jwks}
                onChange={(event) =>
                  updateForm((current) => ({ ...current, jwt: { ...current.jwt, jwks: event.target.value } }))
                }
              />
              {fieldErrors["jwt.jwks"] ? <p className="text-xs text-[#cf202f]">{fieldErrors["jwt.jwks"]}</p> : null}
            </div>
            <div className="space-y-2">
              <Label>authJWTJWKSFingerprint</Label>
              <Input
                value={form.jwt.jwksFingerprint}
                onChange={(event) =>
                  updateForm((current) => ({
                    ...current,
                    jwt: { ...current.jwt, jwksFingerprint: event.target.value },
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>authJWTClaimKey</Label>
              <Input
                value={form.jwt.claimKey}
                onChange={(event) =>
                  updateForm((current) => ({ ...current, jwt: { ...current.jwt, claimKey: event.target.value } }))
                }
              />
              {fieldErrors["jwt.claimKey"] ? (
                <p className="text-xs text-[#cf202f]">{fieldErrors["jwt.claimKey"]}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label>authJWTIssuer</Label>
              <Input
                value={form.jwt.issuer}
                onChange={(event) =>
                  updateForm((current) => ({ ...current, jwt: { ...current.jwt, issuer: event.target.value } }))
                }
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>authJWTAudience</Label>
              <Input
                value={form.jwt.audience}
                onChange={(event) =>
                  updateForm((current) => ({ ...current, jwt: { ...current.jwt, audience: event.target.value } }))
                }
              />
            </div>
          </div>
          <Separator />
          <PermissionMatrix
            label="authJWTExclude"
            rows={form.jwt.exclude}
            disabled={false}
            fieldPrefix="jwt.exclude"
            fieldErrors={fieldErrors}
            onChange={(rows) => updateForm((current) => ({ ...current, jwt: { ...current.jwt, exclude: rows } }))}
          />
        </CardContent>
      </Card>
    </div>
  )
}
