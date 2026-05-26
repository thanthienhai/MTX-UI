## Why

MediaMTX's playback server allows downloading and viewing recorded streams, but the dashboard currently lacks a dedicated UI for browsing, playing, and downloading recordings. Users must manually construct playback URLs or access the recordings through raw API calls. Adding a Playback feature completes the recording workflow: configure recording → monitor status → browse and play recordings.

## What Changes

- Add playback configuration fields to GlobalConf type in the API client
- Create Next.js API proxy routes (`/api/playback/list` and `/api/playback/get`) that proxy to the MediaMTX Playback Server
- Create a Playback API client module (`lib/playback-api.ts`) with typed functions
- Add a `PlaybackView` component with two sections:
  - **PlaybackSettings**: Enable/disable playback, configure `playbackAddress`, HTTPS/TLS, CORS/trusted proxies
  - **PlaybackBrowser**: Path selector, date range picker, timeline of recorded segments, HTML5 video player, download fMP4/MP4, copy playback URL
- Integrate `PlaybackView` into the existing "Ghi hình" (Recording) tab in the dashboard
- Add audit events for playback settings changes

## Capabilities

### New Capabilities
- `playback-configuration`: UI for configuring the MediaMTX playback server settings (enable/disable, address, encryption, CORS, trusted proxies)
- `playback-recording-viewer`: UI for browsing recorded segments by path and date range, playing recordings via HTML5 video, downloading in fMP4/MP4 formats, and copying playback URLs

### Modified Capabilities
<!-- No existing specs are modified - this is entirely new functionality -->

## Impact

- **`lib/mediamtx-api.ts`**: Add playback fields to `GlobalConf` interface
- **`lib/playback-api.ts`**: New file - Playback API client functions
- **`app/api/playback/list/route.ts`**: New Next.js API route for listing recordings
- **`app/api/playback/get/route.ts`**: New Next.js API route for serving recording segments
- **`components/playback-view.tsx`**: New React component (PlaybackSettings + PlaybackBrowser)
- **`app/page.tsx`**: Import and render PlaybackView in the recording tab
- No new external dependencies required
- MediaMTX Playback Server must be enabled (`playback: yes` in mediamtx.yml)
