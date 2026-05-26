import { deltaSnapshots } from "./prometheus.mjs"

/**
 * MediaMTX metrics name candidates per alert category.
 *
 * MediaMTX 1.x emits per-path series `paths{name=...,state=ready|notReady|...}`
 * with value=1 in the relevant state, and counters/gauges under the
 * `mediamtx_paths_*` prefix per the project's MONITORING.md. The candidate
 * list shields the UI against minor renames across MediaMTX builds.
 */
export const METRIC_NAMES = {
  paths: ["paths", "mediamtx_paths"],
  readers: ["mediamtx_paths_readers", "paths_readers"],
  bytesReceived: ["mediamtx_paths_bytes_received", "paths_bytes_received"],
  packetsLost: [
    "rtsp_sessions_rtp_packets_lost",
    "rtsps_sessions_rtp_packets_lost",
    "srt_conns_packets_lost",
    "mediamtx_paths_packets_lost",
  ],
  framesDiscarded: ["mediamtx_paths_frames_discarded", "paths_frames_discarded"],
  framesError: ["mediamtx_paths_frames_error", "paths_frames_error", "paths_errors"],
  jitter: ["mediamtx_paths_jitter", "paths_jitter", "rtsp_sessions_jitter"],
}

/**
 * @param {import("./prometheus.mjs").PromSample[]} parsed
 * @param {readonly string[]} candidates
 */
export function pickByName(parsed, candidates) {
  for (const name of candidates) {
    const samples = parsed.filter((s) => s.name === name)
    if (samples.length > 0) return { name, samples }
  }
  return { name: candidates[0], samples: [] }
}

/**
 * @param {Record<string,string>} labels
 */
export function pathLabel(labels) {
  return labels.name || labels.path || labels.id
}

/**
 * MediaMTX emits one `paths{name=X,state=Y} 1` sample per (name,state). A path
 * is "ready" iff there is a sample with state=ready and value > 0. Falls back
 * to false when only non-ready states are reported.
 *
 * @param {import("./prometheus.mjs").PromSample[]} samples
 * @returns {Map<string, boolean>}
 */
export function pathsReadyStatus(samples) {
  /** @type {Map<string, boolean>} */
  const out = new Map()
  for (const s of samples) {
    const name = pathLabel(s.labels)
    if (!name) continue
    const state = (s.labels.state || "").toLowerCase()
    if (state === "ready" && s.value > 0) {
      out.set(name, true)
    } else if (!out.has(name)) {
      out.set(name, false)
    }
  }
  return out
}

/**
 * @typedef {Object} Thresholds
 * @property {number} packetLossPerSec
 * @property {number} jitterMs
 * @property {number} framesDiscardedPerSec
 * @property {number} errorFramesPerSec
 * @property {number} stallSeconds
 *
 * @typedef {Object} AlertEntry
 * @property {string} id
 * @property {"high"|"medium"|"low"} severity
 * @property {string} title
 * @property {string} detail
 * @property {string} [pathName]
 */

/**
 * @param {import("./prometheus.mjs").PromSample[]} curr
 * @param {import("./prometheus.mjs").PromSample[] | null} prev
 * @param {number} elapsedSec
 * @param {Thresholds} thresholds
 * @param {Map<string, number>} bytesAtZeroSince
 * @param {number} now
 * @returns {AlertEntry[]}
 */
