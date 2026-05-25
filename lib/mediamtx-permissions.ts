export const MEDIAMTX_ACTIONS = ["api", "metrics", "pprof", "publish", "read", "playback"] as const

export type MediaMtxAction = (typeof MEDIAMTX_ACTIONS)[number]
export type MediaMtxPermissionSet = Partial<Record<MediaMtxAction, boolean>>

const DEFAULT_PERMISSIONS: Record<MediaMtxAction, boolean> = {
  api: true,
  metrics: true,
  pprof: true,
  publish: true,
  read: true,
  playback: true,
}

export function getDefaultMediaMtxPermissions(): Record<MediaMtxAction, boolean> {
  return { ...DEFAULT_PERMISSIONS }
}

export function normalizeMediaMtxPermissions(permissions?: MediaMtxPermissionSet | null): Record<MediaMtxAction, boolean> {
  return MEDIAMTX_ACTIONS.reduce(
    (resolved, action) => {
      resolved[action] = permissions?.[action] !== false
      return resolved
    },
    {} as Record<MediaMtxAction, boolean>,
  )
}

export function canPerformMediaMtxAction(permissions: MediaMtxPermissionSet, action: MediaMtxAction) {
  return permissions[action] !== false
}

export function requireMediaMtxAction(permissions: MediaMtxPermissionSet, action: MediaMtxAction) {
  if (!canPerformMediaMtxAction(permissions, action)) {
    throw new Error(`Thiếu quyền MediaMTX: ${action}`)
  }
}
