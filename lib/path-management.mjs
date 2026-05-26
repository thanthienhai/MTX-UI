/**
 * Path Management & Path Defaults Utilities
 *
 * Provides reusable field registry, form mapping, merge, diff, reset,
 * apply-to-all, and import/export utilities for MediaMTX path configuration.
 *
 * @module path-management
 */

// ──────────────────────────────────────────────
// 2.1 Path Field Registry
// ──────────────────────────────────────────────

/**
 * Category labels for path configuration fields.
 */
export const PATH_FIELD_CATEGORIES = {
  source: "Source",
  common: "Common Options",
  recording: "Recording",
  readers: "Readers",
  runtime: "Runtime",
  hooks: "Hooks",
  advanced: "Advanced",
}

/**
 * Path field entry in the registry.
 * @typedef {Object} PathFieldEntry
 * @property {string} field - The path configuration field name
 * @property {string} label - Human-readable label
 * @property {string} category - Field category key from PATH_FIELD_CATEGORIES
 * @property {string} type - Field type: "string" | "number" | "boolean" | "duration" | "url"
 * @property {string[]} [sourceTypes] - Source types this field applies to (omitted = all)
 * @property {boolean} [isSecret] - Whether the field value should be masked
 * @property {string} [placeholder] - Input placeholder text
 * @property {string} [description] - Help text for the field
 * @property {Array<{value: string, label: string}>} [options] - Select options for enum fields
 * @property {boolean} [appliesToDefaults] - Whether this field applies to path defaults
 * @property {function(any): boolean} [isDefault] - Custom function to check if a value equals the default
 */

