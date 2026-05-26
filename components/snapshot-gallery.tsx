"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { ImageIcon, Download, Trash2, Camera, RefreshCw, Loader2 } from "lucide-react"

interface Snapshot {
  filename: string
  url: string
  timestamp: string
}

interface SnapshotGalleryProps {
  pathName: string
}

export function SnapshotGallery({ pathName }: SnapshotGalleryProps) {
  const [open, setOpen] = useState(false)
  const [snapshots, setSnapshots] = useState<Snapshot[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchSnapshots = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/snapshots/list?path=${encodeURIComponent(pathName)}`)
      if (!res.ok) {
        throw new Error(`Failed to list snapshots: ${res.status}`)
      }
      const data = await res.json()
      setSnapshots(data.snapshots || [])
    } catch (err) {
      console.error("Error fetching snapshots:", err)
      setError(err instanceof Error ? err.message : "Không thể tải snapshot")
    } finally {
      setIsLoading(false)
    }
  }, [pathName])

  // Fetch on open
  useEffect(() => {
    if (open) {
      fetchSnapshots()

      // Auto-refresh every 10s while open
      pollingRef.current = setInterval(fetchSnapshots, 10000)

      return () => {
        if (pollingRef.current) {
          clearInterval(pollingRef.current)
          pollingRef.current = null
        }
      }
    }
  }, [open, fetchSnapshots])

  const handleDownload = useCallback((snapshot: Snapshot) => {
    const link = document.createElement("a")
    link.href = snapshot.url
    link.download = snapshot.filename
    link.click()
  }, [])

  const handleDelete = useCallback(
    async (filename: string) => {
      try {
        const res = await fetch("/api/snapshots/delete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path: pathName, name: filename }),
        })

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}))
          throw new Error(errData.error || `Delete failed: ${res.status}`)
        }

        // Remove from local state
        setSnapshots((prev) => prev.filter((s) => s.filename !== filename))
        setDeleteConfirm(null)
      } catch (err) {
        console.error("Error deleting snapshot:", err)
        alert(`Không thể xóa snapshot: ${err instanceof Error ? err.message : "Lỗi không xác định"}`)
      }
    },
    [pathName],
  )

  const formatTimestamp = (ts: string) => {
    try {
      return new Date(ts).toLocaleString("vi-VN")
    } catch {
      return ts
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button id={`snapshot-gallery-btn-${pathName}`} size="icon" variant="outline" className="rounded-full" title="Snapshots">
            <Camera className="h-4 w-4" />
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ImageIcon className="h-5 w-5" />
              Snapshots: {pathName}
            </DialogTitle>
            <DialogDescription>
              {snapshots.length > 0
                ? `${snapshots.length} snapshot(s) for this path`
                : "Browse snapshots captured from this stream."}
            </DialogDescription>
          </DialogHeader>

          {/* Toolbar */}
          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" size="sm" onClick={fetchSnapshots} disabled={isLoading}>
              <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isLoading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>

          {/* Loading state */}
          {isLoading && snapshots.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12 text-center text-muted-foreground">
              <Loader2 className="mb-3 h-8 w-8 animate-spin" />
              <p className="text-sm font-medium">Đang tải snapshots...</p>
            </div>
          ) : /* Error state */
          error ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-red-200 py-12 text-center text-red-500">
              <p className="text-sm font-medium">Lỗi tải snapshots</p>
              <p className="mt-1 text-xs">{error}</p>
              <Button variant="outline" size="sm" className="mt-4" onClick={fetchSnapshots}>
                Thử lại
              </Button>
            </div>
          ) : /* Empty state */
          snapshots.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12 text-center text-muted-foreground">
              <Camera className="mb-3 h-10 w-10" />
              <p className="text-sm font-medium">No snapshots yet</p>
              <p className="mt-1 text-xs">
                Snapshots are taken periodically when snapshot is configured and the stream is active.
              </p>
            </div>
          ) : (
            /* Gallery grid */
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {snapshots.map((snapshot) => (
                <div
                  key={snapshot.filename}
                  className="group relative overflow-hidden rounded-lg border bg-muted"
                >
                  <img
                    src={snapshot.url}
                    alt={snapshot.filename}
                    className="aspect-video w-full object-cover"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 flex items-end justify-center opacity-0 transition-opacity group-hover:opacity-100">
                    <div className="flex w-full gap-1 bg-gradient-to-t from-black/70 to-transparent p-2">
                      <Button
                        variant="secondary"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => handleDownload(snapshot)}
                        title="Download"
                      >
                        <Download className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="secondary"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => setDeleteConfirm(snapshot.filename)}
                        title="Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                      <span className="ml-auto self-center px-1 text-[10px] text-white drop-shadow-md">
                        {formatTimestamp(snapshot.timestamp)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog open={deleteConfirm !== null} onOpenChange={(o) => !o && setDeleteConfirm(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete snapshot?</DialogTitle>
            <DialogDescription>
              This will permanently delete <strong>{deleteConfirm}</strong> from the server. This
              action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirm && handleDelete(deleteConfirm)}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
