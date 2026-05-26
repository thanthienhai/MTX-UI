import { getAuthHeader } from "./auth"
import { buildMediaMtxApiUrl } from "./mediamtx-url.mjs"

type JsonObject = Record<string, unknown>
type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE"

export interface MediaMtxErrorBody {
  error?: string
  message?: string
  details?: unknown
  [key: string]: unknown
}

export interface MediaMtxApiErrorOptions {
  method: HttpMethod
  endpoint: string
  status?: number
  statusText?: string
  body?: MediaMtxErrorBody | string | null
  rawBody?: string
  cause?: unknown
  message?: string
}

export class MediaMtxApiError extends Error {
  method: HttpMethod
  endpoint: string
  status?: number
  statusText?: string
  body?: MediaMtxErrorBody | string | null
  rawBody?: string
  userMessage: string

  constructor(options: MediaMtxApiErrorOptions) {
    const message = options.message || buildUserMessage(options)
    super(message, { cause: options.cause })
    this.name = "MediaMtxApiError"
    this.method = options.method
    this.endpoint = options.endpoint
    this.status = options.status
    this.statusText = options.statusText
    this.body = options.body
    this.rawBody = options.rawBody
    this.userMessage = message
  }
}

function buildUserMessage(options: MediaMtxApiErrorOptions) {
  if (typeof options.body === "object" && options.body) {
    const bodyMessage = options.body.error || options.body.message
    if (typeof bodyMessage === "string" && bodyMessage.trim()) return bodyMessage
  }

  if (typeof options.body === "string" && options.body.trim()) return options.body

  if (options.status) {
    return `Yêu cầu MediaMTX API thất bại (${options.status}${options.statusText ? ` ${options.statusText}` : ""})`
  }

  return "Không thể gọi MediaMTX API. Kiểm tra URL API, mạng và quyền truy cập."
}

export function getMediaMtxErrorMessage(error: unknown) {
  if (error instanceof MediaMtxApiError) return error.userMessage
  if (error instanceof Error) return error.message
  return "Lỗi MediaMTX API không xác định"
}

export interface AuthInternalUserPermission {
  action: string
  path?: string
}

export interface AuthInternalUser {
  user: string
  pass?: string
  ips?: string[]
  permissions?: AuthInternalUserPermission[]
}

export interface GlobalConf extends JsonObject {
  logLevel?: string
  logDestinations?: string
  logStructured?: boolean
  logFile?: string
  sysLogPrefix?: string
  dumpPackets?: boolean
  readTimeout?: string
  writeTimeout?: string
  writeQueueSize?: number
  udpMaxPayloadSize?: number
  udpReadBufferSize?: number
  runOnConnect?: string
  runOnConnectRestart?: boolean
  runOnDisconnect?: string
  rtsp?: boolean
  rtspTransports?: string[]
  rtspEncryption?: string
  rtspAddress?: string
  rtspsAddress?: string
  rtpAddress?: string
  rtcpAddress?: string
  multicastIPRange?: string
  multicastRTPPort?: number
  multicastRTCPPort?: number
  srtpAddress?: string
  srtcpAddress?: string
  multicastSRTPPort?: number
  multicastSRTCPPort?: number
  rtspServerKey?: string
  rtspServerCert?: string
  rtspAuthMethods?: string[]
  rtspUDPReadBufferSize?: number
  rtmp?: boolean
  rtmpEncryption?: string
  rtmpAddress?: string
  rtmpsAddress?: string
  rtmpServerKey?: string
  rtmpServerCert?: string
  hls?: boolean
  hlsAddress?: string
  hlsEncryption?: boolean
  hlsServerKey?: string
  hlsServerCert?: string
  hlsAllowOrigin?: string
  hlsTrustedProxies?: string[]
  hlsAlwaysRemux?: boolean
  hlsVariant?: string
  hlsSegmentCount?: number
  hlsSegmentDuration?: string
  hlsPartDuration?: string
  hlsSegmentMaxSize?: string
  hlsDirectory?: string
  hlsMuxerCloseAfter?: string
  webrtc?: boolean
  webrtcAddress?: string
  webrtcEncryption?: boolean
  webrtcServerKey?: string
  webrtcServerCert?: string
  webrtcAllowOrigin?: string
  webrtcTrustedProxies?: string[]
  webrtcLocalUDPAddress?: string
  webrtcLocalTCPAddress?: string
  webrtcIPsFromInterfaces?: boolean
  webrtcIPsFromInterfacesList?: string[]
  webrtcAdditionalHosts?: string[]
  webrtcICEServers2?: unknown[]
  webrtcHandshakeTimeout?: string
  webrtcTrackGatherTimeout?: string
  webrtcSTUNGatherTimeout?: string
  srt?: boolean
  srtAddress?: string
  rtspDemuxMpegts?: boolean
  api?: boolean
  apiAddress?: string
  metrics?: boolean
  metricsAddress?: string
  pprof?: boolean
  pprofAddress?: string
  playback?: boolean
  playbackAddress?: string
  playbackEncryption?: boolean
  playbackServerKey?: string
  playbackServerCert?: string
  playbackAllowOrigin?: string
  playbackTrustedProxies?: string[]
  authMethod?: "internal" | "http" | "jwt" | string
  authInternalUsers?: AuthInternalUser[]
  authHTTPAddress?: string
  authHTTPFingerprint?: string
  authHTTPExclude?: AuthInternalUserPermission[]
  authJWTJWKS?: string
  authJWTJWKSFingerprint?: string
  authJWTClaimKey?: string
  authJWTExclude?: AuthInternalUserPermission[]
  authJWTIssuer?: string
  authJWTAudience?: string
  authJWTInHTTPQuery?: boolean
}

