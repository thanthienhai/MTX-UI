"use client"

import { useCallback, useState } from "react"
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Copy,
  Edit,
  Eye,
  Plus,
  RefreshCw,
  Trash2,
  VideoIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { EmptyState, ErrorState, LoadingState } from "@/components/module-state"
import { StreamPlayer } from "@/components/stream-player"
import { useNotifications } from "@/components/notification-provider"
import * as api from "@/lib/mediamtx-api"
import type { PathConf, Path } from "@/lib/mediamtx-api"
import { requireMediaMtxAction, type MediaMtxPermissionSet } from "@/lib/mediamtx-permissions"
import { buildPathStreamUrls } from "@/lib/mediamtx-url.mjs"
import { mergeConfiguredAndRuntimePaths, type MergedPathRow } from "@/lib/path-management.mjs"

interface PathListProps {
  configuredPaths: PathConf[]
  runtimePaths: Path[]
  permissions: MediaMtxPermissionSet
  username?: string | null
  onRefresh: () => Promise<void>
  onEdit: (path: PathConf) => void
  onDelete: (pathName: string) => void
  onReplace: (path: PathConf) => void
  onAdd: () => void
  appendAuditEvent?: (event: { actor: string; action: string; target: string; payloadSummary: string; result: string; errorSummary?: string }) => void
}

