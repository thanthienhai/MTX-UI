/**
 * One-time migration: legacy single-path fan-out  ->  per-destination paths.
 *
 * BACKGROUND. Originally one relay event = one MediaMTX path, and ALL fan-out
 * destinations were smuggled into that ingest path's `runOnReady` (a single
 * ffmpeg tee) plus a `destinations[]` array inside RELAY_META. Editing any
 * destination patched the ingest path, which made MediaMTX reload it and kick
 * the live publisher. The new architecture gives every destination its OWN
 * MediaMTX path `<slug>__fo__<id>` (source = the ingest over local RTSP), so
 * destination edits never touch the ingest path.
 *
 * This script walks every existing event and, for any that still carries a
 * legacy `meta.destinations` array, creates the equivalent fan-out paths and
 * then strips `destinations` from the ingest meta (leaving the ingest
 * runOnReady as the metadata no-op). It is IDEMPOTENT: an event that already
 * has fan-out paths, or no legacy destinations, is skipped.
 *
 * It mutates the REAL MediaMTX backend, so it is meant to be run by you, once,
 * after deploying the new code. Stream keys are never printed.
 *
 *   Env:
 *     MEDIAMTX_API_URL        e.g. http://103.179.189.128:9997   (required)
 *     MEDIAMTX_ADMIN_USER     admin username                     (required)
 *     MEDIAMTX_ADMIN_PASS     admin password
 *     RELAY_ASSET_BASE_URL    public FE URL for fallback assets  (optional)
 *
 *   Run (no node on PATH here — use your wheel/system node):
 *     node scripts/migrate-relay-fanout.mjs            # apply
 *     node scripts/migrate-relay-fanout.mjs --dry-run  # preview only
 */

import {
  parseRunOnReady,
  parseFanoutMeta,
  isFanoutPathName,
  fanoutPathName,
  fanoutSourceUrl,
  buildRunOnReady,
  buildFanoutRunOnReady,
  buildFanoutRunOnNotReady,
} from "../lib/relay-event.mjs"

const DRY_RUN = process.argv.includes("--dry-run") || process.argv.includes("-n")

function apiBase() {
  const raw = (process.env.MEDIAMTX_API_URL || "http://localhost:9997").trim()
  return raw.replace(/\/+$/, "").replace(/\/v3\/config$/i, "").replace(/\/v3$/i, "")
}

function authHeader() {
  const user = process.env.MEDIAMTX_ADMIN_USER
  const pass = process.env.MEDIAMTX_ADMIN_PASS
  if (!user) return undefined
  return "Basic " + Buffer.from(`${user}:${pass ?? ""}`).toString("base64")
}

function assetBaseUrl() {
  return (process.env.RELAY_ASSET_BASE_URL || "").trim().replace(/\/+$/, "")
}

async function api(endpoint, init) {
  const url = `${apiBase()}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`
  const headers = { ...(init?.headers || {}) }
  const auth = authHeader()
  if (auth) headers.authorization = auth
  if (init?.body && !headers["content-type"]) headers["content-type"] = "application/json"
  const res = await fetch(url, { ...init, headers })
  if (!res.ok) throw new Error(`${endpoint} -> ${res.status}`)
  if (res.status === 204) return undefined
  const text = await res.text()
  return text ? JSON.parse(text) : undefined
}

async function listAllPaths() {
  const data = await api("/v3/config/paths/list")
  return data?.items ?? []
}

/** Build the create-body for one destination's fan-out path. */
function fanoutAddBody(slug, dest, { relayEnabled, fallback }) {
  return {
    name: fanoutPathName(slug, dest.id),
    source: fanoutSourceUrl(slug),
    sourceOnDemand: false,
    runOnReady: buildFanoutRunOnReady(dest, { slug, relayEnabled }),
    runOnReadyRestart: relayEnabled && !!dest.enabled,
    runOnNotReady: buildFanoutRunOnNotReady(dest, fallback, {
      slug,
      assetBaseUrl: assetBaseUrl(),
      relayEnabled,
    }),
  }
}