/** @type {PathFieldEntry[]} */
export const PATH_FIELD_REGISTRY = [
  // ── Source fields ────────────────────────
  {
    field: "source",
    label: "Source URL",
    category: "source",
    type: "url",
    placeholder: "rtsp://user:pass@192.168.1.1/stream",
    description: "Nguồn stream: URL, publisher, redirect, rpiCamera, hoặc runOn source",
    appliesToDefaults: true,
  },
  {
    field: "sourceFingerprint",
    label: "Source Fingerprint",
    category: "source",
    type: "string",
    placeholder: "SHA-256 fingerprint",
    description: "Fingerprint SHA-256 cho nguồn RTSPS",
    appliesToDefaults: true,
  },
  {
    field: "sourceOnDemand",
    label: "Source On Demand",
    category: "source",
    type: "boolean",
    description: "Chỉ khởi động nguồn khi có reader yêu cầu",
    appliesToDefaults: true,
  },
  {
    field: "sourceOnDemandStartTimeout",
    label: "Source On Demand Start Timeout",
    category: "source",
    type: "duration",
    placeholder: "10s",
    description: "Thời gian chờ nguồn on-demand khởi động",
    appliesToDefaults: true,
  },
  {
    field: "sourceOnDemandCloseAfter",
    label: "Source On Demand Close After",
    category: "source",
    type: "duration",
    placeholder: "10s",
    description: "Đóng nguồn on-demand sau khi không còn reader",
    appliesToDefaults: true,
  },
  {
    field: "sourceRedirect",
    label: "Source Redirect URL",
    category: "source",
    type: "url",
    placeholder: "rtsp://other-server/stream",
    description: "Chuyển hướng reader đến URL khác",
    sourceTypes: ["redirect"],
    appliesToDefaults: true,
  },
  // ── Raspberry Pi Camera fields ──────────
  {
    field: "rpiCameraCamID",
    label: "RPi Camera ID",
    category: "source",
    type: "number",
    placeholder: "0",
    description: "ID camera Raspberry Pi",
    sourceTypes: ["rpiCameraSource"],
  },
  {
    field: "rpiCameraWidth",
    label: "RPi Camera Width",
    category: "source",
    type: "number",
    placeholder: "1920",
    sourceTypes: ["rpiCameraSource"],
  },
  {
    field: "rpiCameraHeight",
    label: "RPi Camera Height",
    category: "source",
    type: "number",
    placeholder: "1080",
    sourceTypes: ["rpiCameraSource"],
  },
  {
    field: "rpiCameraFPS",
    label: "RPi Camera FPS",
    category: "source",
    type: "number",
    placeholder: "30",
    sourceTypes: ["rpiCameraSource"],
  },
  {
    field: "rpiCameraHFlip",
    label: "RPi Camera Horizontal Flip",
    category: "source",
    type: "boolean",
    sourceTypes: ["rpiCameraSource"],
  },
  {
    field: "rpiCameraVFlip",
    label: "RPi Camera Vertical Flip",
    category: "source",
    type: "boolean",
    sourceTypes: ["rpiCameraSource"],
  },
  {
    field: "rpiCameraBitrate",
    label: "RPi Camera Bitrate",
    category: "source",
    type: "number",
    placeholder: "5000000",
    sourceTypes: ["rpiCameraSource"],
  },
  {
    field: "rpiCameraCodec",
    label: "RPi Camera Codec",
    category: "source",
    type: "string",
    placeholder: "h264",
    options: [
      { value: "h264", label: "H.264" },
      { value: "h265", label: "H.265" },
      { value: "mjpeg", label: "MJPEG" },
    ],
    sourceTypes: ["rpiCameraSource"],
  },
  // ── Common path options ─────────────────
  {
    field: "maxReaders",
    label: "Max Readers",
    category: "readers",
    type: "number",
    placeholder: "0",
    description: "Số reader tối đa (0 = không giới hạn)",
    appliesToDefaults: true,
  },
  {
    field: "overridePublisher",
    label: "Override Publisher",
    category: "common",
    type: "boolean",
    description: "Cho phép publisher mới ghi đè publisher hiện tại",
    appliesToDefaults: true,
  },
  {
    field: "useAbsoluteTimestamp",
    label: "Use Absolute Timestamp",
    category: "common",
    type: "boolean",
    description: "Gửi timestamp tuyệt đối thay vì relative RTCP",
    appliesToDefaults: true,
  },
  // ── Recording fields ────────────────────
  {
    field: "record",
    label: "Enable Recording",
    category: "recording",
    type: "boolean",
    description: "Bật ghi hình cho path này",
    appliesToDefaults: true,
  },
  {
    field: "recordPath",
    label: "Recording Path",
    category: "recording",
    type: "string",
    placeholder: "./recordings/%path/%Y-%m-%d_%H-%M-%S-%f",
    description: "Đường dẫn lưu file ghi hình",
    appliesToDefaults: true,
  },
  {
    field: "recordFormat",
    label: "Recording Format",
    category: "recording",
    type: "string",
    options: [
      { value: "fmp4", label: "Fragmented MP4" },
      { value: "mpegts", label: "MPEG-TS" },
    ],
    appliesToDefaults: true,
  },
  {
    field: "recordPartDuration",
    label: "Part Duration",
    category: "recording",
    type: "duration",
    placeholder: "1s",
    description: "Thời lượng mỗi part trong segment",
    appliesToDefaults: true,
  },
  {
    field: "recordSegmentDuration",
    label: "Segment Duration",
    category: "recording",
    type: "duration",
    placeholder: "1h",
    description: "Thời lượng mỗi segment ghi hình",
    appliesToDefaults: true,
  },
  {
    field: "recordDeleteAfter",
    label: "Delete After",
    category: "recording",
    type: "duration",
    placeholder: "0s",
    description: "Tự động xóa segment sau khoảng thời gian (0s = không xóa)",
    appliesToDefaults: true,
  },
  {
    field: "recordMaxPartSize",
    label: "Max Part Size",
    category: "recording",
    type: "size",
    placeholder: "50M",
    description: "Kích thước tối đa mỗi part (vd: 50M, 100M, 1G)",
    appliesToDefaults: true,
  },
  // ── SRT fields ──────────────────────────
  {
    field: "srtReadPassphrase",
    label: "SRT Read Passphrase",
    category: "advanced",
    type: "string",
    isSecret: true,
    placeholder: "passphrase",
    description: "Passphrase đọc SRT",
  },
  {
    field: "srtPublishPassphrase",
    label: "SRT Publish Passphrase",
    category: "advanced",
    type: "string",
    isSecret: true,
    placeholder: "passphrase",
    description: "Passphrase publish SRT",
  },
  // ── RTSP fields ─────────────────────────
  {
    field: "rtspTransport",
    label: "RTSP Transport",
    category: "advanced",
    type: "string",
    options: [
      { value: "udp", label: "UDP" },
      { value: "tcp", label: "TCP" },
      { value: "mpegts", label: "MPEG-TS" },
    ],
  },
  {
    field: "rtspAnyPort",
    label: "RTSP Any Port",
    category: "advanced",
    type: "boolean",
    description: "Cho phép RTSP dùng bất kỳ port UDP nào",
  },
  {
    field: "rtspRangeType",
    label: "RTSP Range Type",
    category: "advanced",
    type: "string",
    options: [
      { value: "clock", label: "Clock" },
      { value: "npt", label: "NPT" },
      { value: "smpte", label: "SMPTE" },
    ],
  },
  {
    field: "rtspRangeStart",
    label: "RTSP Range Start",
    category: "advanced",
    type: "string",
    placeholder: "00:00:00",
  },
  // ── RTP / MPEG-TS fields ────────────────
  {
    field: "rtpSDP",
    label: "RTP SDP",
    category: "advanced",
    type: "string",
    description: "Mô tả SDP cho nguồn RTP",
  },
  {
    field: "rtpUDPReadBufferSize",
    label: "RTP UDP Read Buffer Size",
    category: "advanced",
    type: "number",
    placeholder: "262144",
  },
  {
    field: "rtspUDPReadBufferSize",
    label: "RTSP UDP Read Buffer Size",
    category: "advanced",
    type: "number",
    placeholder: "262144",
  },
  {
    field: "mpegtsUDPReadBufferSize",
    label: "MPEG-TS UDP Read Buffer Size",
    category: "advanced",
    type: "number",
    placeholder: "262144",
  },
  // ── Run-on hooks ────────────────────────
  {
    field: "runOnInit",
    label: "Run On Init",
    category: "hooks",
    type: "string",
    placeholder: "command",
    description: "Lệnh chạy khi path được khởi tạo",
  },
  {
    field: "runOnDemand",
    label: "Run On Demand",
    category: "hooks",
    type: "string",
    placeholder: "command",
    description: "Lệnh chạy khi reader yêu cầu path",
  },
  {
    field: "runOnReady",
    label: "Run On Ready",
    category: "hooks",
    type: "string",
    placeholder: "command",
    description: "Lệnh chạy khi path sẵn sàng",
    appliesToDefaults: true,
  },
  {
    field: "runOnReadyRestart",
    label: "Run On Ready Restart",
    category: "hooks",
    type: "boolean",
    description: "Tự động khởi động lại lệnh runOnReady khi thoát",
    appliesToDefaults: true,
  },
  {
    field: "runOnRead",
    label: "Run On Read",
    category: "hooks",
    type: "string",
    placeholder: "command",
    description: "Lệnh chạy khi có reader bắt đầu đọc",
  },
  {
    field: "runOnUnread",
    label: "Run On Unread",
    category: "hooks",
    type: "string",
    placeholder: "command",
    description: "Lệnh chạy khi reader ngừng đọc",
  },
  {
    field: "runOnNotReady",
    label: "Run On Not Ready",
    category: "hooks",
    type: "string",
    placeholder: "command",
    description: "Lệnh chạy khi path không còn sẵn sàng",
  },
  {
    field: "runOnInitRestart",
    label: "Run On Init Restart",
    category: "hooks",
    type: "boolean",
    description: "Tự động khởi động lại lệnh runOnInit khi thoát",
  },
  {
    field: "runOnDemandRestart",
    label: "Run On Demand Restart",
    category: "hooks",
    type: "boolean",
    description: "Tự động khởi động lại lệnh runOnDemand khi thoát",
  },
  {
    field: "runOnDemandStartTimeout",
    label: "Run On Demand Start Timeout",
    category: "hooks",
    type: "duration",
    placeholder: "10s",
    description: "Thời gian chờ runOnDemand khởi động",
  },
  {
    field: "runOnDemandCloseAfter",
    label: "Run On Demand Close After",
    category: "hooks",
    type: "duration",
    placeholder: "10s",
    description: "Đóng runOnDemand sau khi không còn reader",
  },
  {
    field: "runOnUnDemand",
    label: "Run On UnDemand",
    category: "hooks",
    type: "string",
    placeholder: "command",
    description: "Lệnh chạy khi không còn reader nào yêu cầu path",
  },
  {
    field: "runOnReadRestart",
    label: "Run On Read Restart",
    category: "hooks",
    type: "boolean",
    description: "Tự động khởi động lại lệnh runOnRead khi thoát",
  },
  {
    field: "runOnRecordSegmentCreate",
    label: "Run On Record Segment Create",
    category: "hooks",
    type: "string",
    placeholder: "command",
    description: "Lệnh chạy khi segment ghi hình được tạo",
  },
  {
    field: "runOnRecordSegmentComplete",
    label: "Run On Record Segment Complete",
    category: "hooks",
    type: "string",
    placeholder: "command",
    description: "Lệnh chạy khi segment ghi hình hoàn tất",
  },
]