const formatMegabytes = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(2)} MB`

export function PathList({
  configuredPaths,
  runtimePaths,
  permissions,
  username,
  onRefresh,
  onEdit,
  onDelete,
  onReplace,
  onAdd,
  appendAuditEvent,
}: PathListProps) {
  const { notify } = useNotifications()
  const canUseApi = permissions.api !== false
  const canRead = permissions.read !== false
  const canPublish = permissions.publish !== false

  const [previewPath, setPreviewPath] = useState<string | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const mergedPaths = mergeConfiguredAndRuntimePaths(configuredPaths, runtimePaths)

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true)
    try {
      await onRefresh()
    } finally {
      setIsRefreshing(false)
    }
  }, [onRefresh])

  const handleCopyUrl = useCallback(
    (pathName: string, protocol: string) => {
      const urls = buildPathStreamUrls(pathName)
      const url = urls[protocol as keyof typeof urls]
      if (url) {
        navigator.clipboard.writeText(url).then(
          () => notify({ type: "success", title: "Đã copy URL", message: `${protocol}: ${url}` }),
          () => notify({ type: "error", title: "Không thể copy URL", message: "Clipboard không khả dụng" }),
        )
      }
    },
    [notify],
  )

  const handleOpenPlayback = useCallback(
    (pathName: string) => {
      if (!canRead) {
        notify({ type: "error", title: "Không có quyền playback" })
        return
      }
      const url = buildPathStreamUrls(pathName).webrtc
      if (url) {
        window.open(url, "_blank", "noreferrer")
      }
    },
    [canRead, notify],
  )

  const renderRow = (row: MergedPathRow) => {
    const sourceType = row.sourceType || row.runtime?.source?.type || "unknown"
    const sourceId = row.sourceId || row.runtime?.source?.id || null

    const urls = buildPathStreamUrls(row.name)
    const hasActiveStream = row.isReady

    return (
      <div
        key={row.name}
        className="overflow-hidden rounded-2xl border border-[#dee1e6] bg-white transition-colors hover:border-[#a8b8cc]"
      >
        <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 flex-1 items-start gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#eef0f3]">
              <VideoIcon className="h-5 w-5 text-[#0052ff]" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="truncate text-base font-semibold text-[#0a0b0d]">{row.name}</h3>
                {row.isReady ? (
                  <Badge className="rounded-full bg-[#0a0b0d] px-2.5 text-white hover:bg-[#0a0b0d]">
                    <span className="mr-1.5 h-2 w-2 rounded-full bg-[#05b169]" />
                    LIVE
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="rounded-full px-2.5">
                    Idle
                  </Badge>
                )}
                {!row.hasConfig && row.hasRuntime && (
                  <Badge variant="outline" className="text-xs">
                    Runtime only
                  </Badge>
                )}
                {row.hasConfig && !row.hasRuntime && (
                  <Badge variant="outline" className="text-xs">
                    Config only
                  </Badge>
                )}
              </div>
              <p className="mt-1 truncate text-sm text-[#5b616e]">
                {row.config?.source || "No source configured"}
              </p>
              {row.tracks.length > 0 && (
                <p className="mt-1 text-xs text-[#5b616e]">
                  {row.tracks.length} track{row.tracks.length !== 1 ? "s" : ""}: {row.tracks.join(", ")}
                </p>
              )}
              <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-[#5b616e]">
                <span className="font-mono text-[#0a0b0d]">{row.readerCount} viewers</span>
                {sourceType && sourceType !== "unknown" && (
                  <span>Source: {sourceType}</span>
                )}
                {sourceId && (
                  <span className="font-mono">ID: {sourceId}</span>
                )}
                {hasActiveStream && (
                  <>
                    <span className="inline-flex items-center gap-1 font-mono">
                      <ArrowDownToLine className="h-3.5 w-3.5 text-[#05b169]" />
                      {formatMegabytes(row.bytesReceived)}
                    </span>
                    <span className="inline-flex items-center gap-1 font-mono">
                      <ArrowUpFromLine className="h-3.5 w-3.5 text-[#0052ff]" />
                      {formatMegabytes(row.bytesSent)}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-auto">
            <Button
              size="icon"
              variant="outline"
              className="rounded-full"
              onClick={() => setPreviewPath(previewPath === row.name ? null : row.name)}
              disabled={!canRead}
              title="Preview stream"
            >
              <Eye className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="outline"
              className="rounded-full"
              onClick={() => handleCopyUrl(row.name, "rtsp")}
              disabled={!canRead || !urls.rtsp}
              title="Copy RTSP URL"
            >
              <Copy className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="outline"
              className="rounded-full"
              onClick={() => onEdit(row.config!)}
              disabled={!canUseApi || !row.hasConfig}
              title="Edit path"
            >
              <Edit className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="outline"
              className="rounded-full"
              onClick={() => onReplace(row.config!)}
              disabled={!canUseApi || !row.hasConfig}
              title="Replace path"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="outline"
              className="rounded-full text-[#cf202f] hover:text-[#cf202f]"
              onClick={() => onDelete(row.name)}
              disabled={!canUseApi}
              title="Delete path"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {previewPath === row.name && hasActiveStream && canRead && (
          <div className="border-t border-[#eef0f3] px-4 pb-4 pt-4">
            <StreamPlayer pathName={row.name} />
          </div>
        )}

        {!hasActiveStream && previewPath === row.name && (
          <div className="border-t border-[#eef0f3] px-4 pb-4 pt-4">
            <p className="text-sm text-[#5b616e]">Stream đang không hoạt động</p>
          </div>
        )}
      </div>
    )
  }

  return (
    <Card className="rounded-3xl border-[#dee1e6] bg-white shadow-none">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Path stream</CardTitle>
            <CardDescription>
              {mergedPaths.length} path đã cấu hình,{" "}
              {mergedPaths.filter((p) => p.isReady).length} đang live
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={handleRefresh}
              disabled={isRefreshing}
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button
              className="rounded-full bg-[#0052ff] hover:bg-[#003ecc]"
              onClick={onAdd}
              disabled={!canUseApi || !canPublish}
            >
              <Plus className="w-4 h-4 mr-2" />
              Thêm path
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {mergedPaths.length === 0 ? (
            <EmptyState
              icon={<VideoIcon className="h-12 w-12 opacity-50" />}
              title="Chưa cấu hình path nào"
              action={
                canUseApi && canPublish ? (
                  <Button onClick={onAdd}>Thêm path đầu tiên</Button>
                ) : null
              }
            />
          ) : (
            mergedPaths.map(renderRow)
          )}
        </div>
      </CardContent>
    </Card>
  )
}