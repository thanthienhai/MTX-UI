"use client"

import { useEffect, useRef, useState } from "react"
import Hls from "hls.js"
import { buildMediaMtxHlsUrl } from "@/lib/mediamtx-url.mjs"

interface StreamPlayerProps {
  pathName: string
}

export function StreamPlayer({ pathName }: StreamPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const hlsRef = useRef<Hls | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const hlsUrl = buildMediaMtxHlsUrl(pathName)

    setIsLoading(true)
    setError(null)

    // Check if HLS is natively supported (Safari)
    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = hlsUrl
      video.addEventListener("loadedmetadata", () => setIsLoading(false))
      video.addEventListener("error", () => {
        setError("Không thể tải stream")
        setIsLoading(false)
      })
    } else if (Hls.isSupported()) {
      // Use HLS.js for browsers that don't support HLS natively
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
      })

      hlsRef.current = hls

      hls.loadSource(hlsUrl)
      hls.attachMedia(video)

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setIsLoading(false)
        video.play().catch((err) => {
          console.warn("Autoplay prevented:", err)
        })
      })

      hls.on(Hls.Events.ERROR, (event, data) => {
        console.error("HLS error:", data)
        if (data.fatal) {
          setError(`Streaming error: ${data.type}`)
          setIsLoading(false)
        }
      })
    } else {
      setError("Trình duyệt này không hỗ trợ HLS")
      setIsLoading(false)
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy()
        hlsRef.current = null
      }
    }
  }, [pathName])

  return (
    <div className="relative w-full bg-black rounded-lg overflow-hidden" style={{ aspectRatio: "16/9" }}>
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-white mb-2"></div>
            <p className="text-white text-sm">Đang tải stream...</p>
          </div>
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
          <div className="text-center text-red-500">
            <p className="font-medium">{error}</p>
            <p className="text-sm mt-2">Kiểm tra stream đang hoạt động và HLS đã bật</p>
          </div>
        </div>
      )}
      <video ref={videoRef} className="w-full h-full" controls playsInline muted />
    </div>
  )
}