/**
 * Fields that apply to path defaults.
 */
export const PATH_DEFAULTS_FIELDS = PATH_FIELD_REGISTRY
  .filter((entry) => entry.appliesToDefaults)
  .map((entry) => entry.field)

/**
 * Get registry entry for a field name.
 * @param {string} field
 * @returns {PathFieldEntry|undefined}
 */
export function getPathFieldEntry(field) {
  return PATH_FIELD_REGISTRY.find((entry) => entry.field === field)
}

/**
 * Get fields that apply to a specific source type.
 * @param {string} [sourceType] - Source type string from source configuration
 * @returns {PathFieldEntry[]}
 */
export function getFieldsForSourceType(sourceType) {
  if (!sourceType) return PATH_FIELD_REGISTRY.filter((entry) => !entry.sourceTypes)
  return PATH_FIELD_REGISTRY.filter(
    (entry) => !entry.sourceTypes || entry.sourceTypes.includes(sourceType),
  )
}

// ──────────────────────────────────────────────
// 2.3 Path Name Mode Helpers
// (Re-exported from mediamtx-url.mjs for convenience)
// ──────────────────────────────────────────────

// Re-exports from mediamtx-url.mjs
export { isRegexPathName, isAllOthersPathName, getPathNameMode } from "./mediamtx-url.mjs"

