/**
 * Fallback asset storage (server-side).
 *
 * image/video fallback slates need a real file that the MediaMTX-side ffmpeg
 * can read. Since the frontend and MediaMTX run on different hosts, we store
 * uploads on the frontend's disk and serve them over HTTP at
 * `/api/public/asset/<id>` (see lib/relay-event.mjs `fallbackAssetUrl`).
 *
 * Storage dir is RELAY_ASSET_DIR (mount a volume in Docker). The asset id is a
 * 128-bit random hex string — unguessable, so the serve route needs no auth
 * (same share-by-secret model as the relay tokens).
 *
 * Server-only: never import from a Client Component.
 */

import { createReadStream, type ReadStream } from "node:fs"
import { mkdir, readFile, stat, writeFile } from "node:fs/promises"
import { randomBytes } from "node:crypto"
import path from "node:path"

export interface StoredAsset {
  id: string
  name: string
  mime: string
  size: number
}

const ID_RE = /^[a-f0-9]{32}$/

const ALLOWED_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
}

function assetDir(): string {
  return (process.env.RELAY_ASSET_DIR || path.join(process.cwd(), ".relay-assets")).trim()
}

function maxBytes(): number {
  const mb = Number(process.env.RELAY_ASSET_MAX_MB || "100")
  return (Number.isFinite(mb) && mb > 0 ? mb : 100) * 1024 * 1024
}

export function isAllowedMime(mime: string): boolean {
  return !!ALLOWED_MIME[String(mime || "").toLowerCase()]
}

export function fallbackKindForMime(mime: string): "image" | "video" | null {
  const m = String(mime || "").toLowerCase()
  if (m.startsWith("image/")) return "image"
  if (m.startsWith("video/")) return "video"
  return null
}

/** Persist an uploaded asset; returns its id + metadata. */
export async function saveAsset(
  data: Buffer,
  opts: { mime: string; originalName?: string },
): Promise<StoredAsset> {
  const mime = String(opts.mime || "").toLowerCase()
  if (!isAllowedMime(mime)) throw new Error("unsupported_type")
  if (data.length === 0) throw new Error("empty_file")
  if (data.length > maxBytes()) throw new Error("too_large")

  const dir = assetDir()
  await mkdir(dir, { recursive: true })
  const id = randomBytes(16).toString("hex")
  const name = String(opts.originalName || `slate.${ALLOWED_MIME[mime]}`).slice(0, 200)
  await writeFile(path.join(dir, id), data)
  await writeFile(path.join(dir, `${id}.json`), JSON.stringify({ mime, name, size: data.length }), "utf8")
  return { id, name, mime, size: data.length }
}

interface AssetMeta {
  mime: string
  name: string
  size: number
}

async function readAssetMeta(id: string): Promise<AssetMeta | null> {
  try {
    const raw = await readFile(path.join(assetDir(), `${id}.json`), "utf8")
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed.mime !== "string") return null
    return { mime: parsed.mime, name: String(parsed.name || ""), size: Number(parsed.size || 0) }
  } catch {
    return null
  }
}

export interface AssetForServe {
  mime: string
  size: number
  createStream: (range?: { start: number; end: number }) => ReadStream
}

/** Resolve a stored asset for serving. Returns null when id is invalid/missing. */
export async function getAssetForServe(id: string): Promise<AssetForServe | null> {
  if (!ID_RE.test(String(id || ""))) return null
  const meta = await readAssetMeta(id)
  if (!meta) return null
  const filePath = path.join(assetDir(), id)
  let size: number
  try {
    size = (await stat(filePath)).size
  } catch {
    return null
  }
  return {
    mime: meta.mime,
    size,
    createStream: (range) => createReadStream(filePath, range ? { start: range.start, end: range.end } : undefined),
  }
}
