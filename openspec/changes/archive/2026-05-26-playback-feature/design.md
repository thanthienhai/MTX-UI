## Context

The MediaMTX Dashboard currently supports recording configuration (RecordingSettingsView) and recording status monitoring (RecordingStatusView) within the "Ghi hình" tab. The MediaMTX Playback Server (default port :9996) serves recorded segments via HTTP, but the dashboard has no UI to browse, play, or download recordings.

The existing architecture uses:
- Next.js 15 App Router with client components (`"use client"`)
- shadcn/ui components (Card, Button, Switch, Input, Select, Dialog, Badge)
- A proxy pattern at `app/api/mediamtx/[...path]/route.ts` that forwards requests to the MediaMTX Control API
- URL building helpers in `lib/mediamtx-url.mjs`
- Permission system in `lib/mediamtx-permissions.ts` (playback action already exists)
- Vietnamese UI locale
- Audit events for admin actions

The Playback Server configuration is already defined in `mediamtx.yml` (lines 196-216) and the OpenAPI spec (`openapi.yaml` lines 152-167) but the GlobalConf TypeScript interface lacks these fields.

## Goals / Non-Goals

**Goals:**
- Add playback configuration fields to the GlobalConf TypeScript interface
- Create Next.js API proxy routes that forward to the MediaMTX Playback Server for listing and serving recording segments
- Build a Playback Settings UI to enable/disable and configure the playback server
- Build a Playback Browser UI to select paths, filter by date, browse segment timelines, play recordings, and download them
- Integrate into the existing "Ghi hình" tab as a new section
- Add audit event tracking for playback settings changes

**Non-Goals:**
- Modifying the MediaMTX Playback Server itself
- Adding authentication to the playback proxy (relies on existing dashboard auth)
- Real-time segment updates (manual refresh or polling only)
- Transcoding or format conversion (relies on Playback Server's native format support)
- Playback of live streams (already handled by StreamPlayer with HLS.js)
- WebRTC playback for recordings

## Decisions

### 1. Proxy Architecture: Next.js API Routes vs Direct Browser Fetch

**Decision**: Create Next.js API proxy routes (`/api/playback/list` and `/api/playback/get`).

**Rationale**: Consistent with the existing mediamtx proxy pattern. Provides a unified auth layer (dashboard session cookies/headers are automatically forwarded), avoids CORS complexities even though the playback server has `playbackAllowOrigin: '*'`, and allows server-side filtering/transformation of segment data before sending to the client.

**Alternatives considered**:
- *Direct browser fetch*: Simpler, but inconsistent with existing patterns and exposes the internal playback server address to the client.
- *Reuse mediamtx proxy*: The existing proxy targets the Control API (`:9997`), not the Playback Server (`:9996`), so a separate route is cleaner.

### 2. Playback Server Address Resolution

**Decision**: Read the playback server address from an environment variable (`MEDIAMTX_PLAYBACK_URL`) server-side, falling back to the default `http://localhost:9996`. The env config from the UI's "URL dịch vụ" settings is a client-side concern and won't affect the proxy route (which is server-side).

**Rationale**: The existing mediamtx proxy uses `MEDIAMTX_API_URL` env var. Following the same pattern keeps configuration predictable. The client-side playback URL config (in "URL dịch vụ") is used for direct browser links (e.g., copy playback URL), not for the proxy.

### 3. Video Playback: HTML5 Video Tag vs HLS.js

**Decision**: Use native HTML5 `<video>` tag for playback.

**Rationale**: Recordings are stored as fMP4 (Fragmented MP4) by default, which is natively supported by all modern browsers via the `<video>` element. Unlike live HLS streams (which require HLS.js), fMP4 files can be loaded directly. The `format=mp4` query parameter provides MP4 format for even broader compatibility.

**Alternatives considered**:
- *HLS.js*: Not needed for recorded fMP4/MP4 segments. HLS.js is already used in StreamPlayer for live HLS streams.
- *Media Source Extensions (MSE)*: Adds unnecessary complexity for simple file playback.

### 4. Timeline Visualization: Horizontal Bar Chart

**Decision**: Render a simple horizontal bar chart using CSS/HTML (no chart library dependency).

**Rationale**: The timeline shows time ranges of recorded segments on a continuous axis. This can be implemented with positioned `<div>` elements and CSS, avoiding extra dependencies. Each segment is a colored bar proportional to its duration, placed on a time axis. Clicking a bar loads that segment for playback.

**Alternatives considered**:
- *Chart.js / recharts*: Overkill for a simple timeline. The project currently has no chart dependency.
- *Canvas/SVG*: More flexible but harder to maintain. CSS bars are sufficient.

### 5. Component Structure: Single vs Split Components

**Decision**: Create a single `PlaybackView` component that contains both `PlaybackSettings` and `PlaybackBrowser` as internal sections within a single file.

**Rationale**: Both sections are closely related (PlaybackBrowser depends on playback being enabled, which is configured in PlaybackSettings). They share state (playback server config, permission checks). This matches the pattern in the existing codebase where views are files (e.g., `recording-settings-view.tsx` is self-contained). If complexity grows, it can be split later.

## Risks / Trade-offs

- **[Performance] Loading many segments**: Long recording periods could produce thousands of segments. **Mitigation**: Implement date range filtering on the client side and consider server-side pagination if needed.
- **[Compatibility] `format=mp4` support**: The MediaMTX Playback Server's `format=mp4` parameter may require a specific version. **Mitigation**: Always offer fMP4 as the primary format; show MP4 as a fallback option.
- **[Security] Proxy auth bypass**: If the proxy doesn't validate auth, unauthenticated users could access recordings. **Mitigation**: The proxy route runs inside the Next.js app which already requires authentication via ProtectedRoute. The proxy itself should validate the session token before forwarding requests to the Playback Server.
- **[Data freshness] Recording list staleness**: The recordings list from `/v3/recordings/list` may not reflect in-progress recordings. **Mitigation**: Use polling refresh (same pattern as dashboard overview).
- **[Large files] Memory usage on download**: Large MP4 downloads could exhaust server memory. **Mitigation**: Stream the response directly from the Playback Server without buffering.