// ──────────────────────────────────────────────
// 2.2 Path Form Mapping Utilities
// ──────────────────────────────────────────────

/**
 * Determine the source type from a path configuration source value.
 * @param {string|null|undefined} source - The source field value
 * @returns {string} Source type identifier
 */
export function detectSourceType(source) {
  if (!source) return "publisher"
  if (source === "publisher") return "publisher"
  if (source.startsWith("rtsp://") || source.startsWith("rtsps://")) {
    return source.startsWith("rtsps://") ? "rtspsSource" : "rtspSource"
  }
  if (source.startsWith("rtmp://") || source.startsWith("rtmps://")) {
    return source.startsWith("rtmps://") ? "rtmpsSource" : "rtmpSource"
  }
  if (source.startsWith("http://") || source.startsWith("https://")) return "hlsSource"
  if (source.startsWith("srt://")) return "srtSource"
  if (source.startsWith("udp://") || source.startsWith("udp+rtp://")) return "udpSource"
  if (source.startsWith("whep://") || source.startsWith("whip://")) return "webRTCSource"
  if (source.startsWith("redirect")) return "redirect"
  if (source.includes("rpiCamera") || source.startsWith("/dev/video")) return "rpiCameraSource"
  return "publisher"
}

/**
 * Map a PathConf object to a form values object (flattened, all strings).
 * @param {import("./mediamtx-api").PathConf} pathConf
 * @returns {Record<string, any>}
 */
export function pathConfToFormValues(pathConf) {
  if (!pathConf) return {}
  const values = { ...pathConf }
  values._sourceType = detectSourceType(pathConf.source)
  return values
}

/**
 * Build a minimal PATCH payload with only changed fields.
 * @param {Record<string, any>} original - Original path config values
 * @param {Record<string, any>} updated - Updated form values
 * @param {string[]} [fields] - Specific fields to include (all by default)
 * @returns {Record<string, any>} Minimal patch object
 */
export function buildMinimalPatch(original, updated, fields) {
  const compareFields = fields || Object.keys(updated)
  const patch = {}

  for (const field of compareFields) {
    if (field.startsWith("_")) continue // skip internal fields
    const originalValue = original?.[field]
    const updatedValue = updated[field]
    if (updatedValue !== originalValue) {
      patch[field] = updatedValue
    }
  }
  return patch
}

/**
 * Build a full replace payload from form values.
 * @param {Record<string, any>} formValues
 * @param {string[]} [includeFields] - Fields to include (default: all non-internal fields)
 * @returns {Record<string, any>}
 */
export function buildReplacePayload(formValues, includeFields) {
  const fields = includeFields || Object.keys(formValues).filter((k) => !k.startsWith("_"))
  const payload = {}
  for (const field of fields) {
    payload[field] = formValues[field]
  }
  return payload
}

/**
 * Build a payload for adding a new path.
 * @param {Record<string, any>} formValues
 * @returns {Record<string, any>}
 */
export function buildAddPayload(formValues) {
  return buildReplacePayload(formValues, [
    "name",
    "source",
    "sourceFingerprint",
    "sourceOnDemand",
    "sourceOnDemandStartTimeout",
    "sourceOnDemandCloseAfter",
    "maxReaders",
    "record",
    "recordPath",
    "recordFormat",
    "recordPartDuration",
    "recordSegmentDuration",
    "recordDeleteAfter",
    "overridePublisher",
    "useAbsoluteTimestamp",
  ])
}

