"use client"

import { useCallback, useMemo, useState } from "react"

export type GridSize = "2x2" | "3x3"

export interface StreamSlot {
  id: string
  pathName: string
  protocol: "hls" | "webrtc"
  isLive: boolean
}

interface MultiViewState {
  gridSize: GridSize
  slots: StreamSlot[]
  pinnedSlotId: string | null
  mutedSlotIds: string[]
}

export function useMultiView() {
  const [state, setState] = useState<MultiViewState>({
    gridSize: "2x2",
    slots: [],
    pinnedSlotId: null,
    mutedSlotIds: [],
  })

  const maxSlots = useMemo(() => (state.gridSize === "2x2" ? 4 : 9), [state.gridSize])

  const setGridSize = useCallback((size: GridSize) => {
    setState((prev) => ({
      ...prev,
      gridSize: size,
      pinnedSlotId: null,
    }))
  }, [])

  const addStream = useCallback(
    (pathName: string, protocol: "hls" | "webrtc", isLive: boolean) => {
      setState((prev) => {
        if (prev.slots.length >= maxSlots) return prev
        if (prev.slots.some((s) => s.pathName === pathName)) return prev
        const slot: StreamSlot = {
          id: crypto.randomUUID(),
          pathName,
          protocol,
          isLive,
        }
        return { ...prev, slots: [...prev.slots, slot] }
      })
    },
    [maxSlots],
  )

  const removeStream = useCallback((slotId: string) => {
    setState((prev) => ({
      ...prev,
      slots: prev.slots.filter((s) => s.id !== slotId),
      pinnedSlotId: prev.pinnedSlotId === slotId ? null : prev.pinnedSlotId,
      mutedSlotIds: prev.mutedSlotIds.filter((id) => id !== slotId),
    }))
  }, [])

  const togglePin = useCallback((slotId: string) => {
    setState((prev) => ({
      ...prev,
      pinnedSlotId: prev.pinnedSlotId === slotId ? null : slotId,
    }))
  }, [])

  const toggleMute = useCallback((slotId: string) => {
    setState((prev) => {
      const isMuted = prev.mutedSlotIds.includes(slotId)
      return {
        ...prev,
        mutedSlotIds: isMuted
          ? prev.mutedSlotIds.filter((id) => id !== slotId)
          : [...prev.mutedSlotIds, slotId],
      }
    })
  }, [])

  const muteAll = useCallback(() => {
    setState((prev) => ({
      ...prev,
      mutedSlotIds: prev.slots.map((s) => s.id),
    }))
  }, [])

  const unmuteAll = useCallback(() => {
    setState((prev) => ({
      ...prev,
      mutedSlotIds: [],
    }))
  }, [])

  const isMuted = useCallback(
    (slotId: string) => state.mutedSlotIds.includes(slotId),
    [state.mutedSlotIds],
  )

  const isPinned = useCallback(
    (slotId: string) => state.pinnedSlotId === slotId,
    [state.pinnedSlotId],
  )

  return {
    ...state,
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
    allMuted: state.mutedSlotIds.length > 0 && state.mutedSlotIds.length >= state.slots.length,
  }
}