async function main() {
  if (!authHeader()) {
    console.error("✗ MEDIAMTX_ADMIN_USER is not set — refusing to run without admin credentials.")
    process.exit(1)
  }
  console.log(`Migration target: ${apiBase()}${DRY_RUN ? "   (DRY RUN — no writes)" : ""}`)

  const items = await listAllPaths()

  // Index existing fan-out paths by the parent slug they belong to.
  const fanoutByParent = new Map()
  for (const it of items) {
    if (!it.name || !isFanoutPathName(it.name)) continue
    const fm = it.runOnReady ? parseFanoutMeta(it.runOnReady) : null
    if (!fm?.parentSlug) continue
    if (!fanoutByParent.has(fm.parentSlug)) fanoutByParent.set(fm.parentSlug, [])
    fanoutByParent.get(fm.parentSlug).push(it.name)
  }

  // Every ingest/event path (carries RELAY_META, not a fan-out path).
  const events = []
  for (const it of items) {
    if (!it.name || isFanoutPathName(it.name)) continue
    const meta = it.runOnReady ? parseRunOnReady(it.runOnReady) : null
    if (meta) events.push({ name: it.name, meta })
  }

  let migrated = 0
  let skipped = 0
  let createdPaths = 0

  for (const ev of events) {
    const slug = ev.meta.slug || ev.name
    const legacy = ev.meta.destinations
    const hasFanout = (fanoutByParent.get(slug) || []).length > 0

    if (hasFanout) {
      console.log(`• ${slug}: đã có fan-out path → bỏ qua`)
      skipped++
      continue
    }
    if (!Array.isArray(legacy) || legacy.length === 0) {
      // Nothing to migrate. If an empty/legacy field lingers, tidy it so the
      // ingest meta matches the new shape (only when not a dry run).
      if (legacy !== undefined && !DRY_RUN) {
        const { destinations: _drop, ...rest } = ev.meta
        await api(`/v3/config/paths/patch/${encodeURIComponent(ev.name)}`, {
          method: "PATCH",
          body: JSON.stringify({ runOnReady: buildRunOnReady(rest), runOnReadyRestart: false, runOnNotReady: "" }),
        })
        console.log(`• ${slug}: không có đích — đã dọn field destinations rỗng`)
      } else {
        console.log(`• ${slug}: không có đích để migrate → bỏ qua`)
      }
      skipped++
      continue
    }

    const relayEnabled = ev.meta.relayEnabled !== false
    const fallback = ev.meta.fallback
    console.log(`• ${slug}: migrate ${legacy.length} đích${DRY_RUN ? " (dry-run)" : ""}`)

    for (const d of legacy) {
      const dest = {
        id: d.id,
        name: d.name,
        platform: d.platform,
        serverUrl: String(d.serverUrl || "").replace(/\/+$/, ""),
        streamKey: d.streamKey,
        enabled: !!d.enabled,
        createdAt: d.createdAt || ev.meta.createdAt || new Date().toISOString(),
      }
      const body = fanoutAddBody(slug, dest, { relayEnabled, fallback })
      console.log(`    - ${dest.platform}/${dest.name} → ${body.name}${dest.enabled ? "" : " (disabled)"}`)
      if (!DRY_RUN) {
        await api(`/v3/config/paths/add/${encodeURIComponent(body.name)}`, {
          method: "POST",
          body: JSON.stringify(body),
        })
        createdPaths++
      }
    }

    // Strip destinations from the ingest meta (keep the no-op runOnReady).
    if (!DRY_RUN) {
      const { destinations: _drop, ...rest } = ev.meta
      await api(`/v3/config/paths/patch/${encodeURIComponent(ev.name)}`, {
        method: "PATCH",
        body: JSON.stringify({ runOnReady: buildRunOnReady(rest), runOnReadyRestart: false, runOnNotReady: "" }),
      })
    }
    migrated++
  }

  console.log(
    `\nXong. ${migrated} sự kiện migrate, ${createdPaths} fan-out path tạo, ${skipped} bỏ qua.${
      DRY_RUN ? " (DRY RUN — chưa ghi gì)" : ""
    }`,
  )
}

main().catch((e) => {
  console.error(`✗ Migration thất bại: ${e?.message || e}`)
  process.exit(1)
})
