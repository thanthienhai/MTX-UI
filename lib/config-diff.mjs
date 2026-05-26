/**
 * Pure helpers for the config import/export panel. Kept in .mjs so they can
 * be unit-tested without spinning up the React component.
 *
 * @typedef {"global" | "pathDefaults" | "path"} DiffScope
 * @typedef {Object} DiffEntry
 * @property {DiffScope} scope
 * @property {string} field
 * @property {unknown} current
 * @property {unknown} incoming
 * @property {string} [pathName]
 * @property {boolean} [newPath]
 */

export function isObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

/**
 * Order-insensitive deep equality. JSON.stringify is not safe because it
 * encodes object keys in insertion order.
 */
export function deepEqual(a, b) {
  if (a === b) return true
  if (a === null || b === null || a === undefined || b === undefined) return a === b
  if (typeof a !== typeof b) return false
  if (typeof a !== "object") return a === b
  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) return false
    for (let i = 0; i < a.length; i++) if (!deepEqual(a[i], b[i])) return false
    return true
  }
  if (Array.isArray(b)) return false
  const ao = a
  const bo = b
  const aKeys = Object.keys(ao)
  const bKeys = Object.keys(bo)
  if (aKeys.length !== bKeys.length) return false
  for (const k of aKeys) {
    if (!Object.prototype.hasOwnProperty.call(bo, k)) return false
    if (!deepEqual(ao[k], bo[k])) return false
  }
  return true
}

/**
 * @param {Record<string, unknown> | undefined} current
 * @param {Record<string, unknown> | undefined} incoming
 * @param {DiffScope} scope
 * @param {string} [pathName]
 * @returns {DiffEntry[]}
 */
export function diffObjects(current, incoming, scope, pathName) {
  /** @type {DiffEntry[]} */
  const result = []
  const keys = new Set([...Object.keys(current || {}), ...Object.keys(incoming || {})])
  for (const key of keys) {
    const a = current?.[key]
    const b = incoming?.[key]
    if (!deepEqual(a, b)) {
      result.push({ scope, pathName, field: key, current: a, incoming: b })
    }
  }
  return result
}

/**
 * Build the diff entries for a list of incoming path configs against the
 * current set. Entries belonging to paths that don't exist locally are
 * tagged `newPath: true` so the UI can disable per-field checkboxes.
 *
 * @param {Array<{name: string}>} incomingPaths
 * @param {Array<{name: string}>} currentPaths
 * @returns {DiffEntry[]}
 */
export function diffPathsBundle(incomingPaths, currentPaths) {
  const currentByName = new Map(currentPaths.map((p) => [p.name, p]))
  /** @type {DiffEntry[]} */
  const out = []
  for (const incoming of incomingPaths) {
    if (!incoming?.name) continue
    const existing = currentByName.get(incoming.name)
    const entries = diffObjects(existing, incoming, "path", incoming.name)
    const isNew = !existing
    for (const e of entries) {
      if (isNew) e.newPath = true
      out.push(e)
    }
  }
  return out
}

/**
 * Partition a list of diff entries + a selection set into PATCH payloads
 * grouped by scope and path. New-path entries are always included
 * (selection ignored) because addPath needs the path config atomically.
 *
 * @param {DiffEntry[]} entries
 * @param {Set<string>} selected
 * @param {(d: DiffEntry) => string} key
 */
export function buildApplyPlan(entries, selected, key) {
  /** @type {Record<string, unknown>} */
  const globalPatch = {}
  /** @type {Record<string, unknown>} */
  const defaultsPatch = {}
  /** @type {Map<string, Record<string, unknown>>} */
  const pathPatches = new Map()
  /** @type {Set<string>} */
  const newPaths = new Set()

  for (const d of entries) {
    if (!d.newPath && !selected.has(key(d))) continue
    if (d.scope === "global") globalPatch[d.field] = d.incoming
    else if (d.scope === "pathDefaults") defaultsPatch[d.field] = d.incoming
    else if (d.scope === "path" && d.pathName) {
      const patch = pathPatches.get(d.pathName) ?? {}
      patch[d.field] = d.incoming
      pathPatches.set(d.pathName, patch)
      if (d.newPath) newPaths.add(d.pathName)
    }
  }

  return { globalPatch, defaultsPatch, pathPatches, newPaths }
}