// ──────────────────────────────────────────────
// 2.4 Configured/Runtime Path Merge Utilities
// ──────────────────────────────────────────────

/**
 * Merged row combining configured path and runtime path data.
 * @typedef {Object} MergedPathRow
 * @property {string} name - Path name
 * @property {import("./mediamtx-api").PathConf|null} config - Configured path data (null if runtime-only)
 * @property {import("./mediamtx-api").Path|null} runtime - Runtime path data (null if config-only)
 * @property {boolean} isReady - Whether the path has active runtime state
 * @property {boolean} hasConfig - Whether there's a configured path entry
 * @property {boolean} hasRuntime - Whether there's runtime data
 * @property {string} sourceType - Detected source type from config or runtime
 * @property {string|null} sourceId - Source ID from runtime data
 * @property {number} readerCount - Number of active readers
 * @property {number} bytesReceived - Bytes received
 * @property {number} bytesSent - Bytes sent
 * @property {string[]} tracks - Track names
 */

/**
 * Merge configured paths and runtime paths into display rows.
 * - Config-only paths: hasConfig=true, hasRuntime=false
 * - Runtime-only paths: hasConfig=false, hasRuntime=true
 * - Matched paths: both config and runtime, merged by name
 *
 * @param {import("./mediamtx-api").PathConf[]} configuredPaths
 * @param {import("./mediamtx-api").Path[]} runtimePaths
 * @returns {MergedPathRow[]}
 */
export function mergeConfiguredAndRuntimePaths(configuredPaths, runtimePaths) {
  const runtimeByName = new Map()
  for (const rp of runtimePaths || []) {
    runtimeByName.set(rp.name, rp)
  }

  const merged = []
  const seenNames = new Set()

  // Process configured paths (including all_others at the end)
  const sortedConfigured = [...(configuredPaths || [])].sort((a, b) => {
    if (a.name === "all_others") return 1
    if (b.name === "all_others") return -1
    return 0
  })

  for (const cp of sortedConfigured) {
    const rp = runtimeByName.get(cp.name) || null
    seenNames.add(cp.name)
    merged.push(buildMergedRow(cp, rp))
  }

  // Add runtime-only paths
  for (const rp of runtimePaths || []) {
    if (!seenNames.has(rp.name)) {
      merged.push(buildMergedRow(null, rp))
    }
  }

  return merged
}

/**
 * Build a MergedPathRow from config and runtime data.
 * @param {import("./mediamtx-api").PathConf|null} config
 * @param {import("./mediamtx-api").Path|null} runtime
 * @returns {MergedPathRow}
 */
function buildMergedRow(config, runtime) {
  const isReady = runtime?.ready === true
  return {
    name: config?.name || runtime?.name || "unknown",
    config,
    runtime,
    isReady,
    hasConfig: config !== null,
    hasRuntime: runtime !== null,
    sourceType: config
      ? detectSourceType(config.source)
      : runtime?.source?.type || "unknown",
    sourceId: runtime?.source?.id || null,
    readerCount: runtime?.readers?.length || 0,
    bytesReceived: runtime?.bytesReceived || 0,
    bytesSent: runtime?.bytesSent || 0,
    tracks: runtime?.tracks || [],
  }
}

// ──────────────────────────────────────────────
// 2.5 Path Defaults Utilities
// ──────────────────────────────────────────────

/**
 * Get the default value for a field from path defaults.
 * @param {import("./mediamtx-api").PathConf|null} pathDefaults
 * @param {string} field
 * @returns {any}
 */
export function getDefaultFieldValue(pathDefaults, field) {
  return pathDefaults?.[field]
}

/**
 * Compare a path config against path defaults.
 * Returns an array of diff entries.
 * @param {import("./mediamtx-api").PathConf} pathConf
 * @param {import("./mediamtx-api").PathConf|null} pathDefaults
 * @returns {Array<{field: string, pathValue: any, defaultValue: any, isOverride: boolean}>}
 */
