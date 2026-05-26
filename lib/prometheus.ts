/**
 * Minimal Prometheus text-format parser.
 *
 * Parses `# HELP`, `# TYPE`, and `metric_name{label="value",...} number [timestamp]`
 * lines. Lines that don't match are ignored.
 */

export interface PromSample {
  name: string
  labels: Record<string, string>
  value: number
}

const SAMPLE_RE = /^([a-zA-Z_:][a-zA-Z0-9_:]*)(?:\{([^}]*)\})?\s+([+-]?(?:\d+(?:\.\d+)?|\d+\.\d+|\.\d+|NaN|[+-]?Inf|nan|inf))(?:\s+\d+)?\s*$/

function parseLabels(labelsRaw: string): Record<string, string> {
  const labels: Record<string, string> = {}
  if (!labelsRaw) return labels
  // simple split that respects quoted values; Prometheus values are quoted strings
  const re = /([a-zA-Z_][a-zA-Z0-9_]*)="((?:[^"\\]|\\.)*)"/g
  let m: RegExpExecArray | null
  while ((m = re.exec(labelsRaw)) !== null) {
    labels[m[1]] = m[2].replace(/\\"/g, '"').replace(/\\\\/g, "\\").replace(/\\n/g, "\n")
  }
  return labels
}

function parseValue(raw: string): number {
  if (raw === "NaN" || raw === "nan") return NaN
  if (raw === "+Inf" || raw === "Inf" || raw === "inf") return Infinity
  if (raw === "-Inf") return -Infinity
  return Number(raw)
}

export function parsePrometheus(text: string): PromSample[] {
  const samples: PromSample[] = []
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
 * Group samples by name → array of {labels, value}.
 */
export function indexByName(samples: PromSample[]): Map<string, PromSample[]> {
  const out = new Map<string, PromSample[]>()
  for (const s of samples) {
    const arr = out.get(s.name) || []
    arr.push(s)
    out.set(s.name, arr)
  }
  return out
}

/**
 * Filter samples by name and label predicates.
 */
export function filterSamples(
  samples: PromSample[],
  name: string,
  labelMatches: Record<string, string | RegExp> = {},
): PromSample[] {
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
 * Compute deltas between two snapshot maps keyed by sample fingerprint.
 * Returns map of `${name}|${sortedLabels}` -> delta number.
 */
export function deltaSnapshots(prev: PromSample[], curr: PromSample[]): Map<string, number> {
  function fp(s: PromSample) {
    const keys = Object.keys(s.labels).sort()
    return `${s.name}|${keys.map((k) => `${k}=${s.labels[k]}`).join(",")}`
  }
  const prevMap = new Map(prev.map((s) => [fp(s), s.value]))
  const out = new Map<string, number>()
  for (const s of curr) {
    const k = fp(s)
    const before = prevMap.get(k)
    if (typeof before === "number" && Number.isFinite(before) && Number.isFinite(s.value)) {
      out.set(k, s.value - before)
    }
  }
  return out
}
