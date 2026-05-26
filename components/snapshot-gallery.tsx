"use client"

import { useCallback, useState } from "react"
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
import { ImageIcon, Download, Trash2, Camera } from "lucide-react"

interface Snapshot {
  filename: string
  url: string
  timestamp: string
}

interface SnapshotGalleryProps {
  pathName: string
  snapshots?: Snapshot[]
}

export function SnapshotGallery({ pathName, snapshots = [] }: SnapshotGalleryProps) {
  const [open, setOpen] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  const handleDownload = useCallback((snapshot: Snapshot) => {
    const link = document.createElement("a")
    link.href = snapshot.url
    link.download = snapshot.filename
    link.click()
  }, [])

  const handleDelete = useCallback(
    (filename: string) => {
      // TODO: wire up actual delete API
      console.log("Delete snapshot:", filename)
      setDeleteConfirm(null)
    },
    [],
  )

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button
            size="icon"
            variant="outline"
            className="rounded-full"
            title="Snapshots"
          >
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
                : "No snapshots available for this path."}
            </DialogDescription>
          </DialogHeader>

          {snapshots.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12 text-center text-muted-foreground">
              <Camera className="mb-3 h-10 w-10" />
              <p className="text-sm font-medium">No snapshots yet</p>
              <p className="mt-1 text-xs">
                Snapshots are taken periodically when FFmpeg snapshot is configured and the stream
                is active.
              </p>
            </div>
          ) : (
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
                        {snapshot.timestamp}
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
