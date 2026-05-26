## Why

MediaMTX server supports running FFmpeg/GStreamer commands via hooks (`runOnReady`, `runOnInit`, `runOnDemand`), enabling stream processing like snapshot capture and re-encoding. The dashboard currently has placeholder UI for snapshots (config + gallery shell) but lacks complete backend integration (file serving, listing, deletion) and has no re-encoding support at all. Users managing live streams need both capabilities for monitoring and content distribution.

## What Changes

### Snapshots (Section 16 — complete existing partial implementation)
- Add Next.js API routes for snapshot file operations: list, serve, delete, and latest thumbnail
- Wire delete button in `SnapshotGallery` to real API calls
- Add thumbnail display in path list rows (lazy-loaded latest snapshot)
- Add GStreamer engine support alongside existing FFmpeg in `SnapshotConfig`
- Add automatic refresh/polling in gallery to show new snapshots

### Re-Encoding (Section 17 — new feature)
- Create new `ReEncodingConfig` component (specialized, pattern from `ForwardingConfig`)
- Support 5 re-encoding templates, each with both FFmpeg and GStreamer commands:
  - H264 to H264 bitrate change
  - H265 to H264 for browser compatibility
  - Audio transcode to AAC/Opus
  - Scale resolution
  - Add low-bitrate substream
- Attach generated command to `runOnReady` hook (with restart toggle)
- Display CPU/resource warning when re-encoding is enabled
- Integrate into Path Edit dialog alongside Snapshot and Forwarding configs

## Capabilities

### New Capabilities
- `snapshot-api`: Backend API routes for listing, serving, and deleting snapshot files on the MediaMTX server filesystem
- `snapshot-gallery`: Interactive gallery with real delete API, download, refresh, and latest thumbnail in path list
- `re-encoding`: UI for generating FFmpeg/GStreamer re-encode commands across 5 templates, attached to runOnReady hook

### Modified Capabilities
- `snapshot-preview`: Extend existing spec to add GStreamer engine option, thumbnail in path list, wired delete API, and gallery auto-refresh

## Impact

- **New files**:
  - `app/api/snapshots/list/route.ts` — list snapshot files by path
  - `app/api/snapshots/file/route.ts` — serve individual snapshot image
  - `app/api/snapshots/delete/route.ts` — delete snapshot file
  - `app/api/snapshots/latest/route.ts` — get latest snapshot thumbnail path
  - `components/re-encoding-config.tsx` — re-encoding UI component
- **Modified files**:
  - `components/snapshot-config.tsx` — add GStreamer engine tab
  - `components/snapshot-gallery.tsx` — wire delete API, add refresh
  - `app/page.tsx` — add thumbnail in path list, integrate ReEncodingConfig
  - `lib/mediamtx-api.ts` — add snapshot API client functions
  - `components/path-management/path-form.tsx` — integrate ReEncodingConfig
- **Dependencies**: None (FFmpeg/GStreamer run on server via MediaMTX hooks)
- **Config**: Snapshot files stored in configurable directory (default `./snapshots/%path/`)