export interface PathConf extends JsonObject {
  name: string
  source: string
  runOnInit?: string
  runOnInitRestart?: boolean
  runOnDemand?: string
  runOnDemandRestart?: boolean
  runOnDemandStartTimeout?: string
  runOnDemandCloseAfter?: string
  runOnUnDemand?: string
  runOnReady?: string
  runOnReadyRestart?: boolean
  runOnNotReady?: string
  runOnRead?: string
  runOnReadRestart?: boolean
  runOnUnread?: string
  runOnRecordSegmentCreate?: string
  runOnRecordSegmentComplete?: string
  sourceFingerprint?: string
  sourceOnDemand?: boolean
  sourceOnDemandStartTimeout?: string
  sourceOnDemandCloseAfter?: string
  maxReaders?: number
  fallback?: string
  record?: boolean
  recordPath?: string
  recordFormat?: string
  recordPartDuration?: string
  recordSegmentDuration?: string
  recordDeleteAfter?: string
  recordMaxPartSize?: string
  overridePublisher?: boolean
  useAbsoluteTimestamp?: boolean
  srtReadPassphrase?: string
  srtPublishPassphrase?: string
  rtspTransport?: string
  rtspAnyPort?: boolean
  rtspRangeType?: string
  rtspRangeStart?: string
  rtspUDPReadBufferSize?: number
  mpegtsUDPReadBufferSize?: number
  rtpSDP?: string
  rtpUDPReadBufferSize?: number
}

export type PathConfig = PathConf

export interface ListResponse<T> {
  itemCount?: number
  pageCount?: number
  items: T[]
}

export type PathConfList = ListResponse<PathConf>

export interface PathSource {
  type: string
  id: string
}

export interface PathReader {
  type: string
  id: string
  bytesReceived?: number
  bytesSent?: number
}

export interface Path extends JsonObject {
  name: string
  confName: string
  source: PathSource | null
  ready: boolean
  readyTime: string | null
  tracks: string[]
  bytesReceived: number
  bytesSent: number
  readers: PathReader[]
}

export type PathList = ListResponse<Path>

export interface HLSMuxer extends JsonObject {
  name: string
  created: string
  lastRequest: string
  bytesSent: number
}

export type HLSMuxerList = ListResponse<HLSMuxer>

export interface ProtocolResource extends JsonObject {
  id: string
  created?: string
  remoteAddr?: string
  state?: string
  path?: string
  bytesReceived?: number
  bytesSent?: number
  rtt?: number
  rttMs?: number
  packetLoss?: number
  packetsLost?: number
  packetLossPercentage?: number
  retransmitPackets?: number
  packetsRetransmitted?: number
  sendRate?: number
  receiveRate?: number
  sendRateBps?: number
  receiveRateBps?: number
}

