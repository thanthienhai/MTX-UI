"use client"

import { useEffect, useState } from "react"
import { Loader2, Camera } from "lucide-react"

interface SnapshotThumbnailProps {
  pathName: string
}

export function SnapshotThumbnail({ pathName }: SnapshotThumbnailProps) {
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function fetchThumbnail() {
      setLoading(true)
      try {
        const res = await fetch(`/api/snapshots/latest?path=${encodeURIComponent(pathName)}&redirect=true`)
        if (cancelled) return

        if (res.ok && res.redirected) {
          setThumbnailUrl(res.url)
        } else {
          setThumbnailUrl(null)
        }
      } catch {
        if (!cancelled) setThumbnailUrl(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchThumbnail()
    return () => { cancelled = true }
  }, [pathName])

  if (loading) {
    return (
      <div className="flex h-[23px] w-[40px] items-center justify-center rounded border bg-muted">
        <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!thumbnailUrl) {
    return null
  }

  const handleClick = () => {
    const btn = document.getElementById(`snapshot-gallery-btn-${pathName}`)
    btn?.click()
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      title="View snapshots"
      className="shrink-0 overflow-hidden rounded border transition-opacity hover:opacity-80"
    >
      <img
        src={thumbnailUrl}
        alt={`${pathName} snapshot`}
        className="h-[23px] w-[40px] object-cover"
      />
    </button>
  )
}
