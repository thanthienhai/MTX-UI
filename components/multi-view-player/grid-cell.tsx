"use client"

import { useRef } from "react"
import { Mic, MicOff, Pin, PinOff, Maximize2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { StreamPlayer } from "@/components/stream-player"
import { WHEPPlayer } from "@/components/whep-player"
import type { StreamSlot } from "./use-multi-view"

interface GridCellProps {
  slot: StreamSlot
  isPinned: boolean
  isMuted: boolean
  onPin: () => void
  onMute: () => void
  onFullscreen: () => void
  onRemove: () => void
}

export function GridCell({
  slot,
  isPinned,
  isMuted,
  onPin,
  onMute,
  onFullscreen,
  onRemove,
}: GridCellProps) {
  const cellRef = useRef<HTMLDivElement>(null)

  return (
    <div
      ref={cellRef}
      className={`group relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-lg border bg-black ${
        isPinned ? "col-span-2 row-span-2" : ""
      }`}
    >
      {/* Player */}
      {slot.protocol === "webrtc" ? (
        <WHEPPlayer pathName={slot.pathName} className="h-full w-full" />
      ) : (
        <StreamPlayer pathName={slot.pathName} />
      )}

      {/* Stream name label */}
      <div className="pointer-events-none absolute bottom-2 left-2 z-10 rounded bg-black/60 px-2 py-0.5 text-xs text-white">
        {slot.pathName}
        {slot.protocol === "webrtc" && (
          <span className="ml-1.5 rounded bg-green-600 px-1 py-0.5 text-[10px] uppercase">
            WebRTC
          </span>
        )}
      </div>

      {/* Action buttons — visible on hover */}
      <div className="absolute right-2 top-2 z-10 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        <Button
          variant="secondary"
          size="icon"
          className="h-7 w-7"
          onClick={onPin}
          title={isPinned ? "Unpin stream" : "Pin stream"}
        >
          {isPinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
        </Button>
        <Button
          variant="secondary"
          size="icon"
          className="h-7 w-7"
          onClick={onMute}
          title={isMuted ? "Unmute" : "Mute"}
        >
          {isMuted ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
        </Button>
        <Button
          variant="secondary"
          size="icon"
          className="h-7 w-7"
          onClick={onFullscreen}
          title="Fullscreen"
        >
          <Maximize2 className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="secondary"
          size="icon"
          className="h-7 w-7"
          onClick={onRemove}
          title="Remove stream"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
}
