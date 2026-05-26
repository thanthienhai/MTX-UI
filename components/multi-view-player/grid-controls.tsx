"use client"

import { useCallback } from "react"
import { Columns2, Columns3, VolumeX, Volume2, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { GridSize } from "./use-multi-view"
import type { Path as LivePath } from "@/lib/mediamtx-api"

interface GridControlsProps {
  gridSize: GridSize
  onGridSizeChange: (size: GridSize) => void
  allMuted: boolean
  onMuteAll: () => void
  onUnmuteAll: () => void
  availablePaths: LivePath[]
  onAddStream: (pathName: string) => void
  slotCount: number
  maxSlots: number
}

export function GridControls({
  gridSize,
  onGridSizeChange,
  allMuted,
  onMuteAll,
  onUnmuteAll,
  availablePaths,
  onAddStream,
  slotCount,
  maxSlots,
}: GridControlsProps) {
  const handleAddStream = useCallback(
    (value: string) => {
      if (value && value !== "__none__") {
        onAddStream(value)
      }
    },
    [onAddStream],
  )

  const canAddMore = slotCount < maxSlots

  return (
    <div className="mb-4 flex flex-wrap items-center gap-3">
      {/* Grid size selector */}
      <div className="flex items-center gap-1 rounded-lg border p-1">
        <Button
          variant={gridSize === "2x2" ? "default" : "ghost"}
          size="sm"
          onClick={() => onGridSizeChange("2x2")}
          className="h-8 px-3"
        >
          <Columns2 className="mr-1.5 h-4 w-4" />
          2×2
        </Button>
        <Button
          variant={gridSize === "3x3" ? "default" : "ghost"}
          size="sm"
          onClick={() => onGridSizeChange("3x3")}
          className="h-8 px-3"
        >
          <Columns3 className="mr-1.5 h-4 w-4" />
          3×3
        </Button>
      </div>

      {/* Mute All / Unmute All */}
      <Button variant="outline" size="sm" onClick={allMuted ? onUnmuteAll : onMuteAll}>
        {allMuted ? (
          <>
            <Volume2 className="mr-1.5 h-4 w-4" />
            Unmute All
          </>
        ) : (
          <>
            <VolumeX className="mr-1.5 h-4 w-4" />
            Mute All
          </>
        )}
      </Button>

      {/* Add stream dropdown */}
      <div className="ml-auto flex items-center gap-2">
        <span className="text-xs text-muted-foreground">
          {slotCount}/{maxSlots}
        </span>
        <Select onValueChange={handleAddStream} disabled={!canAddMore}>
          <SelectTrigger className="h-8 w-48">
            <Plus className="mr-1.5 h-4 w-4" />
            <SelectValue placeholder="Add stream..." />
          </SelectTrigger>
          <SelectContent>
            {availablePaths.length === 0 ? (
              <SelectItem value="__none__" disabled>
                No live streams available
              </SelectItem>
            ) : (
              availablePaths.map((p) => (
                <SelectItem key={p.name} value={p.name}>
                  {p.name}
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
