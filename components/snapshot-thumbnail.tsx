"use client"

import { useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import { getAuthHeader } from "@/lib/auth"

interface SnapshotThumbnailProps {
  pathName: string
}

export function SnapshotThumbnail({ pathName }: SnapshotThumbnailProps) {
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    let objectUrl: string | null = null

    async function fetchThumbnail() {
      setLoading(true)
      try {
        const auth = getAuthHeader()
        const headers: Record<string, string> = auth ? { Authorization: auth } : {}

        // 1. Resolve latest snapshot URL
        const latestRes = await fetch(`/api/snapshots/latest?path=${encodeURIComponent(pathName)}`, {
          headers,
        })
        if (!latestRes.ok) {
          if (!cancelled) setThumbnailUrl(null)
          return
        }
        const { snapshot } = (await latestRes.json()) as { snapshot: { url: string } | null }
        if (!snapshot) {
          if (!cancelled) setThumbnailUrl(null)
          return
        }

        // 2. Fetch the image file with auth, materialize as object URL
        const imgRes = await fetch(snapshot.url, { headers })
        if (!imgRes.ok) {
          if (!cancelled) setThumbnailUrl(null)
          return
        }
        const blob = await imgRes.blob()
        if (cancelled) return
        objectUrl = URL.createObjectURL(blob)
        setThumbnailUrl(objectUrl)
      } catch {
        if (!cancelled) setThumbnailUrl(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchThumbnail()
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
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
