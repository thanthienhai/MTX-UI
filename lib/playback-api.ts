export interface PlaybackSegment {
  path: string
  start: string
  duration: number
}

export interface PlaybackListParams {
  path: string
  start?: string
  end?: string
}

export interface PlaybackGetParams {
  path: string
  start: string
  duration?: string
  format?: "fmp4" | "mp4"
}

export interface PlaybackListResponse {
  segments: PlaybackSegment[]
  total: number
}

function withQuery(endpoint: string, query: Record<string, string | number | boolean | undefined | null>) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null) params.set(key, String(value))
  }
  const queryString = params.toString()
  if (!queryString) return endpoint
  return `${endpoint}${endpoint.includes("?") ? "&" : "?"}${queryString}`
}

export async function listRecordings(params: PlaybackListParams): Promise<PlaybackSegment[]> {
  const url = withQuery("/api/playback/list", params)
  const response = await fetch(url, { cache: "no-store" })
  if (!response.ok) {
    throw new Error(`Không thể tải danh sách bản ghi (${response.status})`)
  }
  const data: PlaybackListResponse = await response.json()
  return data.segments || []
}

export function buildPlaybackSegmentUrl(params: PlaybackGetParams): string {
  return withQuery("/api/playback/get", params)
}

export function getPlaybackErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return "Lỗi Playback API không xác định"
}
