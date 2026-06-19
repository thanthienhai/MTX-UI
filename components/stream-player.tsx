"use client"

import { useEffect, useRef, useState } from "react"
import Hls from "hls.js"
import { buildMediaMtxHlsUrl } from "@/lib/mediamtx-url.mjs"

interface StreamPlayerProps {
  /** Path name resolved against the configured HLS base. Ignored when `hlsUrl` is set. */
  pathName?: string
  /** Explicit HLS playlist URL (e.g. a token-gated public proxy). Takes precedence. */
  hlsUrl?: string
}

type PlayerState = "loading" | "playing" | "waiting" | "error"

// The token-gated proxy + on-demand muxer can briefly 404/stall right after a
// source (re)connects. Retry quietly several times before surfacing a hard error.
const MAX_RETRIES = 8
const RETRY_DELAY_MS = 2000

export function StreamPlayer({ pathName, hlsUrl: explicitHlsUrl }: StreamPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const hlsRef = useRef<Hls | null>(null)
  const retriesRef = useRef(0)
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [state, setState] = useState<PlayerState>("loading")

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const hlsUrl = explicitHlsUrl || buildMediaMtxHlsUrl(pathName)
    let disposed = false

    const clearRetryTimer = () => {
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current)
        retryTimerRef.current = null
      }
    }

    const teardown = () => {
      clearRetryTimer()
      if (hlsRef.current) {
        hlsRef.current.destroy()
        hlsRef.current = null
      }
    }

    // Schedule another attempt while the stream warms up; give up after MAX_RETRIES.
    const scheduleRetry = () => {
      if (disposed) return
      if (retriesRef.current >= MAX_RETRIES) {
        setState("error")
        return
      }
      retriesRef.current += 1
      setState("waiting")
      clearRetryTimer()
      retryTimerRef.current = setTimeout(() => {
        if (!disposed) start()
      }, RETRY_DELAY_MS)
    }

    const onPlaying = () => {
      if (disposed) return
      retriesRef.current = 0
      setState("playing")
    }

    // Native (Safari) playback errors aren't routed through hls.js — retry here.
    const onNativeError = () => {
      if (disposed || hlsRef.current) return
      scheduleRetry()
    }

    const start = () => {
      if (disposed) return
      teardown()
      if (retriesRef.current === 0) setState("loading")

      // Safari and friends play HLS natively — no hls.js needed.
      if (video.canPlayType("application/vnd.apple.mpegurl")) {
        video.src = hlsUrl
        video.load()
        video.play().catch(() => {})
        return
      }

      if (!Hls.isSupported()) {
        setState("error")
        return
      }

      // lowLatencyMode is intentionally OFF: LL-HLS' many tiny parts churn badly
      // through the token-gated proxy and cause stutter/disconnects. Standard
      // HLS trades a few seconds of latency for a steady preview.
      const hls = new Hls({ enableWorker: true, lowLatencyMode: false })
      hlsRef.current = hls
      hls.loadSource(hlsUrl)
      hls.attachMedia(video)

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        video.play().catch(() => {})
      })

      hls.on(Hls.Events.FRAG_BUFFERED, onPlaying)

      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (disposed || !data.fatal) return
        // Try in-place recovery first; fall back to a full re-init via retry.
        if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
          scheduleRetry()
        } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
          retriesRef.current += 1
          if (retriesRef.current <= MAX_RETRIES) {
            setState("waiting")
            hls.recoverMediaError()
          } else {
            setState("error")
          }
        } else {
          scheduleRetry()
        }
      })
    }

    retriesRef.current = 0
    video.addEventListener("playing", onPlaying)
    video.addEventListener("error", onNativeError)
    start()

    return () => {
      disposed = true
      video.removeEventListener("playing", onPlaying)
      video.removeEventListener("error", onNativeError)
      teardown()
    }
  }, [pathName, explicitHlsUrl])

  return (
    <div className="relative w-full bg-black rounded-lg overflow-hidden" style={{ aspectRatio: "16/9" }}>
      {(state === "loading" || state === "waiting") && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-white mb-2"></div>
            <p className="text-white text-sm">
              {state === "waiting" ? "Đang chờ tín hiệu nguồn…" : "Đang tải stream..."}
            </p>
          </div>
        </div>
      )}
      {state === "error" && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
          <div className="text-center text-red-500">
            <p className="font-medium">Không thể tải stream</p>
            <p className="text-sm mt-2">Kiểm tra stream đang hoạt động và HLS đã bật</p>
          </div>
        </div>
      )}
      <video ref={videoRef} className="w-full h-full" controls playsInline muted />
    </div>
  )
}
