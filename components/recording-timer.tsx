"use client"

import { useEffect, useState } from "react"

interface RecordingTimerProps {
  startedAt: string | null
  className?: string
}

function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  const pad = (n: number) => String(n).padStart(2, "0")
  if (h > 0) return `${pad(h)}:${pad(m)}:${pad(s)}`
  return `${pad(m)}:${pad(s)}`
}

export function RecordingTimer({ startedAt, className = "" }: RecordingTimerProps) {
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    if (!startedAt) {
      setElapsed(0)
      return
    }
    const startMs = new Date(startedAt).getTime()
    if (isNaN(startMs)) return

    const tick = () => {
      setElapsed(Math.max(0, Math.floor((Date.now() - startMs) / 1000)))
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [startedAt])

  if (!startedAt) return null

  return (
    <span className={`font-mono tabular-nums ${className}`}>
      {formatElapsed(elapsed)}
    </span>
  )
}
