"use client"

import { useMediaMTXWebRTC } from "mediamtx-webrtc-react"
import { buildMediaMtxWebRtcReadUrl } from "@/lib/mediamtx-url.mjs"

interface WHEPPlayerProps {
  pathName: string
  className?: string
}

export function WHEPPlayer({ pathName, className }: WHEPPlayerProps) {
  const whepUrl = buildMediaMtxWebRtcReadUrl(pathName)

  const {
    videoRef,
    connectionState,
    error,
    isConnecting,
    isConnected,
  } = useMediaMTXWebRTC({
    url: whepUrl,
    onError: () => {
      // Library handles retries internally; no-op to avoid noisy console
    },
  })

  return (
    <div className={`relative w-full bg-black rounded-lg overflow-hidden ${className || ""}`} style={{ aspectRatio: "16/9" }}>
      {isConnecting && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900 z-10">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-white mb-2"></div>
            <p className="text-white text-sm">Đang kết nối WebRTC...</p>
          </div>
        </div>
      )}
      {!isConnecting && !isConnected && connectionState === "failed" && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900 z-10">
          <div className="text-center text-red-500">
            <p className="font-medium">Không thể kết nối WebRTC</p>
            <p className="text-sm mt-2">Kiểm tra stream đang hoạt động và WebRTC đã bật</p>
          </div>
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900 z-10">
          <div className="text-center text-red-500">
            <p className="font-medium">Lỗi WebRTC</p>
            <p className="text-sm mt-2">{error}</p>
          </div>
        </div>
      )}
      <video
        ref={videoRef}
        className="w-full h-full"
        controls
        playsInline
        muted
        autoPlay
      />
      {connectionState === "running" && (
        <div className="absolute top-2 right-2 z-10">
          <span className="inline-flex items-center gap-1 rounded-full bg-green-600/80 px-2 py-0.5 text-xs text-white">
            <span className="h-1.5 w-1.5 rounded-full bg-white" />
            WebRTC
          </span>
        </div>
      )}
    </div>
  )
}
