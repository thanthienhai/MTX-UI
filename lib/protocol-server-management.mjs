export const PROTOCOL_FIELD_GROUPS = {
  rtsp: {
    label: "RTSP / RTSPS",
    fields: [
      "rtsp",
      "rtspTransports",
      "rtspEncryption",
      "rtspAddress",
      "rtspsAddress",
      "rtpAddress",
      "rtcpAddress",
      "multicastIPRange",
      "multicastRTPPort",
      "multicastRTCPPort",
      "srtpAddress",
      "srtcpAddress",
      "multicastSRTPPort",
      "multicastSRTCPPort",
      "rtspServerKey",
      "rtspServerCert",
      "rtspAuthMethods",
      "rtspUDPReadBufferSize",
      "rtspDemuxMpegts",
    ],
  },
  rtmp: {
    label: "RTMP / RTMPS",
    fields: ["rtmp", "rtmpAddress", "rtmpEncryption", "rtmpsAddress", "rtmpServerKey", "rtmpServerCert"],
  },
  hls: {
    label: "HLS",
    fields: [
      "hls",
      "hlsAddress",
      "hlsEncryption",
      "hlsServerKey",
      "hlsServerCert",
      "hlsAllowOrigin",
      "hlsTrustedProxies",
      "hlsAlwaysRemux",
      "hlsVariant",
      "hlsSegmentCount",
      "hlsSegmentDuration",
      "hlsPartDuration",
      "hlsSegmentMaxSize",
      "hlsDirectory",
      "hlsMuxerCloseAfter",
    ],
  },
  webrtc: {
    label: "WebRTC / WHEP / WHIP",
    fields: [
      "webrtc",
      "webrtcAddress",
      "webrtcEncryption",
      "webrtcServerKey",
      "webrtcServerCert",
      "webrtcAllowOrigin",
      "webrtcTrustedProxies",
      "webrtcLocalUDPAddress",
      "webrtcLocalTCPAddress",
      "webrtcIPsFromInterfaces",
      "webrtcIPsFromInterfacesList",
      "webrtcAdditionalHosts",
      "webrtcICEServers2",
      "webrtcHandshakeTimeout",
      "webrtcTrackGatherTimeout",
      "webrtcSTUNGatherTimeout",
    ],
  },
  srt: {
    label: "SRT",
    fields: ["srt", "srtAddress"],
  },
  rtpMpegts: {
    label: "RTP / MPEG-TS",
    fields: ["rtspDemuxMpegts"],
  },
}

export const PROTOCOL_FIELD_METADATA = {
  rtsp: { label: "Bật RTSP", type: "boolean" },
  rtspTransports: { label: "RTSP transports", type: "stringArray", options: ["udp", "multicast", "tcp"] },
  rtspEncryption: { label: "RTSP encryption", type: "enum", options: ["no", "strict", "optional"] },
  rtspAddress: { label: "RTSP address", type: "address" },
  rtspsAddress: { label: "RTSPS address", type: "address" },
  rtpAddress: { label: "RTP address", type: "address" },
  rtcpAddress: { label: "RTCP address", type: "address" },
  multicastIPRange: { label: "Multicast IP range", type: "text" },
  multicastRTPPort: { label: "Multicast RTP port", type: "number" },
  multicastRTCPPort: { label: "Multicast RTCP port", type: "number" },
  srtpAddress: { label: "SRTP address", type: "address" },
  srtcpAddress: { label: "SRTCP address", type: "address" },
  multicastSRTPPort: { label: "Multicast SRTP port", type: "number" },
  multicastSRTCPPort: { label: "Multicast SRTCP port", type: "number" },
  rtspServerKey: { label: "RTSP TLS key", type: "secret" },
  rtspServerCert: { label: "RTSP TLS cert", type: "secret" },
  rtspAuthMethods: { label: "RTSP auth methods", type: "stringArray", options: ["basic", "digest"] },
  rtspUDPReadBufferSize: { label: "RTSP UDP read buffer", type: "number" },
  rtmp: { label: "Bật RTMP", type: "boolean" },
  rtmpAddress: { label: "RTMP address", type: "address" },
  rtmpEncryption: { label: "RTMP encryption", type: "enum", options: ["no", "strict", "optional"] },
  rtmpsAddress: { label: "RTMPS address", type: "address" },
  rtmpServerKey: { label: "RTMP TLS key", type: "secret" },
  rtmpServerCert: { label: "RTMP TLS cert", type: "secret" },
  hls: { label: "Bật HLS", type: "boolean" },
  hlsAddress: { label: "HLS address", type: "address" },
  hlsEncryption: { label: "HLS HTTPS", type: "boolean" },
  hlsServerKey: { label: "HLS TLS key", type: "secret" },
  hlsServerCert: { label: "HLS TLS cert", type: "secret" },
  hlsAllowOrigin: { label: "HLS CORS allow origin", type: "text" },
  hlsTrustedProxies: { label: "HLS trusted proxies", type: "stringArray" },
  hlsAlwaysRemux: { label: "HLS always remux", type: "boolean" },
  hlsVariant: { label: "HLS variant", type: "enum", options: ["lowLatency", "fmp4", "mpegts"] },
  hlsSegmentCount: { label: "HLS segment count", type: "number" },
  hlsSegmentDuration: { label: "HLS segment duration", type: "duration" },
  hlsPartDuration: { label: "HLS part duration", type: "duration" },
  hlsSegmentMaxSize: { label: "HLS segment max size", type: "text" },
  hlsDirectory: { label: "HLS directory", type: "text" },
  hlsMuxerCloseAfter: { label: "HLS muxer close after", type: "duration" },
  webrtc: { label: "Bật WebRTC", type: "boolean" },
  webrtcAddress: { label: "WebRTC address", type: "address" },
  webrtcEncryption: { label: "WebRTC HTTPS", type: "boolean" },
  webrtcServerKey: { label: "WebRTC TLS key", type: "secret" },
  webrtcServerCert: { label: "WebRTC TLS cert", type: "secret" },
  webrtcAllowOrigin: { label: "WebRTC CORS allow origin", type: "text" },
  webrtcTrustedProxies: { label: "WebRTC trusted proxies", type: "stringArray" },
  webrtcLocalUDPAddress: { label: "WebRTC local UDP address", type: "address" },
  webrtcLocalTCPAddress: { label: "WebRTC local TCP address", type: "address" },
  webrtcIPsFromInterfaces: { label: "Dùng IP từ interface", type: "boolean" },
  webrtcIPsFromInterfacesList: { label: "Interface IP list", type: "stringArray" },
  webrtcAdditionalHosts: { label: "Additional hosts", type: "stringArray" },
  webrtcICEServers2: { label: "ICE servers JSON", type: "jsonArray" },
  webrtcHandshakeTimeout: { label: "Handshake timeout", type: "duration" },
  webrtcTrackGatherTimeout: { label: "Track gather timeout", type: "duration" },
  webrtcSTUNGatherTimeout: { label: "STUN gather timeout", type: "duration" },
  srt: { label: "Bật SRT", type: "boolean" },
  srtAddress: { label: "SRT address", type: "address" },
  rtspDemuxMpegts: { label: "Demux MPEG-TS over RTSP", type: "boolean" },
}

