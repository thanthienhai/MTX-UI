"use client"

import { useCallback, useEffect, useState } from "react"
import { Plus, Copy, ExternalLink, Trash2, KeyRound, RefreshCw } from "lucide-react"
import { copyToClipboard } from "@/lib/clipboard"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface CreatedEvent {
  pathKey: string
  loginCode: string
  statusToken: string
  configToken: string
}

interface AdminEventRow {
  pathKey: string
  displayName: string
  statusToken: string
  configToken: string
  createdAt: string
  quota: number
  destinationsTotal: number
  destinationsEnabled: number
  online: boolean
  bytesReceived: number
  sourceType: string | null
}

function basePath() {
  return (process.env.NEXT_PUBLIC_BASE_PATH || "").replace(/\/+$/, "")
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes < 0) return "0 B"
  const units = ["B", "KB", "MB", "GB", "TB"]
  let v = bytes
  let i = 0
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i++
  }
  return `${i === 0 ? v : v.toFixed(1)} ${units[i]}`
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
}

/**
 * Admin card to create AND manage public relay events. The login code is shown
 * once on create / reset and cannot be recovered later — only a salted hash is
 * persisted.
 */
export function RelayEventsAdmin() {
  const [name, setName] = useState("")
  const [customPath, setCustomPath] = useState("")
  const [quota, setQuota] = useState(10)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [created, setCreated] = useState<CreatedEvent | null>(null)

  const [events, setEvents] = useState<AdminEventRow[]>([])
  const [listLoading, setListLoading] = useState(true)
  const [listError, setListError] = useState<string | null>(null)

  const loadEvents = useCallback(async () => {
    try {
      const res = await fetch(`${basePath()}/api/relay/events`, {
        cache: "no-store",
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        setListError(body?.error || "Không tải được danh sách")
        return
      }
      setEvents(Array.isArray(body?.events) ? body.events : [])
      setListError(null)
    } catch {
      setListError("Lỗi kết nối")
    } finally {
      setListLoading(false)
    }
  }, [])

  useEffect(() => {
    loadEvents()
  }, [loadEvents])

  const submit = async () => {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`${basePath()}/api/relay/events`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ displayName: name.trim(), quota, path: customPath.trim() }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(body?.error || "Không tạo được sự kiện")
        return
      }
      setCreated(body as CreatedEvent)
      setName("")
      setCustomPath("")
      loadEvents()
    } catch {
      setError("Lỗi kết nối")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="rounded-3xl border-[#dee1e6] bg-white shadow-none">
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle>Sự kiện relay (public)</CardTitle>
            <CardDescription>
              Tạo và quản lý sự kiện = một path với khóa ingest bí mật + link cấu hình/trạng thái để giao cho người dùng.
            </CardDescription>
          </div>
          <Button variant="secondary" size="sm" className="rounded-full" onClick={loadEvents} disabled={listLoading}>
            <RefreshCw className={`h-4 w-4 ${listLoading ? "animate-spin" : ""}`} />
            <span className="ml-1">Làm mới</span>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[220px]">
            <Label htmlFor="evt-name">Tên sự kiện *</Label>
            <Input
              id="evt-name"
              placeholder="VD: Nguyễn Cao Nguyên"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="flex-1 min-w-[220px]">
            <Label htmlFor="evt-path">Path tùy chỉnh</Label>
            <Input
              id="evt-path"
              placeholder="Để trống = tự tạo ngẫu nhiên"
              value={customPath}
              onChange={(e) => setCustomPath(e.target.value)}
              pattern="[A-Za-z0-9_-]{3,64}"
            />
            <p className="mt-1 text-[11px] text-[#7c828a]">Chữ, số, _ và - (3–64 ký tự). Đây cũng là khóa ingest.</p>
          </div>
          <div className="w-28">
            <Label htmlFor="evt-quota">Quota luồng</Label>
            <Input
              id="evt-quota"
              type="number"
              min={1}
              value={quota}
              onChange={(e) => setQuota(Number(e.target.value) || 1)}
            />
          </div>
          <Button
            className="rounded-full bg-[#0052ff] hover:bg-[#003ecc]"
            onClick={submit}
            disabled={busy || !name.trim()}
          >
            <Plus className="w-4 h-4 mr-2" />
            {busy ? "Đang tạo…" : "Tạo sự kiện"}
          </Button>
        </div>

        {error && <div className="rounded-lg bg-red-50 text-red-700 px-4 py-2 text-sm">{error}</div>}

        {created && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 space-y-3">
            <div className="font-medium text-emerald-800">
              Đã tạo sự kiện. Lưu lại mã đăng nhập — chỉ hiển thị một lần.
            </div>
            <CopyField label="Khóa ingest (path)" value={created.pathKey} />
            <CopyField label="Mã đăng nhập" value={created.loginCode} highlight />
            <CopyField label="Link cấu hình" value={`${origin()}${basePath()}/public/config/${created.configToken}`} openable />
            <CopyField label="Link trạng thái" value={`${origin()}${basePath()}/public/status/${created.statusToken}`} openable />
          </div>
        )}

        <div className="space-y-3">
          <div className="text-sm font-medium text-[#0a0b0d]">
            Sự kiện đã tạo {events.length > 0 && <span className="text-[#7c828a]">({events.length})</span>}
          </div>
          {listError && <div className="rounded-lg bg-red-50 text-red-700 px-4 py-2 text-sm">{listError}</div>}
          {listLoading ? (
            <div className="text-sm text-[#7c828a]">Đang tải danh sách…</div>
          ) : events.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#dee1e6] px-4 py-6 text-center text-sm text-[#7c828a]">
              Chưa có sự kiện nào. Tạo sự kiện đầu tiên ở trên.
            </div>
          ) : (
            <div className="space-y-2">
              {events.map((ev) => (
                <EventRow key={ev.pathKey} ev={ev} onChanged={loadEvents} />
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function origin(): string {
  return typeof window !== "undefined" ? window.location.origin : ""
}

function EventRow({ ev, onChanged }: { ev: AdminEventRow; onChanged: () => void }) {
  const [busy, setBusy] = useState(false)
  const [rowError, setRowError] = useState<string | null>(null)
  const [newCode, setNewCode] = useState<string | null>(null)

  const configUrl = `${origin()}${basePath()}/public/config/${ev.configToken}`
  const statusUrl = `${origin()}${basePath()}/public/status/${ev.statusToken}`

  const resetCode = async () => {
    if (!confirm(`Đặt lại mã đăng nhập cho "${ev.displayName}"? Mã cũ sẽ ngừng hoạt động ngay.`)) return
    setBusy(true)
    setRowError(null)
    try {
      const res = await fetch(`${basePath()}/api/relay/events/${encodeURIComponent(ev.pathKey)}/reset-code`, {
        method: "POST",
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        setRowError(body?.error || "Không đặt lại được mã")
        return
      }
      setNewCode(body.loginCode as string)
    } catch {
      setRowError("Lỗi kết nối")
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    if (!confirm(`Xóa sự kiện "${ev.displayName}"? Thao tác này xóa path khỏi MediaMTX và không thể hoàn tác.`)) return
    setBusy(true)
    setRowError(null)
    try {
      const res = await fetch(`${basePath()}/api/relay/events/${encodeURIComponent(ev.pathKey)}`, {
        method: "DELETE",
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        setRowError(body?.error || "Không xóa được sự kiện")
        return
      }
      onChanged()
    } catch {
      setRowError("Lỗi kết nối")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-2xl border border-[#eef0f3] bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-[#0a0b0d] truncate">{ev.displayName}</span>
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                ev.online ? "bg-[#05b169] text-white" : "bg-[#eef0f3] text-[#5b616e]"
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${ev.online ? "bg-white" : "bg-[#9aa0a6]"}`} />
              {ev.online ? "Online" : "Offline"}
            </span>
          </div>
          <div className="mt-1 text-xs text-[#7c828a]">
            Tạo {formatDate(ev.createdAt)} · {ev.destinationsEnabled}/{ev.destinationsTotal} luồng bật · Quota {ev.quota}
            {ev.online && (
              <>
                {" "}· Nguồn {ev.sourceType || "?"} · Nhận {formatBytes(ev.bytesReceived)}
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={resetCode} disabled={busy}>
            <KeyRound className="h-4 w-4 mr-1" />
            Đặt lại mã
          </Button>
          <Button
            variant="secondary"
            size="sm"
            className="text-red-600 hover:bg-red-50"
            onClick={remove}
            disabled={busy}
          >
            <Trash2 className="h-4 w-4 mr-1" />
            Xóa
          </Button>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <MiniCopy label="Khóa ingest" value={ev.pathKey} />
        <MiniCopy label="Link cấu hình" value={configUrl} openable />
        <MiniCopy label="Link trạng thái" value={statusUrl} openable />
      </div>

      {newCode && (
        <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
          <div className="text-xs font-medium text-emerald-800">Mã đăng nhập mới — chỉ hiển thị một lần</div>
          <div className="mt-1">
            <CopyField label="" value={newCode} highlight />
          </div>
        </div>
      )}

      {rowError && <div className="mt-2 text-sm text-red-600">{rowError}</div>}
    </div>
  )
}

function MiniCopy({ label, value, openable }: { label: string; value: string; openable?: boolean }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="min-w-0">
      <div className="text-[11px] text-[#7c828a]">{label}</div>
      <div className="flex items-center gap-1">
        <code className="flex-1 truncate rounded border border-[#eef0f3] bg-[#f7f7f7] px-2 py-1 text-xs font-mono">
          {value}
        </code>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 px-2"
          onClick={async () => {
            const ok = await copyToClipboard(value)
            if (!ok) return
            setCopied(true)
            setTimeout(() => setCopied(false), 1500)
          }}
        >
          <Copy className="h-3.5 w-3.5" />
          {copied ? <span className="ml-1 text-xs">✓</span> : null}
        </Button>
        {openable && (
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2"
            onClick={() => window.open(value, "_blank", "noopener,noreferrer")}
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  )
}

function CopyField({
  label,
  value,
  highlight,
  openable,
}: {
  label: string
  value: string
  highlight?: boolean
  openable?: boolean
}) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="space-y-1">
      {label && <div className="text-xs text-emerald-700">{label}</div>}
      <div className="flex items-center gap-2">
        <code
          className={`flex-1 rounded border px-3 py-2 text-sm font-mono break-all ${
            highlight ? "bg-white border-emerald-300 font-bold" : "bg-white border-emerald-200"
          }`}
        >
          {value}
        </code>
        <Button
          size="sm"
          variant="secondary"
          onClick={async () => {
            const ok = await copyToClipboard(value)
            if (!ok) return
            setCopied(true)
            setTimeout(() => setCopied(false), 1500)
          }}
        >
          <Copy className="h-4 w-4 mr-1" />
          {copied ? "✓" : "Copy"}
        </Button>
        {openable && (
          <Button size="sm" variant="secondary" onClick={() => window.open(value, "_blank", "noopener,noreferrer")}>
            <ExternalLink className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  )
}