export function diffPathAgainstDefaults(pathConf, pathDefaults) {
  if (!pathDefaults || !pathConf) return []

  const diffs = []
  for (const field of PATH_DEFAULTS_FIELDS) {
    if (field === "source") continue // source is special
    const pathValue = pathConf[field]
    const defaultValue = pathDefaults[field]
    // Both undefined → not a diff
    if (pathValue === undefined && defaultValue === undefined) continue
    // Equal → not an override
    if (pathValue === defaultValue) continue
    // If path value is undefined but default is set, it's using default
    if (pathValue === undefined) continue
    diffs.push({
      field,
      pathValue,
      defaultValue,
      isOverride: pathValue !== defaultValue && defaultValue !== undefined,
    })
  }
  return diffs
}

/**
 * Check if a path field can be reset to a default value.
 * @param {import("./mediamtx-api").PathConf|null} pathDefaults
 * @param {string} field
 * @returns {boolean}
 */
export function canResetToDefault(pathDefaults, field) {
  return pathDefaults?.[field] !== undefined
}

/**
 * Build a PATCH payload to reset a single path field to its default.
 * @param {import("./mediamtx-api").PathConf|null} pathDefaults
 * @param {string} field
 * @returns {Record<string, any>|null} Patch payload, or null if no default exists
 */
export function buildResetFieldPayload(pathDefaults, field) {
  if (!canResetToDefault(pathDefaults, field)) return null
  return { [field]: pathDefaults[field] }
}

/**
 * Build patch payloads to apply defaults to all configured paths.
 * @param {import("./mediamtx-api").PathConf[]} configuredPaths
 * @param {import("./mediamtx-api").PathConf|null} pathDefaults
 * @param {string[]} [fields] - Specific default fields to apply (all by default)
 * @returns {Array<{pathName: string, patch: Record<string, any>}>}
 */
export function buildApplyDefaultsPayloads(configuredPaths, pathDefaults, fields) {
  if (!pathDefaults) return []

  const applyFields = fields || PATH_DEFAULTS_FIELDS
  const results = []

  for (const cp of configuredPaths || []) {
    const patch = {}
    for (const field of applyFields) {
      if (field === "name") continue
      const defaultValue = pathDefaults[field]
      if (defaultValue !== undefined) {
        const currentValue = cp[field]
        if (currentValue !== defaultValue) {
          patch[field] = defaultValue
        }
      }
    }
    if (Object.keys(patch).length > 0) {
      results.push({ pathName: cp.name, patch })
    }
  }

  return results
}

/**
 * Validate a path defaults patch payload.
 * @param {Record<string, any>} patch
 * @returns {Record<string, string>} Field-level error messages
 */
export function validateDefaultsPatch(patch) {
  const errors = {}
  for (const [field, value] of Object.entries(patch)) {
    const entry = getPathFieldEntry(field)
    if (!entry) continue // unknown field passes through

    if (entry.type === "number" && value !== undefined && value !== null) {
      if (typeof value !== "number" || Number.isNaN(value)) {
        errors[field] = `${entry.label} phải là số`
      }
    }
    if (entry.type === "boolean" && value !== undefined && value !== null) {
      if (typeof value !== "boolean") {
        errors[field] = `${entry.label} phải là boolean`
      }
    }
    if (entry.type === "duration" && value !== undefined && value !== null && value !== "") {
      if (!/^\d+(ms|s|m|h|d)?$/.test(String(value))) {
        errors[field] = `${entry.label} phải là duration hợp lệ (vd: 10s, 5m, 1h)`
      }
    }
    if (field === "recordPath" && typeof value === "string" && value.length > 0) {
      const err = validateRecordPathTemplate(value)
      if (err) errors[field] = err
    }
  }
  return errors
}

// ──────────────────────────────────────────────
// 2.5b Recording Path Template Validation
// ──────────────────────────────────────────────

/**
 * Supported variables in MediaMTX recordPath templates.
 * See https://github.com/bluenviron/mediamtx#recording
 */
export const RECORD_PATH_VARIABLES = ["%path", "%Y", "%m", "%d", "%H", "%M", "%S", "%f"]

/**
 * Validate a recording path template string. Returns an error message or null.
 * Rules:
 *  - must contain %path or %f (to avoid all segments overwriting each other)
 *  - cannot contain unknown %X tokens
 *  - must not be absolute on Windows-style C:\ paths if running Linux backend (heuristic warning)
 *
 * @param {string} template
 * @returns {string | null}
 */
