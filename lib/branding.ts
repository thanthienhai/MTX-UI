const BASE = (process.env.NEXT_PUBLIC_BASE_PATH || "").replace(/\/+$/, "")

/** Public path to the SIPVY logo, prefixed with the configured basePath. */
export const LOGO_SRC = `${BASE}/sipvy_secondary_logo.png`
