/**
 * In-memory audit ring buffer for relay events.
 *
 * Stores up to N recent entries per event slug in process memory. Entries
 * survive across requests within a Node process but are LOST on restart — a
 * persistent store would need a storage decision the project hasn't made yet.
 * Trade-off is intentional: zero deployment cost vs. no long-term history.
 */

export interface AuditEntry {
  ts: string
  action: string
  detail?: Record<string, unknown>
}

const MAX_PER_SLUG = 50

const buffer = new Map<string, AuditEntry[]>()

export function recordAudit(slug: string, action: string, detail?: Record<string, unknown>): void {
  if (!slug || !action) return
  const list = buffer.get(slug) ?? []
  list.push({ ts: new Date().toISOString(), action, detail })
  while (list.length > MAX_PER_SLUG) list.shift()
  buffer.set(slug, list)
}

/** Return entries newest-first (capped to `limit`). */
export function getAuditFor(slug: string, limit = 20): AuditEntry[] {
  const list = buffer.get(slug)
  if (!list) return []
  return list.slice(-limit).reverse()
}

/** Test-only helper (no-op in prod paths). */
export function _clearAudit(): void {
  buffer.clear()
}