export type RTSPConn = ProtocolResource
export type RTSPConnList = ListResponse<RTSPConn>
export type RTSPSession = ProtocolResource
export type RTSPSessionList = ListResponse<RTSPSession>
export type RTMPConn = ProtocolResource
export type RTMPConnList = ListResponse<RTMPConn>
export type SRTConn = ProtocolResource
export type SRTConnList = ListResponse<SRTConn>
export type WebRTCSession = ProtocolResource
export type WebRTCSessionList = ListResponse<WebRTCSession>

export interface RecordingSegment extends JsonObject {
  start: string
  duration: number
}

export interface Recording extends JsonObject {
  name: string
  segments?: RecordingSegment[]
}

export type RecordingList = ListResponse<Recording>

export interface DeleteRecordingSegmentParams extends Record<string, string> {
  path: string
  start: string
}

export interface MediaMtxRequestOptions<TBody = unknown> {
  method?: HttpMethod
  body?: TBody
  headers?: HeadersInit
  apiUrl?: string
  query?: Record<string, string | number | boolean | undefined | null>
  fetchImpl?: typeof fetch
}

export interface KickResolution {
  supported: true
  clientType: string
  id: string
  kick: (id: string) => Promise<unknown>
}

export interface KickResolutionUnsupported {
  supported: false
  clientType: string | null
  id: string
  reason: string
}

export type PathReaderKickResult = KickResolution | KickResolutionUnsupported

/**
 * Resolve a PathReader or protocol resource to the appropriate kick method.
 * Returns a structured result indicating whether the reader type supports kicking.
 */
/**
 * Returns only the supported (kickable) readers from a runtime path.
 */
export function getKickableReaders(path: Path): KickResolution[] {
  return path.readers
    .map(resolveReaderKick)
    .filter((r): r is KickResolution => r.supported)
}

export function resolveReaderKick(
  reader: PathReader,
): KickResolution | KickResolutionUnsupported {
  const id = reader.id
  const type = reader.type?.toLowerCase() || ""

  // RTSP session -> kickable
  if (type.includes("rtspsession") || type === "rtspSession" || type === "rtsp") {
    return { supported: true, clientType: "rtspSessions", id, kick: rtspSessions.kick }
  }

  // RTSPS session -> kickable
  if (type.includes("rtspssession") || type === "rtspsSession") {
    return { supported: true, clientType: "rtspsSessions", id, kick: rtspsSessions.kick }
  }

  // RTMP connection -> kickable
  if (type.includes("rtmpconn") || type === "rtmpConn" || type === "rtmp") {
    return { supported: true, clientType: "rtmpConnections", id, kick: rtmpConnections.kick }
  }

  // RTMPS connection -> kickable
  if (type.includes("rtmpsconn") || type === "rtmpsConn") {
    return { supported: true, clientType: "rtmpsConnections", id, kick: rtmpsConnections.kick }
  }

  // SRT connection -> kickable
  if (type.includes("srtconn") || type === "srtConn" || type === "srt") {
    return { supported: true, clientType: "srtConnections", id, kick: srtConnections.kick }
  }

  // WebRTC session -> kickable
  if (type.includes("webrtcsession") || type === "webrtcSession" || type === "webrtc") {
    return { supported: true, clientType: "webrtcSessions", id, kick: webrtcSessions.kick }
  }

  // RTSP connection -> read-only (cannot kick)
  if (type.includes("rtspconn") || type === "rtspConn") {
    return { supported: false, clientType: "rtspConnections", id, reason: "RTSP connections are read-only and cannot be kicked" }
  }

  // RTSPS connection -> read-only
  if (type.includes("rtspsconn") || type === "rtspsConn") {
    return { supported: false, clientType: "rtspsConnections", id, reason: "RTSPS connections are read-only and cannot be kicked" }
  }

  // HLS muxer -> read-only
  if (type.includes("hlsmuxer") || type === "hlsMuxer" || type === "hls") {
    return { supported: false, clientType: "hlsMuxers", id, reason: "HLS muxers are read-only and cannot be kicked" }
  }

  // Unknown type
  return { supported: false, clientType: null, id, reason: `Unsupported reader type: ${reader.type}. Cannot determine a kick endpoint.` }
}

function encodePathParam(value: string) {
  return encodeURIComponent(value)
}

