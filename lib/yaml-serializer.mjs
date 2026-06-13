// Minimal YAML serializer dành cho MediaMTX config: object lồng nhau, mảng
// string/number/boolean, không cần anchor hay tag. Tránh thêm dependency.

const SCALAR_NEEDS_QUOTE = /[:#&*!|>'"%@`,\[\]\{\}?\-]|^\s|\s$|^(true|false|null|yes|no|on|off|~)$/i

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

function formatScalar(value) {
  if (value === null || value === undefined) return "null"
  if (typeof value === "boolean") return value ? "true" : "false"
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return ".nan"
    return String(value)
  }
  const str = String(value)
  if (str === "") return '""'
  if (str.includes("\n")) {
    const lines = str.split("\n")
    return "|\n" + lines.map((l) => "  " + l).join("\n")
  }
  if (SCALAR_NEEDS_QUOTE.test(str) || /^[0-9]/.test(str)) {
    const escaped = str.replace(/\\/g, "\\\\").replace(/"/g, '\\"')
    return `"${escaped}"`
  }
  return str
}

function serialize(value, indent) {
  const pad = "  ".repeat(indent)
  if (Array.isArray(value)) {
    if (value.length === 0) return "[]"
    return value
      .map((item) => {
        if (isPlainObject(item)) {
          const inner = serialize(item, indent + 1)
          // First key inline after "- ", rest indented
          const lines = inner.split("\n")
          if (lines.length === 0) return `${pad}- {}`
          return `${pad}- ${lines[0].trimStart()}${lines
            .slice(1)
            .map((l) => "\n" + l)
            .join("")}`
        }
        if (Array.isArray(item)) {
          return `${pad}-\n${serialize(item, indent + 1)}`
        }
        return `${pad}- ${formatScalar(item)}`
      })
      .join("\n")
  }
  if (isPlainObject(value)) {
    const keys = Object.keys(value)
    if (keys.length === 0) return `${pad}{}`
    return keys
      .map((key) => {
        const v = value[key]
        const keyStr = SCALAR_NEEDS_QUOTE.test(key) ? `"${key.replace(/"/g, '\\"')}"` : key
        if (isPlainObject(v)) {
          if (Object.keys(v).length === 0) return `${pad}${keyStr}: {}`
          return `${pad}${keyStr}:\n${serialize(v, indent + 1)}`
        }
        if (Array.isArray(v)) {
          if (v.length === 0) return `${pad}${keyStr}: []`
          return `${pad}${keyStr}:\n${serialize(v, indent + 1)}`
        }
        const scalar = formatScalar(v)
        if (scalar.startsWith("|\n")) {
          // Block scalar: indent block under key
          const body = scalar.slice(2)
          const reindented = body
            .split("\n")
            .map((l) => pad + l)
            .join("\n")
          return `${pad}${keyStr}: |\n${reindented}`
        }
        return `${pad}${keyStr}: ${scalar}`
      })
      .join("\n")
  }
  return `${pad}${formatScalar(value)}`
}

export function toYaml(value) {
  return serialize(value, 0) + "\n"
}

/**
 * Build a mediamtx.yml object từ các phần config dashboard export.
 * MediaMTX yml layout: top-level global keys + `pathDefaults: {}` + `paths: { name: {...} }`.
 *
 * @param {{ global?: Record<string, any>, pathDefaults?: Record<string, any>, paths?: Array<Record<string, any>> }} bundle
 */
export function buildMediaMtxYaml(bundle) {
  const out = {}
  if (bundle.global && typeof bundle.global === "object") {
    for (const [k, v] of Object.entries(bundle.global)) {
      if (v === undefined || v === null) continue
      out[k] = v
    }
  }
  if (bundle.pathDefaults && typeof bundle.pathDefaults === "object") {
    const pd = {}
    for (const [k, v] of Object.entries(bundle.pathDefaults)) {
      if (v === undefined || v === null) continue
      if (k === "name") continue
      pd[k] = v
    }
    if (Object.keys(pd).length > 0) out.pathDefaults = pd
  }
  if (Array.isArray(bundle.paths) && bundle.paths.length > 0) {
    const paths = {}
    for (const p of bundle.paths) {
      if (!p?.name) continue
      const entry = {}
      for (const [k, v] of Object.entries(p)) {
        if (k === "name") continue
        if (v === undefined || v === null) continue
        entry[k] = v
      }
      paths[p.name] = entry
    }
    if (Object.keys(paths).length > 0) out.paths = paths
  }
  return toYaml(out)
}
