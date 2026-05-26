"use client"

import type { PathConf, Path } from "@/lib/mediamtx-api"

export type CommandLifecycleState =
  | "running"
  | "starting"
  | "idle"
  | "stopped"
  | "failed"
  | "unknown"

interface CommandLifecycleBadgeProps {
  config: Pick<PathConf, "runOnInit" | "runOnDemand"> | null
  runtime: Path | null
}

/**
 * Infers the lifecycle state of a runOnInit / runOnDemand command
 * from available runtime path data.
 *
 * Since MediaMTX runtime API does not expose process state (pid, exit code),
 * we infer from:
 * - `runtime.ready`         → source is streaming
 * - `runtime.source`        → source connection exists
 * - `runtime.readers`       → active consumers
 * - `runtime.readyTime`     → when stream became ready
 * - `config.runOnInit`      → "Always Pull" command
 * - `config.runOnDemand`    → "On-Demand" command
 */
function inferCommandState(config: CommandLifecycleBadgeProps["config"], runtime: Path | null): CommandLifecycleState {
  if (!config || (!config.runOnInit && !config.runOnDemand)) return "unknown"

  const hasCmd = config.runOnInit || config.runOnDemand
  const isOnDemand = !!config.runOnDemand

  // No runtime path at all
  if (!runtime) {
    if (isOnDemand) return "idle"      // waiting for a reader to trigger it
    return "failed"                     // should always be running but isn't
  }

  // Has runtime path — inspect state
  if (runtime.ready) return "running"   // source is streaming

  if (runtime.source && !runtime.ready) return "starting"  // source connected but buffering

  // !runtime.ready and no source
  if (isOnDemand) {
    if (runtime.readers.length > 0) return "starting"      // readers waiting for command
    return "idle"                                            // no readers, not triggered
  }

  // runOnInit — should always be running, but isn't
  return "failed"
}

const STATE_CONFIG: Record<CommandLifecycleState, {
  label: string
  color: string
  bg: string
  dot: string
  description: string
}> = {
  running: {
    label: "Running",
    color: "text-green-700",
    bg: "bg-green-100",
    dot: "bg-green-500",
    description: "Command is running and stream is ready",
  },
  starting: {
    label: "Starting",
    color: "text-yellow-700",
    bg: "bg-yellow-100",
    dot: "bg-yellow-500",
    description: "Command is starting or source is connecting",
  },
  idle: {
    label: "Idle",
    color: "text-gray-600",
    bg: "bg-gray-100",
    dot: "bg-gray-400",
    description: "Waiting for reader to trigger on-demand command",
  },
  stopped: {
    label: "Stopped",
    color: "text-red-700",
    bg: "bg-red-100",
    dot: "bg-red-500",
    description: "Command has stopped or was terminated",
  },
  failed: {
    label: "Failed",
    color: "text-red-700",
    bg: "bg-red-100",
    dot: "bg-red-500",
    description: "Command failed or did not start",
  },
  unknown: {
    label: "—",
    color: "text-gray-400",
    bg: "bg-transparent",
    dot: "bg-gray-300",
    description: "No command configured",
  },
}

export function CommandLifecycleBadge({ config, runtime }: CommandLifecycleBadgeProps) {
  const state = inferCommandState(config, runtime)
  const cfg = STATE_CONFIG[state]

  return (
    <span
      title={`${cfg.description}${runtime?.readyTime ? `\nReady since: ${runtime.readyTime}` : ""}`}
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${cfg.bg} ${cfg.color}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  )
}

/**
 * Detailed lifecycle panel — shows more context than the compact badge.
 * Useful inside configuration dialogs or path detail drawers.
 */
export function CommandLifecycleDetail({ config, runtime }: CommandLifecycleBadgeProps) {
  const state = inferCommandState(config, runtime)
  const cfg = STATE_CONFIG[state]

  if (state === "unknown") return null

  const isOnDemand = !!config?.runOnDemand
  const hasReaders = (runtime?.readers?.length ?? 0) > 0
  const readyAgo = runtime?.readyTime
    ? formatTimeAgo(runtime.readyTime)
    : null

  return (
    <div className="rounded-lg border bg-card p-3 text-sm">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Command Lifecycle
        </span>
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${cfg.bg} ${cfg.color}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
          {cfg.label}
        </span>
      </div>
      <div className="space-y-1 text-xs text-muted-foreground">
        <div className="flex justify-between">
          <span>Mode</span>
          <span className="font-medium text-foreground">
            {isOnDemand ? "On-Demand" : "Always Pull"}
          </span>
        </div>
        {readyAgo && (
          <div className="flex justify-between">
            <span>Ready time</span>
            <span className="font-medium text-foreground">{readyAgo}</span>
          </div>
        )}
        {hasReaders && (
          <div className="flex justify-between">
            <span>Active readers</span>
            <span className="font-medium text-foreground">{runtime!.readers.length}</span>
          </div>
        )}
        {runtime && (
          <>
            <div className="flex justify-between">
              <span>Source</span>
              <span className="font-medium text-foreground">
                {runtime.source ? `${runtime.source.type}:${runtime.source.id}` : "None"}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Tracks</span>
              <span className="font-medium text-foreground">
                {runtime.tracks.length > 0 ? runtime.tracks.join(", ") : "None"}
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function formatTimeAgo(isoString: string): string {
  const then = new Date(isoString).getTime()
  const now = Date.now()
  const diffMs = now - then
  if (diffMs < 0) return "just now"
  const seconds = Math.floor(diffMs / 1000)
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}