export function computeAlerts(curr, prev, elapsedSec, thresholds, bytesAtZeroSince = new Map(), now = Date.now()) {
  /** @type {AlertEntry[]} */
  const out = []

  const { samples: pathsSamples } = pickByName(curr, METRIC_NAMES.paths)
  const ready = pathsReadyStatus(pathsSamples)
  for (const [name, isReady] of ready) {
    if (!isReady) {
      out.push({
        id: `offline-${name}`,
        severity: "high",
        title: "Source offline",
        detail: `Path ${name} không ở state=ready. Kiểm tra source/upstream.`,
        pathName: name,
      })
    }
  }

  const { samples: readersSamples } = pickByName(curr, METRIC_NAMES.readers)
  for (const s of readersSamples) {
    if (s.value === 0) {
      const name = pathLabel(s.labels)
      if (name && ready.get(name) === true) {
        out.push({
          id: `no-readers-${name}`,
          severity: "low",
          title: "Không có reader",
          detail: `Path ${name} đang ready nhưng không có client đang đọc.`,
          pathName: name,
        })
      }
    }
  }

  // Byte-rate stall
  if (prev && elapsedSec > 0) {
    const { samples: bytesNow } = pickByName(curr, METRIC_NAMES.bytesReceived)
    const { samples: bytesPrev } = pickByName(prev, METRIC_NAMES.bytesReceived)
    /** @type {Map<string, number>} */
    const prevByName = new Map()
    for (const s of bytesPrev) {
      const name = pathLabel(s.labels)
      if (name) prevByName.set(name, s.value)
    }
    for (const s of bytesNow) {
      const name = pathLabel(s.labels)
      if (!name) continue
      if (ready.get(name) !== true) {
        bytesAtZeroSince.delete(name)
        continue
      }
      const before = prevByName.get(name)
      if (before === undefined) continue
      if (s.value > before) {
        bytesAtZeroSince.delete(name)
        continue
      }
      const since = bytesAtZeroSince.get(name) ?? now
      bytesAtZeroSince.set(name, since)
      const stalledFor = (now - since) / 1000
      if (stalledFor >= thresholds.stallSeconds) {
        out.push({
          id: `stall-${name}`,
          severity: stalledFor >= thresholds.stallSeconds * 3 ? "high" : "medium",
          title: "Stream stalled",
          detail: `Path ${name} không nhận thêm byte trong ${Math.round(stalledFor)}s (ngưỡng ${thresholds.stallSeconds}s).`,
          pathName: name,
        })
      }
    }
  }

  const { samples: jitterSamples } = pickByName(curr, METRIC_NAMES.jitter)
  for (const s of jitterSamples) {
    const ms = s.value * 1000
    if (ms >= thresholds.jitterMs) {
      const name = pathLabel(s.labels)
      out.push({
        id: `jitter-${name || JSON.stringify(s.labels)}`,
        severity: ms >= thresholds.jitterMs * 2 ? "high" : "medium",
        title: "Jitter cao",
        detail: `Jitter ${ms.toFixed(1)} ms (ngưỡng ${thresholds.jitterMs} ms)`,
        pathName: name,
      })
    }
  }

  if (!prev || elapsedSec <= 0) return out

  /**
   * @param {import("./prometheus.mjs").SampleDelta[]} deltas
   * @param {number} threshold
   * @param {string} titleBase
   * @param {number} [highMultiplier]
   */
  const pushDeltaAlert = (deltas, threshold, titleBase, highMultiplier = 5) => {
    for (const d of deltas) {
      const rate = d.delta / elapsedSec
      if (rate >= threshold) {
        const name = pathLabel(d.labels)
        out.push({
          id: `${titleBase}-${d.name}-${name || JSON.stringify(d.labels)}`,
          severity: rate >= threshold * highMultiplier ? "high" : "medium",
          title: titleBase,
          detail: `${rate.toFixed(2)}/s (ngưỡng ${threshold}/s) — metric ${d.name}`,
          pathName: name,
        })
      }
    }
  }

  const lossNames = METRIC_NAMES.packetsLost
  pushDeltaAlert(
    deltaSnapshots(
      prev.filter((s) => lossNames.includes(s.name)),
      curr.filter((s) => lossNames.includes(s.name)),
    ),
    thresholds.packetLossPerSec,
    "Packet loss",
  )

  const discardNames = METRIC_NAMES.framesDiscarded
  pushDeltaAlert(
    deltaSnapshots(
      prev.filter((s) => discardNames.includes(s.name)),
      curr.filter((s) => discardNames.includes(s.name)),
    ),
    thresholds.framesDiscardedPerSec,
    "Frames discarded",
    3,
  )

  const errorNames = METRIC_NAMES.framesError
  pushDeltaAlert(
    deltaSnapshots(
      prev.filter((s) => errorNames.includes(s.name)),
      curr.filter((s) => errorNames.includes(s.name)),
    ),
    thresholds.errorFramesPerSec,
    "Error frames",
    3,
  )

  return out
}
