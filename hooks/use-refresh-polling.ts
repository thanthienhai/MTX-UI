"use client"

import { useCallback, useEffect, useRef, useState } from "react"

interface UseRefreshPollingOptions {
  enabled: boolean
  intervalMs: number
  refresh: () => Promise<void>
}

export function useRefreshPolling({ enabled, intervalMs, refresh }: UseRefreshPollingOptions) {
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const refreshRef = useRef(refresh)

  useEffect(() => {
    refreshRef.current = refresh
  }, [refresh])

  const runRefresh = useCallback(async () => {
    setIsRefreshing(true)
    setError(null)
    try {
      await refreshRef.current()
    } catch (caught) {
      setError(caught)
      throw caught
    } finally {
      setIsRefreshing(false)
    }
  }, [])

  useEffect(() => {
    if (!enabled || intervalMs <= 0) return

    let cancelled = false
    const tick = () => {
      if (document.visibilityState === "hidden" || cancelled) return
      runRefresh().catch(() => undefined)
    }
    const interval = window.setInterval(tick, intervalMs)

    return () => {
      cancelled = true
      window.clearInterval(interval)
    }
  }, [enabled, intervalMs, runRefresh])

  return { isRefreshing, error, refresh: runRefresh }
}

