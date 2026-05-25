export type AuditResult = "success" | "failure"

export interface DashboardAuditEvent {
  id: string
  timestamp: string
  actor?: string | null
  action: string
  target: string
  payloadSummary?: string
  result: AuditResult
  errorSummary?: string
}

const STORAGE_KEY = "mediamtx_dashboard_audit"

export function createAuditEvent(event: Omit<DashboardAuditEvent, "id" | "timestamp">): DashboardAuditEvent {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    timestamp: new Date().toISOString(),
    ...event,
  }
}

export function loadAuditEvents(): DashboardAuditEvent[] {
  if (typeof window === "undefined") return []

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function saveAuditEvents(events: DashboardAuditEvent[]) {
  if (typeof window === "undefined") return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(events.slice(0, 100)))
}

