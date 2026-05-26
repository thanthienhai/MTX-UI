## 1. Backend — Playback Config Type & API Client

- [x] 1.1 Add playback fields to `GlobalConf` interface in `lib/mediamtx-api.ts`: `playback`, `playbackAddress`, `playbackEncryption`, `playbackServerKey`, `playbackServerCert`, `playbackAllowOrigin`, `playbackTrustedProxies`
- [x] 1.2 Create `lib/playback-api.ts` with: `PlaybackSegment`, `PlaybackListParams`, `PlaybackGetParams` types
- [x] 1.3 Add `listRecordings(params)` function in `lib/playback-api.ts` — fetches `/api/playback/list`
- [x] 1.4 Add `buildPlaybackSegmentUrl(params)` function in `lib/playback-api.ts` — builds URL for `/api/playback/get`

## 2. Backend — Next.js API Proxy Routes

- [x] 2.1 Create `app/api/playback/list/route.ts` — `GET` handler that proxies to Playback Server `/{path}`, filters by start/end, returns JSON segments
- [x] 2.2 Create `app/api/playback/get/route.ts` — `GET` handler that proxies to Playback Server `/{path}/{start}?format={format}`, streams binary response

## 3. Frontend — PlaybackView Component (PlaybackSettings)

- [x] 3.1 Create `components/playback-view.tsx` with `PlaybackView` wrapper component structure
- [x] 3.2 Implement `PlaybackSettings` section: fetch current global config to extract playback fields
- [x] 3.3 Add toggle switch for `playback` enable/disable with permission check
- [x] 3.4 Add input field for `playbackAddress` configuration
- [x] 3.5 Add toggle for `playbackEncryption` HTTPS/TLS
- [x] 3.6 Add input for `playbackAllowOrigin` CORS
- [x] 3.7 Add tags input for `playbackTrustedProxies` (add/remove IPs/CIDRs)
- [x] 3.8 Implement preview/save pattern: diff calculation, preview card, PATCH via `api.patchGlobalConfig()`
- [x] 3.9 Add audit event tracking for playback settings changes
- [x] 3.10 Add error/loading states and notifications for settings operations

## 4. Frontend — PlaybackView Component (PlaybackBrowser)

- [x] 4.1 Implement path selector dropdown — load paths with `record: true` from `api.getPathConfigs()`
- [x] 4.2 Implement date range picker with start/end date inputs
- [x] 4.3 Implement timeline visualization: horizontal bars for each segment, proportional sizing, time axis labels
- [x] 4.4 Add segment selection: click timeline bar to select a segment for playback
- [x] 4.5 Implement video player section: HTML5 `<video>` with controls, loading overlay, error state
- [x] 4.6 Add "Download fMP4" button linking to `/api/playback/get?format=fmp4`
- [x] 4.7 Add "Download MP4" button linking to `/api/playback/get?format=mp4`
- [x] 4.8 Add "Copy playback URL" button using `navigator.clipboard.writeText()` with success notification
- [x] 4.9 Add empty state when no segments found, error state with retry, loading state

## 5. Integration

- [x] 5.1 Import `PlaybackView` in `app/page.tsx`
- [x] 5.2 Add `<PlaybackView>` component inside the `TabsContent value="recording"` section, below existing components
- [x] 5.3 Pass required props: `permissions`, `username`, `appendAuditEvent`, `pollingRefresh`
- [x] 5.4 Verify LSP diagnostics clean on all changed files
- [x] 5.5 Run build (`next build`) to confirm no compilation errors
