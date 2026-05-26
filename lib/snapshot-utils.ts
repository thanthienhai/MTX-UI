import { getAuthHeader, getDashboardSession } from "./auth"
import { dirname, join, normalize, sep } from "path"
import { readdirSync, existsSync, statSync } from "fs"

export function getSnapshotBaseDir(): string {
  return process.env.SNAPSHOT_BASE_DIR || "./snapshots"
}

export interface SnapshotFile {
  filename: string
  url: string
  timestamp: string
}

/**
 * Sanitize a path name to prevent directory traversal.
 * Returns the sanitized name or null if traversal detected.
 */
export function sanitizePathName(pathName: string): string | null {
  // Remove any leading/trailing slashes and path separators
  const clean = pathName.replace(/^[\/\\]+|[\/\\]+$/g, "")

  // Reject empty
  if (!clean) return null

  // Reject traversal sequences
  if (clean.includes("..") || clean.includes("~")) return null

  // Reject absolute paths
  if (clean.startsWith("/") || clean.startsWith("\\") || /^[a-zA-Z]:/.test(clean)) return null

  // Only allow safe characters: alphanumeric, dashes, underscores, slashes, dots
  if (!/^[\w\-. \/]+$/.test(clean)) return null

  return clean
}

/**
 * Validate that the request has a valid auth session.
 * Uses the Authorization header or reads the session.
 */
export function isAuthenticated(request: Request): boolean {
  const authHeader = request.headers.get("authorization")
  if (authHeader && authHeader.length > 0) return true

  // Fallback: try reading auth token from cookies
  const cookie = request.headers.get("cookie")
  if (cookie && cookie.includes("mediamtx_dashboard_session")) return true

  return false
}

/**
 * Resolve the full filesystem path for a snapshot file, with traversal protection.
 * Returns null if path is unsafe.
 */
export function resolveSnapshotPath(pathName: string, filename?: string): string | null {
  const safePath = sanitizePathName(pathName)
  if (!safePath) return null

  const baseDir = getSnapshotBaseDir()
  const pathDir = join(baseDir, safePath)

  // Ensure the resolved path is within the base directory (prevent traversal)
  const resolvedBase = normalize(baseDir)
  const resolvedPath = normalize(pathDir)
  if (!resolvedPath.startsWith(resolvedBase + sep) && resolvedPath !== resolvedBase) {
    return null
  }

  if (filename) {
    const safeFilename = sanitizePathName(filename)
    if (!safeFilename) return null
    const filePath = join(pathDir, safeFilename)
    const resolvedFile = normalize(filePath)
    if (!resolvedFile.startsWith(resolvedBase + sep)) return null
    return resolvedFile
  }

  return pathDir
}

/**
 * List all snapshot files for a given path, sorted newest-first.
 */
export function listSnapshots(pathName: string): SnapshotFile[] {
  const dirPath = resolveSnapshotPath(pathName)
  if (!dirPath) return []

  try {
    if (!existsSync(dirPath)) return []

    const files = readdirSync(dirPath)
      .filter((f) => /\.(jpg|jpeg|png|gif|webp)$/i.test(f))
      .map((f) => {
        const fullPath = join(dirPath, f)
        const stats = statSync(fullPath)
        return {
          filename: f,
          url: `/api/snapshots/file?path=${encodeURIComponent(pathName)}&name=${encodeURIComponent(f)}`,
          timestamp: stats.mtime.toISOString(),
        }
      })
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

    return files
  } catch {
    return []
  }
}

/**
 * Get the latest snapshot for a path.
 */
export function getLatestSnapshot(pathName: string): SnapshotFile | null {
  const snapshots = listSnapshots(pathName)
  return snapshots.length > 0 ? snapshots[0] : null
}

/**
 * Delete a snapshot file.
 */
export function deleteSnapshot(pathName: string, filename: string): boolean {
  const filePath = resolveSnapshotPath(pathName, filename)
  if (!filePath) return false

  try {
    if (!existsSync(filePath)) return false
    const { unlinkSync } = require("fs")
    unlinkSync(filePath)
    return true
  } catch {
    return false
  }
}
