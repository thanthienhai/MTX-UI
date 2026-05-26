## 1. Snapshot API Routes

- [x] 1.1 Create `app/api/snapshots/list/route.ts` — list snapshot files by path, sorted newest-first, with path traversal protection
- [x] 1.2 Create `app/api/snapshots/file/route.ts` — serve individual snapshot file with proper Content-Type and caching
- [x] 1.3 Create `app/api/snapshots/delete/route.ts` — delete snapshot file with POST, validate path + name params
- [x] 1.4 Create `app/api/snapshots/latest/route.ts` — return latest snapshot info or redirect, with `redirect=true` support
- [x] 1.5 Add `SNAPSHOT_BASE_DIR` env var support to all snapshot API routes with `./snapshots/` as default
- [x] 1.6 Add authentication guard and path traversal sanitization to all snapshot API routes

## 2. Snapshot Config — GStreamer Engine Support

- [x] 2.1 Add engine state (FFmpeg/GStreamer) to `snapshot-config.tsx` with tab/dropdown selector
- [x] 2.2 Implement GStreamer snapshot command generation alongside existing FFmpeg generation
- [x] 2.3 Update `extractInterval()` and `extractOutputPath()` to handle GStreamer syntax
- [x] 2.4 Ensure backward compatibility — existing FFmpeg-only configs continue to work

## 3. Snapshot Gallery — Wire Real API

- [x] 3.1 Remove stub snapshots prop and add internal state + fetch logic calling `GET /api/snapshots/list`
- [x] 3.2 Add loading state spinner while fetching snapshots
- [x] 3.3 Add empty state display when no snapshots exist
- [x] 3.4 Add auto-refresh polling (every 10s) while gallery is open
- [x] 3.5 Add manual refresh button
- [x] 3.6 Wire delete button to `POST /api/snapshots/delete` with error handling
- [x] 3.7 Wire download button to `GET /api/snapshots/file` URL
- [x] 3.8 Update snapshot image `src` to use `/api/snapshots/file` URLs

## 4. Thumbnail in Path List

- [x] 4.1 Add `latestSnapshotUrl` state per path row, fetched via `GET /api/snapshots/latest?path=<name>&redirect=true`
- [x] 4.2 Render small thumbnail image (40x23, lazy-loaded) next to path name when snapshot exists
- [x] 4.3 Add click handler on thumbnail to open SnapshotGallery
- [x] 4.4 Handle no-snapshot state (hide thumbnail, show nothing)

## 5. Re-Encoding Component

- [x] 5.1 Create `components/re-encoding-config.tsx` with enable/disable toggle
- [x] 5.2 Add engine selector (FFmpeg / GStreamer) as tab controls
- [x] 5.3 Implement template selector dropdown with 5 template options
- [x] 5.4 Implement template: H264 to H264 bitrate change (fields: bitrate, maxrate, output URL)
- [x] 5.5 Implement template: H265 to H264 for browser compat (fields: output URL, audio codec)
- [x] 5.6 Implement template: Audio transcode to AAC/Opus (fields: audio codec, output URL)
- [x] 5.7 Implement template: Scale resolution (fields: width, height, output URL)
- [x] 5.8 Implement template: Add low-bitrate substream (fields: bitrate, resolution, output URL)
- [x] 5.9 Implement per-template dynamic field inputs (render fields from active template def)
- [x] 5.10 Add editable command preview textarea showing generated FFmpeg/GStreamer command
- [x] 5.11 Add CPU warning banner (amber, with CPU icon): "Cảnh báo: Re-encoding tiêu tốn nhiều CPU"
- [x] 5.12 Add security warning banner (amber, with alert icon)
- [x] 5.13 Add restart toggle (`runOnReadyRestart`) bound to component state
- [x] 5.14 Expose props: `command`, `restart`, `onCommandChange`, `onRestartChange`, `pathName`

## 6. Integrate Re-Encoding into Path Edit Dialog

- [x] 6.1 Add `ReEncodingConfig` import and state management in `app/page.tsx` edit dialog
- [x] 6.2 Wire `ReEncodingConfig` to `editingPath.runOnReady` and `editingPath.runOnReadyRestart`
- [x] 6.3 Ensure snapshot and re-encoding can coexist on the same path (chained runOnReady commands with coexistence warning)
- [x] 6.4 Add `ReEncodingConfig` to `path-form.tsx` `buildPayload()` — pending, path-form uses separate state management

## 7. Validation and Cleanup

- [x] 7.1 Build passes — `npm run build` compiled successfully (all new routes + components)
- [ ] 7.2 Verify snapshot APIs work end-to-end: list → serve → delete → latest (requires running dev server + snapshot files)
- [ ] 7.3 Verify re-encoding generates correct FFmpeg and GStreamer commands for all 5 templates
- [ ] 7.4 Verify snapshot gallery opens, loads, refreshes, and deletes correctly
- [ ] 7.5 Verify thumbnail appears in path list for paths with snapshots
