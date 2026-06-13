"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { AlertTriangle, Download, RefreshCw, FileText } from "lucide-react"
import { useNotifications } from "@/components/notification-provider"

type LogLevel = "all" | "debug" | "info" | "warn" | "error"

interface LogLine {
  raw: string
  level: string | null
  ts: string | null
  message: string
  structured: boolean
}

const LEVEL_RE = /\b(DEBUG|INFO|WARN|WARNING|ERROR|FATAL)\b/
const TS_RE = /^(\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?)/

function parseLine(raw: string): LogLine {
  const trimmed = raw.trim()
  if (!trimmed) return { raw, level: null, ts: null, message: raw, structured: false }
  if (trimmed.startsWith("{")) {
    try {
      const obj = JSON.parse(trimmed)
      const level = String(obj.level ?? obj.lvl ?? "").toLowerCase() || null
      const ts = String(obj.ts ?? obj.time ?? obj.timestamp ?? "") || null
      const message = String(obj.msg ?? obj.message ?? trimmed)
      return { raw, level, ts, message, structured: true }
    } catch {
      // fallthrough
    }
  }
  const levelMatch = trimmed.match(LEVEL_RE)
  const tsMatch = trimmed.match(TS_RE)
  return {
    raw,
    level: levelMatch ? levelMatch[1].toLowerCase().replace("warning", "warn") : null,
    ts: tsMatch ? tsMatch[1] : null,
    message: trimmed,
    structured: false,
  }
}

function levelMatches(line: LogLine, filter: LogLevel) {
  if (filter === "all") return true
  if (!line.level) return false
  if (filter === "warn") return line.level === "warn" || line.level === "warning"
  return line.level === filter || (filter === "error" && line.level === "fatal")
}

const LEVEL_COLORS: Record<string, string> = {
  debug: "text-[#7c828a]",
  info: "text-[#0a0b0d]",
  warn: "text-amber-700",
  warning: "text-amber-700",
  error: "text-red-700",
  fatal: "text-red-800 font-semibold",
}

export function LogsViewer() {
  const { notify } = useNotifications()
  const [content, setContent] = useState<string>("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [truncated, setTruncated] = useState(false)
  const [tail, setTail] = useState(true)
  const [intervalMs, setIntervalMs] = useState(5000)
  const [level, setLevel] = useState<LogLevel>("all")
  const [search, setSearch] = useState("")
  const [bytes, setBytes] = useState(256_000)
  const [logSize, setLogSize] = useState<number | null>(null)
  const preRef = useRef<HTMLPreElement | null>(null)

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/logs?bytes=${bytes}`, { cache: "no-store" })
      if (!response.ok) {
        const body = await response.json().catch(() => null)
        throw new Error(body?.error || `HTTP ${response.status}`)
      }
      const text = await response.text()
      setContent(text)
      setTruncated(response.headers.get("X-Log-Truncated") === "1")
      const size = Number(response.headers.get("X-Log-Size"))
      setLogSize(Number.isFinite(size) ? size : null)
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [bytes])

  useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

  useEffect(() => {
    if (!tail) return
    const id = window.setInterval(fetchLogs, Math.max(1000, intervalMs))
    return () => window.clearInterval(id)
  }, [tail, intervalMs, fetchLogs])

  useEffect(() => {
    if (tail && preRef.current) {
      preRef.current.scrollTop = preRef.current.scrollHeight
    }
  }, [content, tail])

  const filtered = useMemo(() => {
    const lines = content.split(/\r?\n/)
    const needle = search.trim().toLowerCase()
    const out: LogLine[] = []
    for (const raw of lines) {
      if (!raw) continue
      const parsed = parseLine(raw)
      if (!levelMatches(parsed, level)) continue
      if (needle && !parsed.raw.toLowerCase().includes(needle)) continue
      out.push(parsed)
    }
    return out
  }, [content, search, level])

  function handleDownload() {
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `mediamtx-${new Date().toISOString().replace(/[:.]/g, "-")}.log`
    a.click()
    URL.revokeObjectURL(url)
    notify({ type: "success", title: "Đã tải log" })
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-4 w-4" /> MediaMTX log
          </CardTitle>
          <CardDescription>
            Đọc trực tiếp file log MediaMTX. Yêu cầu env <code className="font-mono">MEDIAMTX_LOG_FILE</code> trên dashboard
            server trỏ vào file log thực; nếu MediaMTX chạy trong container khác cần mount volume chia sẻ.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 md:grid-cols-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Level</Label>
              <Select value={level} onValueChange={(v) => setLevel(v as LogLevel)}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất cả</SelectItem>
                  <SelectItem value="debug">Debug</SelectItem>
                  <SelectItem value="info">Info</SelectItem>
                  <SelectItem value="warn">Warn</SelectItem>
                  <SelectItem value="error">Error</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Search</Label>
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="filter text..."
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Tail bytes</Label>
              <Input
                type="number"
                value={bytes}
                onChange={(e) => setBytes(Math.max(1024, Number(e.target.value) || 1024))}
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Refresh (ms)</Label>
              <Input
                type="number"
                value={intervalMs}
                onChange={(e) => setIntervalMs(Math.max(1000, Number(e.target.value) || 1000))}
                className="h-8 text-xs"
                disabled={!tail}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Switch checked={tail} onCheckedChange={setTail} />
              <Label className="text-sm">Auto-tail</Label>
            </div>
            <Button size="sm" variant="outline" onClick={fetchLogs} disabled={loading}>
              <RefreshCw className={`mr-1 h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
            </Button>
            <Button size="sm" variant="outline" onClick={handleDownload} disabled={!content}>
              <Download className="mr-1 h-3.5 w-3.5" /> Download
            </Button>
            {logSize !== null && (
              <Badge variant="outline" className="text-[10px]">
                File: {(logSize / 1024).toFixed(1)} KB
              </Badge>
            )}
            {truncated && (
              <Badge variant="outline" className="bg-amber-50 text-amber-800 text-[10px]">
                Đã cắt — chỉ hiển thị {Math.round(bytes / 1024)} KB cuối
              </Badge>
            )}
            <Badge variant="outline" className="text-[10px]">
              {filtered.length} dòng hiển thị
            </Badge>
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-800">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <pre
            ref={preRef}
            className="max-h-[480px] overflow-auto rounded-md border bg-[#0a0b0d] p-3 font-mono text-[11px] leading-relaxed text-[#dee1e6]"
          >
            {filtered.length === 0 ? (
              <span className="text-[#5b616e]">— không có dòng nào khớp filter —</span>
            ) : (
              filtered.map((line, i) => (
                <div key={i} className={LEVEL_COLORS[line.level || ""] || "text-[#dee1e6]"}>
                  {line.raw}
                </div>
              ))
            )}
          </pre>
        </CardContent>
      </Card>
    </div>
  )
}

export default LogsViewer
