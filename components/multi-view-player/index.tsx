"use client"

import { useCallback, useEffect, useMemo, useRef } from "react"
import { Video } from "lucide-react"
import { GridControls } from "./grid-controls"
import { GridCell } from "./grid-cell"
import { useMultiView, type GridSize } from "./use-multi-view"
import { EmptyState } from "@/components/module-state"
import type { Path as LivePath } from "@/lib/mediamtx-api"

interface MultiViewPlayerProps {
  livePaths: LivePath[]
  isWebRTCEnabled: boolean
}

export function MultiViewPlayer({ livePaths, isWebRTCEnabled }: MultiViewPlayerProps) {
  const {
    slots,
    gridSize,
    pinnedSlotId,
    mutedSlotIds,
    maxSlots,
    setGridSize,
    addStream,
    removeStream,
    togglePin,
    toggleMute,
    muteAll,
    unmuteAll,
    isMuted,
    isPinned,
    allMuted,
  } = useMultiView()

  const cellRefs = useRef<Map<string, HTMLDivElement>>(new Map())

  // Auto-populate grid on mount with available live paths
  useEffect(() => {
    if (slots.length === 0 && livePaths.length > 0) {
      const toAdd = livePaths.slice(0, maxSlots)
      toAdd.forEach((p) => {
        const protocol = isWebRTCEnabled ? "webrtc" : "hls"
        addStream(p.name, protocol, p.ready)
      })
    }
    // Only run on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Paths not yet in any slot
  const availablePaths = useMemo(() => {
    const inSlot = new Set(slots.map((s) => s.pathName))
    return livePaths.filter((p) => !inSlot.has(p.name))
  }, [livePaths, slots])

  const handleAddStream = useCallback(
    (pathName: string) => {
      const path = livePaths.find((p) => p.name === pathName)
      if (!path) return
      const protocol = isWebRTCEnabled ? "webrtc" : "hls"
      addStream(pathName, protocol, path.ready)
    },
    [livePaths, isWebRTCEnabled, addStream],
  )

  const handleFullscreen = useCallback((slotId: string) => {
    const el = cellRefs.current.get(slotId)
    if (el) {
      el.requestFullscreen?.()
    }
  }, [])

  const gridCols = gridSize === "2x2" ? "grid-cols-2" : "grid-cols-3"

  if (livePaths.length === 0) {
    return (
      <EmptyState
        icon={<Video className="mb-3 h-10 w-10 text-[#5b616e]" />}
        title="No Live Streams"
        action={<p className="mt-2 text-xs">There are no active live streams to display. Start publishing to a path to see it here.</p>}
      />
    )
  }

  return (
    <div>
      <GridControls
        gridSize={gridSize}
        onGridSizeChange={setGridSize}
        allMuted={allMuted}
        onMuteAll={muteAll}
        onUnmuteAll={unmuteAll}
        availablePaths={availablePaths}
        onAddStream={handleAddStream}
        slotCount={slots.length}
        maxSlots={maxSlots}
      />

      {slots.length === 0 ? (
        <EmptyState
          icon={<Video className="mb-3 h-10 w-10 text-[#5b616e]" />}
          title="Grid is Empty"
          action={<p className="mt-2 text-xs">Add a live stream using the dropdown above.</p>}
        />
      ) : (
        <div className={`grid ${gridCols} gap-3`}>
          {slots.map((slot) => (
            <div
              key={slot.id}
              ref={(el) => {
                if (el) cellRefs.current.set(slot.id, el)
                else cellRefs.current.delete(slot.id)
              }}
            >
              <GridCell
                slot={slot}
                isPinned={isPinned(slot.id)}
                isMuted={isMuted(slot.id)}
                onPin={() => togglePin(slot.id)}
                onMute={() => toggleMute(slot.id)}
                onFullscreen={() => handleFullscreen(slot.id)}
                onRemove={() => removeStream(slot.id)}
              />
            </div>
          ))}

          {/* Empty placeholder slots */}
          {Array.from({ length: maxSlots - slots.length }).map((_, i) => (
            <div
              key={`empty-${i}`}
              className="flex aspect-video items-center justify-center rounded-lg border border-dashed bg-muted/20 text-sm text-muted-foreground"
            >
              Empty slot
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
