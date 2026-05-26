"use client"

import type { Path } from "@/lib/mediamtx-api"

interface PathStateBadgeProps {
  path: Path
}

/**
 * Displays the runtime state of a path as a color-coded badge.
 * - Green "Ready" when path.ready === true
 * - Yellow "Connecting" when path.source !== null && !path.ready
 * - Gray "Offline" when path.source === null && !path.ready
 */
export function PathStateBadge({ path }: PathStateBadgeProps) {
  if (path.ready) {
    return (
      <span
        title={path.readyTime ? `Ready since: ${path.readyTime}` : "Ready"}
        className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
        Ready
      </span>
    )
  }

  if (path.source) {
    return (
      <span
        title="Source detected but not yet ready"
        className="inline-flex items-center gap-1 rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-700"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-yellow-500" />
        Connecting
      </span>
    )
  }

  return (
    <span
      title="No source connected"
      className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500"
    >
      <span className="h-1.5 w-1.5 rounded-full bg-gray-400" />
      Offline
    </span>
  )
}
