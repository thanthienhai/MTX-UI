## Context

The MediaMTX Dashboard is a Next.js 15 web application (no Electron) that manages a MediaMTX streaming server through its REST API. The server supports running FFmpeg/GStreamer commands via path-level hooks (`runOnReady`, `runOnInit`, `runOnDemand`).

**Current state:**
- Snapshot config UI exists (`snapshot-config.tsx`) — generates `runOnReady` FFmpeg command with interval/output path
- Snapshot gallery UI exists (`snapshot-gallery.tsx`) — shows placeholder gallery, delete is stubbed
- No API routes exist to list/serve/delete snapshot files
- No re-encoding feature exists
- The dashboard has no direct filesystem access (browser-only) — all file operations go through Next.js API routes acting as proxies
- Pattern exists: `ForwardingConfig` for stream forwarding, `OnDemandConfig` for on-demand publishing, `HookCommandEditor` for generic hook commands

**Key constraints:**
- Snapshots are written to the MediaMTX server filesystem by FFmpeg/GStreamer
- The browser cannot read the server filesystem directly
- All snapshot file operations require server-side API routes
- Re-encoding is CPU-intensive and runs on the MediaMTX server

## Goals / Non-Goals

**Goals:**
- Complete snapshot feature with real file serving, listing, deletion, and thumbnails
- Build re-encoding command builder with 5 templates supporting both FFmpeg and GStreamer
- Integrate both features into existing Path Edit dialog and path list
- Match existing patterns (ForwardingConfig, OnDemandConfig) for consistency
- Use server-side API routes for all filesystem operations

**Non-Goals:**
- Not building a job queue or process manager (MediaMTX handles process lifecycle via hooks)
- Not implementing snapshot retention/cleanup policies (user-managed via delete)
- Not adding real-time snapshot streaming (periodic capture only)
- Not building a separate re-encoding engine UI outside path config

## Decisions

### Decision 1: Next.js API routes for snapshot file operations
- **Choice**: Build `/api/snapshots/*` route handlers that read from a configurable base directory (default `./snapshots/`)
- **Alternatives considered**:
  - *MediaMTX webroot serving*: Less control, no deletion endpoint, deployment-specific
  - *Direct filesystem access from browser*: Not possible in web-only app
- **Rationale**: API routes give full control over file listing, authentication-gated access, and clean delete semantics. The base directory is configurable (matching MediaMTX's `recordPath` pattern).

### Decision 2: Snapshot file format — JPEG only
- **Choice**: Generate JPEG snapshots with configurable quality (`-q:v`)
- **Rationale**: JPEG is smallest, fastest, and sufficient for monitoring. User confirmed "Chỉ JPEG (nhẹ)"

### Decision 3: Re-Encoding uses specialized component (not raw HookCommandEditor)
- **Choice**: Create `ReEncodingConfig` component following `ForwardingConfig` pattern
- **Rationale**: Each template has unique fields (bitrate, resolution, codec), which specialized components handle better than generic HookCommandEditor templates

### Decision 4: Both FFmpeg and GStreamer per template
- **Choice**: Each re-encoding template has two tabs — FFmpeg view / GStreamer view
- **Rationale**: User confirmed both engines. Some deployments prefer GStreamer. Each tab shows the engine-specific command syntax.

### Decision 5: runOnReady as default hook for re-encoding
- **Choice**: Generated commands set `runOnReady` + `runOnReadyRestart`
- **Rationale**: Re-encoding runs continuously after stream is ready. `runOnReadyRestart` ensures it recovers from failures. User confirmed.

### Decision 6: Thumbnail fetched in path list row
- **Choice**: Each path row calls `/api/snapshots/latest?path=xxx` and shows a small lazy-loaded thumbnail
- **Rationale**: User wants thumbnail visible without expanding. Lazy loading prevents blocking on image load. API route caches last-modified timestamp.

## Risks / Trade-offs

| Risk | Mitigation |
|---|---|
| **Snapshot base directory not writable** | API route validates and returns descriptive error. Warning banner in UI. |
| **High CPU from re-encoding on underpowered servers** | CPU warning displayed every time re-encoding is enabled. User must acknowledge. |
| **Many paths with snapshot thumbnails cause N+1 requests** | Latest thumbnail API is lightweight (file stat only). Consider batching if performance issues arise. |
| **FFmpeg not installed on MediaMTX server** | Snapshot config already shows warning. Re-encoding config will show similar warning. |
| **Large snapshot files filling disk** | User manually manages via delete. Could add retention config in future. |
| **GStreamer pipeline syntax differs significantly from FFmpeg** | Templates maintained separately per engine. User selects engine and sees appropriate command. |