function withQuery(endpoint: string, query?: MediaMtxRequestOptions["query"]) {
  if (!query) return endpoint

  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null) params.set(key, String(value))
  }

  const queryString = params.toString()
  if (!queryString) return endpoint

  return `${endpoint}${endpoint.includes("?") ? "&" : "?"}${queryString}`
}

async function parseResponseBody(response: Response, method: HttpMethod, endpoint: string) {
  if (response.status === 204) return null

  const contentType = response.headers.get("content-type") || ""
  const rawBody = await response.text()
  if (!rawBody) return null

  if (!contentType.includes("application/json")) return rawBody

  try {
    return JSON.parse(rawBody)
  } catch (cause) {
    throw new MediaMtxApiError({
      method,
      endpoint,
      status: response.status,
      statusText: response.statusText,
      rawBody,
      cause,
      message: "MediaMTX API returned invalid JSON",
    })
  }
}

export async function fetchMediaMtxApi<TResponse = unknown, TBody = unknown>(
  endpoint: string,
  options: MediaMtxRequestOptions<TBody> = {},
): Promise<TResponse> {
  const method = options.method || "GET"
  const endpointWithQuery = withQuery(endpoint, options.query)
  const authHeader = getAuthHeader()
  const headers = new Headers(options.headers)

  headers.set("Accept", "application/json")
  if (authHeader) headers.set("Authorization", authHeader)

  const init: RequestInit = {
    method,
    headers,
    cache: "no-store",
  }

  if (options.body !== undefined) {
    headers.set("Content-Type", "application/json")
    init.body = JSON.stringify(options.body)
  }

  let response: Response
  try {
    response = await (options.fetchImpl || fetch)(buildMediaMtxApiUrl(endpointWithQuery, options.apiUrl), init)
  } catch (cause) {
    throw new MediaMtxApiError({ method, endpoint: endpointWithQuery, cause })
  }

  const parsedBody = await parseResponseBody(response, method, endpointWithQuery)

  if (!response.ok) {
    throw new MediaMtxApiError({
      method,
      endpoint: endpointWithQuery,
      status: response.status,
      statusText: response.statusText,
      body: parsedBody as MediaMtxErrorBody | string | null,
      rawBody: typeof parsedBody === "string" ? parsedBody : undefined,
    })
  }

  return parsedBody as TResponse
}

function listItems<T>(response: ListResponse<T> | null): T[] {
  return response?.items || []
}

export async function getGlobalConfig() {
  return fetchMediaMtxApi<GlobalConf>("/v3/config/global/get")
}

export async function patchGlobalConfig(config: Partial<GlobalConf>) {
  return fetchMediaMtxApi<null, Partial<GlobalConf>>("/v3/config/global/patch", { method: "PATCH", body: config })
}

export type AuthConfigurationPatch = Pick<
  GlobalConf,
  | "authMethod"
  | "authInternalUsers"
  | "authHTTPAddress"
  | "authHTTPFingerprint"
  | "authHTTPExclude"
  | "authJWTJWKS"
  | "authJWTJWKSFingerprint"
  | "authJWTClaimKey"
  | "authJWTExclude"
  | "authJWTIssuer"
  | "authJWTAudience"
  | "authJWTInHTTPQuery"
>

export async function patchAuthConfiguration(config: Partial<AuthConfigurationPatch>) {
  return patchGlobalConfig(config)
}

export interface TestHttpAuthEndpointRequest extends JsonObject {
  address: string
  fingerprint?: string
  action?: string
  path?: string
  user?: string
  password?: string
  ip?: string
}

export interface TestHttpAuthEndpointResponse extends JsonObject {
  ok?: boolean
  message?: string
}

export async function testHttpAuthEndpoint(request: TestHttpAuthEndpointRequest) {
  return fetchMediaMtxApi<TestHttpAuthEndpointResponse, TestHttpAuthEndpointRequest>("/v3/auth/http/test", {
    method: "POST",
    body: request,
  })
}

export async function getPathDefaults() {
  return fetchMediaMtxApi<PathConf>("/v3/config/pathdefaults/get")
}

export async function patchPathDefaults(config: Partial<PathConf>) {
  return fetchMediaMtxApi<null, Partial<PathConf>>("/v3/config/pathdefaults/patch", { method: "PATCH", body: config })
}

