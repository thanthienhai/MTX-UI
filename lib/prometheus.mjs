/**
 * Minimal Prometheus text-format parser.
 *
 * Parses `# HELP`, `# TYPE`, and `metric_name{label="value",...} number [timestamp]`
 * lines. Lines that don't match are ignored.
 *
 * @typedef {Object} PromSample
 * @property {string} name
 * @property {Record<string,string>} labels
 * @property {number} value
 *
 * @typedef {Object} SampleDelta
 * @property {string} name
 * @property {Record<string,string>} labels
 * @property {number} delta
 */

const SAMPLE_RE =
  /^([a-zA-Z_:][a-zA-Z0-9_:]*)(?:\{([^}]*)\})?\s+([+-]?(?:\d+(?:\.\d+)?|\.\d+|NaN|nan|Inf|inf))(?:\s+\d+)?\s*$/

/**
 * @param {string} labelsRaw
 * @returns {Record<string,string>}
 */
function parseLabels(labelsRaw) {
  /** @type {Record<string,string>} */
  const labels = {}
  if (!labelsRaw) return labels
  const re = /([a-zA-Z_][a-zA-Z0-9_]*)="((?:[^"\\]|\\.)*)"/g
  let m
  while ((m = re.exec(labelsRaw)) !== null) {
    labels[m[1]] = m[2].replace(/\\"/g, '"').replace(/\\\\/g, "\\").replace(/\\n/g, "\n")
  }
  return labels
}

/**
 * @param {string} raw
 * @returns {number}
 */
function parseValue(raw) {
  if (raw === "NaN" || raw === "nan") return NaN
  if (raw === "+Inf" || raw === "Inf" || raw === "inf") return Infinity
  if (raw === "-Inf") return -Infinity
  return Number(raw)
}

/**
 * @param {string} text
 * @returns {PromSample[]}
 */
export function parsePrometheus(text) {
  /** @type {PromSample[]} */
  const samples = []
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith("#")) continue
    const m = SAMPLE_RE.exec(line)
    if (!m) continue
    samples.push({ name: m[1], labels: parseLabels(m[2] || ""), value: parseValue(m[3]) })
  }
  return samples
}

/**
 * @param {PromSample[]} samples
 * @returns {Map<string, PromSample[]>}
 */
export function indexByName(samples) {
  /** @type {Map<string, PromSample[]>} */
  const out = new Map()
  for (const s of samples) {
    const arr = out.get(s.name) || []
    arr.push(s)
    out.set(s.name, arr)
  }
  return out
}

/**
 * @param {PromSample[]} samples
 * @param {string} name
 * @param {Record<string, string | RegExp>} [labelMatches]
 * @returns {PromSample[]}
 */
export function filterSamples(samples, name, labelMatches = {}) {
  return samples.filter((s) => {
    if (s.name !== name) return false
    for (const [k, v] of Object.entries(labelMatches)) {
      const labelValue = s.labels[k]
      if (v instanceof RegExp) {
        if (!labelValue || !v.test(labelValue)) return false
      } else if (labelValue !== v) {
        return false
      }
    }
    return true
  })
}

/**
 * @param {PromSample} s
 * @returns {string}
 */
function fingerprint(s) {
  const keys = Object.keys(s.labels).sort()
  return `${s.name}|${keys.map((k) => `${k}=${s.labels[k]}`).join(",")}`
}

/**
 * Compute deltas between two snapshot arrays.
 *
 * @param {PromSample[]} prev
 * @param {PromSample[]} curr
 * @returns {SampleDelta[]}
 */
export function deltaSnapshots(prev, curr) {
  const prevMap = new Map(prev.map((s) => [fingerprint(s), s.value]))
  /** @type {SampleDelta[]} */
  const out = []
  for (const s of curr) {
    const before = prevMap.get(fingerprint(s))
    if (typeof before === "number" && Number.isFinite(before) && Number.isFinite(s.value)) {
      out.push({ name: s.name, labels: s.labels, delta: s.value - before })
    }
  }
  return out
}