export function validateRecordPathTemplate(template) {
  if (!template) return null
  const tokens = template.match(/%[A-Za-z]/g) || []
  const unknown = tokens.filter((t) => !RECORD_PATH_VARIABLES.includes(t))
  if (unknown.length > 0) {
    return `Token không hỗ trợ: ${unknown.join(", ")}. Hỗ trợ: ${RECORD_PATH_VARIABLES.join(", ")}`
  }
  const hasPath = template.includes("%path")
  const hasUnique = template.includes("%f") || template.includes("%S") || template.includes("%M")
  if (!hasPath) {
    return "Template nên chứa %path để mỗi path lưu vào thư mục riêng"
  }
  if (!hasUnique) {
    return "Template nên chứa biến thời gian (%f, %S hoặc %M) để segment mới không ghi đè lên nhau"
  }
  return null
}

// ──────────────────────────────────────────────
// 2.5c Codec / Browser Compatibility Hints
// ──────────────────────────────────────────────

/**
 * Browser playback compatibility table for codecs.
 * Returns array of warnings, or empty array if codec is well-supported.
 *
 * @param {string} codec - codec name (h264, h265, hevc, av1, vp8, vp9, opus, aac, mp3)
 * @returns {Array<{level: "info" | "warning", message: string}>}
 */
export function getCodecCompatibilityHints(codec) {
  if (!codec) return []
  const c = String(codec).toLowerCase()
  const warnings = []

  if (c === "h265" || c === "hevc") {
    warnings.push({
      level: "warning",
      message:
        "H265/HEVC không được Chrome/Firefox hỗ trợ trong HLS/WebRTC trên hầu hết hệ điều hành. Cân nhắc re-encode sang H264.",
    })
  }
  if (c === "av1") {
    warnings.push({
      level: "warning",
      message: "AV1 chưa được hỗ trợ rộng rãi cho streaming realtime trên trình duyệt. Re-encode sang H264 cho khả năng tương thích tối đa.",
    })
  }
  if (c === "vp9") {
    warnings.push({
      level: "info",
      message: "VP9 chạy tốt với WebRTC nhưng không qua HLS. Dùng H264 nếu cần HLS.",
    })
  }
  if (c === "vp8") {
    warnings.push({
      level: "info",
      message: "VP8 chỉ hỗ trợ WebRTC, không hỗ trợ HLS/RTSP/RTMP.",
    })
  }
  if (c === "mp3") {
    warnings.push({
      level: "warning",
      message: "MP3 không tương thích WebRTC. Transcode sang Opus hoặc AAC để phát qua trình duyệt.",
    })
  }

  return warnings
}

// ──────────────────────────────────────────────
// 2.6 JSON/YAML Import/Export Utilities
// ──────────────────────────────────────────────

/**
 * Export path defaults as a JSON string.
 * @param {import("./mediamtx-api").PathConf} pathDefaults
 * @param {boolean} [pretty] - Pretty-print output
 * @returns {string}
 */
export function exportDefaultsAsJson(pathDefaults, pretty = true) {
  if (!pathDefaults) return "{}"
  const filtered = {}
  for (const field of PATH_DEFAULTS_FIELDS) {
    if (pathDefaults[field] !== undefined) {
      filtered[field] = pathDefaults[field]
    }
  }
  return pretty ? JSON.stringify(filtered, null, 2) : JSON.stringify(filtered)
}

/**
 * Export path defaults as a YAML-like string.
 * Note: Uses a simple serializer. For production, consider js-yaml.
 * @param {import("./mediamtx-api").PathConf} pathDefaults
 * @returns {string}
 */
export function exportDefaultsAsYaml(pathDefaults) {
  if (!pathDefaults) return "# pathDefaults\n"
  const lines = ["# pathDefaults"]
  for (const field of PATH_DEFAULTS_FIELDS) {
    const value = pathDefaults[field]
    if (value === undefined) continue
    if (typeof value === "boolean") {
      lines.push(`${field}: ${value ? "true" : "false"}`)
    } else if (typeof value === "number") {
      lines.push(`${field}: ${value}`)
    } else if (typeof value === "string") {
      // Quote strings that need quoting
      if (/[:\[\]{}|>!@#&*]/.test(value) || value.includes(" ") || value === "") {
        lines.push(`${field}: "${value.replace(/"/g, '\\"')}"`)
      } else {
        lines.push(`${field}: ${value}`)
      }
    } else if (Array.isArray(value)) {
      lines.push(`${field}:`)
      for (const item of value) {
        lines.push(`  - ${JSON.stringify(item)}`)
      }
    }
  }
  return lines.join("\n")
}

/**
 * Parse a JSON defaults string with validation.
 * @param {string} jsonString
 * @returns {{ok: true, data: Record<string, any>}|{ok: false, error: string}}
 */
export function parseDefaultsJson(jsonString) {
  try {
    const data = JSON.parse(jsonString)
    if (typeof data !== "object" || data === null || Array.isArray(data)) {
      return { ok: false, error: "JSON phải là object" }
    }
    return { ok: true, data }
  } catch (cause) {
    return { ok: false, error: `JSON không hợp lệ: ${cause.message}` }
  }
}

/**
 * Validate imported defaults data against the field registry.
 * @param {Record<string, any>} data
 * @returns {{ok: true, data: Record<string, any>}|{ok: false, error: string, fieldErrors?: Record<string, string>}}
 */
export function validateImportedDefaults(data) {
  const fieldErrors = validateDefaultsPatch(data)
  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, error: "Dữ liệu path defaults không hợp lệ", fieldErrors }
  }

  // Check for unknown fields (warn only, still allow)
  const knownFields = new Set(PATH_FIELD_REGISTRY.map((e) => e.field))
  const unknownFields = Object.keys(data).filter((f) => !knownFields.has(f))
  if (unknownFields.length > 0) {
    return { ok: true, data, warnings: `Các trường không xác định: ${unknownFields.join(", ")}` }
  }

  return { ok: true, data }
}