export async function getPathConfig(name: string) {
  return fetchMediaMtxApi<PathConf>(`/v3/config/paths/get/${encodePathParam(name)}`)
}

export async function getPathConfigs(): Promise<PathConf[]> {
  return listItems(await fetchMediaMtxApi<PathConfList>("/v3/config/paths/list"))
}

export async function addPath(config: PathConf): Promise<void> {
  await fetchMediaMtxApi<null, PathConf>(`/v3/config/paths/add/${encodePathParam(config.name)}`, {
    method: "POST",
    body: config,
  })
}

export async function updatePath(name: string, config: Partial<PathConf>): Promise<void> {
  await fetchMediaMtxApi<null, Partial<PathConf>>(`/v3/config/paths/patch/${encodePathParam(name)}`, {
    method: "PATCH",
    body: config,
  })
}

export async function replacePath(name: string, config: PathConf): Promise<void> {
  await fetchMediaMtxApi<null, PathConf>(`/v3/config/paths/replace/${encodePathParam(name)}`, {
    method: "POST",
    body: config,
  })
}

export async function deletePath(name: string): Promise<void> {
  await fetchMediaMtxApi<null>(`/v3/config/paths/delete/${encodePathParam(name)}`, { method: "DELETE" })
}

export async function getPaths(): Promise<Path[]> {
  return listItems(await fetchMediaMtxApi<PathList>("/v3/paths/list"))
}

export async function getPath(name: string) {
  return fetchMediaMtxApi<Path>(`/v3/paths/get/${encodePathParam(name)}`)
}

export async function getHlsMuxers(): Promise<HLSMuxer[]> {
  return listItems(await fetchMediaMtxApi<HLSMuxerList>("/v3/hlsmuxers/list"))
}

export async function getHlsMuxer(name: string) {
  return fetchMediaMtxApi<HLSMuxer>(`/v3/hlsmuxers/get/${encodePathParam(name)}`)
}

function createProtocolClient<TItem extends ProtocolResource>(basePath: string) {
  return {
    list: async () => listItems(await fetchMediaMtxApi<ListResponse<TItem>>(`${basePath}/list`)),
    get: (id: string) => fetchMediaMtxApi<TItem>(`${basePath}/get/${encodePathParam(id)}`),
    kick: (id: string) => fetchMediaMtxApi<null>(`${basePath}/kick/${encodePathParam(id)}`, { method: "POST" }),
  }
}

function createReadOnlyProtocolClient<TItem extends ProtocolResource>(basePath: string) {
  return {
    list: async () => listItems(await fetchMediaMtxApi<ListResponse<TItem>>(`${basePath}/list`)),
    get: (id: string) => fetchMediaMtxApi<TItem>(`${basePath}/get/${encodePathParam(id)}`),
  }
}

export const rtspConnections = createReadOnlyProtocolClient<RTSPConn>("/v3/rtspconns")
export const rtspSessions = createProtocolClient<RTSPSession>("/v3/rtspsessions")
export const rtspsConnections = createReadOnlyProtocolClient<RTSPConn>("/v3/rtspsconns")
export const rtspsSessions = createProtocolClient<RTSPSession>("/v3/rtspssessions")
export const rtmpConnections = createProtocolClient<RTMPConn>("/v3/rtmpconns")
export const rtmpsConnections = createProtocolClient<RTMPConn>("/v3/rtmpsconns")
export const srtConnections = createProtocolClient<SRTConn>("/v3/srtconns")
export const webrtcSessions = createProtocolClient<WebRTCSession>("/v3/webrtcsessions")

export async function getRecordings(): Promise<Recording[]> {
  return listItems(await fetchMediaMtxApi<RecordingList>("/v3/recordings/list"))
}

export async function getRecording(name: string) {
  return fetchMediaMtxApi<Recording>(`/v3/recordings/get/${encodePathParam(name)}`)
}

export async function deleteRecordingSegment(params: DeleteRecordingSegmentParams) {
  return fetchMediaMtxApi<null>("/v3/recordings/deletesegment", { method: "DELETE", query: params })
}

export async function refreshJwks() {
  return fetchMediaMtxApi<null>("/v3/auth/jwks/refresh", { method: "POST" })
}