export const SENSITIVE_PROTOCOL_FIELDS = ["rtspServerKey", "rtspServerCert", "rtmpServerKey", "rtmpServerCert", "hlsServerKey", "hlsServerCert", "webrtcServerKey", "webrtcServerCert"]

function arraysEqual(left, right) {
  return Array.isArray(left) && Array.isArray(right) && left.length === right.length && left.every((value, index) => value === right[index])
}

export function parseStringArray(value) {
  if (Array.isArray(value)) return value.map(String).map((item) => item.trim()).filter(Boolean)
  if (typeof value !== "string") return []
  return value.split(",").map((item) => item.trim()).filter(Boolean)
}

export function buildProtocolConfigPatch(original, current, fields) {
  const patch = {}
  for (const field of fields) {
    if (!Object.prototype.hasOwnProperty.call(current || {}, field)) continue
    const before = original?.[field]
    const after = current?.[field]
    if (Array.isArray(before) || Array.isArray(after)) {
      if (!arraysEqual(before || [], after || [])) patch[field] = after
    } else if (JSON.stringify(before) !== JSON.stringify(after)) {
      patch[field] = after
    }
  }
  return patch
}

export function validateProtocolConfigPatch(patch) {
  const errors = {}
  for (const [field, value] of Object.entries(patch || {})) {
    const metadata = PROTOCOL_FIELD_METADATA[field]
    if (!metadata) continue
    if (metadata.type === "address" && typeof value === "string" && value.trim() === "") {
      errors[field] = "Cần nhập địa chỉ hợp lệ."
    }
    if (metadata.type === "number" && (typeof value !== "number" || Number.isNaN(value) || value < 0)) {
      errors[field] = "Cần nhập số không âm."
    }
    if (metadata.type === "enum" && value && !metadata.options.includes(value)) {
      errors[field] = "Giá trị không được hỗ trợ."
    }
    if (metadata.type === "stringArray" && metadata.options && Array.isArray(value)) {
      const unsupported = value.filter((item) => !metadata.options.includes(item))
      if (unsupported.length) errors[field] = `Giá trị không hỗ trợ: ${unsupported.join(", ")}.`
    }
    if (metadata.type === "jsonArray" && !Array.isArray(value)) {
      errors[field] = "Cần nhập JSON array."
    }
  }
  return errors
}

export function maskProtocolPayload(payload) {
  const masked = {}
  for (const [field, value] of Object.entries(payload || {})) {
    masked[field] = SENSITIVE_PROTOCOL_FIELDS.includes(field) && value ? "[masked]" : value
  }
  return masked
}

export function summarizeProtocolPayload(payload) {
  return JSON.stringify(maskProtocolPayload(payload))
}

export function extractSrtMetrics(resource) {
  const readNumber = (...keys) => {
    for (const key of keys) {
      const value = resource?.[key]
      if (typeof value === "number") return value
    }
    return null
  }

  return {
    rtt: readNumber("rtt", "rttMs", "msRTT"),
    loss: readNumber("packetLoss", "packetsLost", "packetLossPercentage", "pktSndLoss", "pktRcvLoss"),
    retransmit: readNumber("retransmitPackets", "packetsRetransmitted", "pktRetrans"),
    sendRate: readNumber("sendRate", "sendRateBps", "mbpsSendRate"),
    receiveRate: readNumber("receiveRate", "receiveRateBps", "mbpsReceiveRate"),
  }
}