/**
 * Simple YAML parser for the subset of YAML used by path defaults export.
 * @param {string} yamlString
 * @returns {{ok: true, data: Record<string, any>}|{ok: false, error: string}}
 */
export function parseDefaultsYaml(yamlString) {
  try {
    const lines = yamlString.split("\n")
    const data = {}

    for (const rawLine of lines) {
      const line = rawLine.trim()
      if (!line || line.startsWith("#")) continue // skip comments and empty
      if (line.startsWith("-")) continue // skip array items (not supported at top level)

      const colonIndex = line.indexOf(":")
      if (colonIndex === -1) continue

      const field = line.slice(0, colonIndex).trim()
      let valueStr = line.slice(colonIndex + 1).trim()

      // Skip array-style values for now
      if (valueStr === "") continue

      // Parse value
      let value
      if (valueStr === "true") value = true
      else if (valueStr === "false") value = false
      else if (/^\d+$/.test(valueStr)) value = Number.parseInt(valueStr, 10)
      else if (/^\d+\.\d+$/.test(valueStr)) value = Number.parseFloat(valueStr)
      else if (valueStr.startsWith('"') && valueStr.endsWith('"')) {
        value = valueStr.slice(1, -1).replace(/\\"/g, '"')
      } else if (valueStr.startsWith("'") && valueStr.endsWith("'")) {
        value = valueStr.slice(1, -1)
      } else {
        value = valueStr
      }

      data[field] = value
    }

    return { ok: true, data }
  } catch (cause) {
    return { ok: false, error: `YAML không hợp lệ: ${cause.message}` }
  }
}

/**
 * Build a preview payload from imported data for review before applying.
 * @param {Record<string, any>} importedData
 * @param {import("./mediamtx-api").PathConf} currentDefaults
 * @returns {{changed: Record<string, {from: any, to: any}>, unchanged: string[]}}
 */
export function buildImportPreviewPayload(importedData, currentDefaults) {
  const changed = {}
  const unchanged = []

  for (const [field, newValue] of Object.entries(importedData)) {
    const currentValue = currentDefaults?.[field]
    if (newValue !== currentValue) {
      changed[field] = { from: currentValue, to: newValue }
    } else {
      unchanged.push(field)
    }
  }

  return { changed, unchanged }
}

/**
 * Check if a source URL is an upstream (proxy) URL rather than a publisher or special source.
 * Upstream sources pull from external servers via RTSP, RTMP, HLS, or SRT protocols.
 * @param {string|null|undefined} source - The source field value
 * @returns {boolean} True if the source is an upstream/proxy URL
 */
export function isUpstreamSourceUrl(source) {
  if (!source || typeof source !== "string") return false
  if (source === "publisher") return false
  if (source.startsWith("redirect")) return false
  if (source.includes("rpiCamera")) return false
  if (source.startsWith("/dev/")) return false
  // Upstream protocols: rtsp://, rtsps://, rtmp://, rtmps://, http://, https://, srt://
  return !!(
    source.startsWith("rtsp://") ||
    source.startsWith("rtsps://") ||
    source.startsWith("rtmp://") ||
    source.startsWith("rtmps://") ||
    source.startsWith("http://") ||
    source.startsWith("https://") ||
    source.startsWith("srt://") ||
    source.startsWith("udp://") ||
    source.startsWith("whep://")
  )
}
