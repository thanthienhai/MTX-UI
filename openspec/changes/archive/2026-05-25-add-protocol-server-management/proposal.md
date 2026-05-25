## Why

Operators need a complete Vietnamese workflow for configuring and operating MediaMTX protocol servers from the dashboard instead of switching between raw API calls, `mediamtx.yml`, and external documentation. This change covers the remaining `todo.md` section 4 protocol server checklist and builds on the existing Control API client support for protocol runtime resources.

## What Changes

- Add a protocol server management UI covering RTSP/RTSPS, RTMP/RTMPS, HLS, WebRTC/WHEP/WHIP, SRT, and RTP/MPEG-TS.
- Support editing protocol global configuration through `GET /v3/config/global/get` and `PATCH /v3/config/global/patch`, including enable flags, addresses, encryption modes, TLS key/cert fields, transports, auth methods, multicast and RTP/RTCP/SRTP/SRTCP address settings, HLS remux/variant/segment settings, WebRTC ICE/local address settings, trusted proxies/CORS, and `rtspDemuxMpegts`.
- Show protocol runtime lists and detail views for RTSP connections, RTSP sessions, RTMP connections, HLS muxers, WebRTC sessions, and SRT connections using existing typed Control API clients.
- Provide safe kick actions for RTSP sessions, RTMP/RTMPS connections, WebRTC sessions, and SRT connections where the MediaMTX API supports kicking.
- Add HLS and WebRTC live player entry points, browser publish/read URL helpers, RTSP/RTMP/SRT/RTP/MPEG-TS sample URL guidance, and documentation-style stream URLs derived from current configuration.
- Surface SRT connection metrics such as RTT, packet loss, retransmits, and send/receive rates when present in MediaMTX runtime responses.
- Preserve existing Vietnamese UI, permission guards, loading/empty/error states, non-blocking notifications, and audit logging patterns.
- No breaking changes are expected.

## Capabilities

### New Capabilities
- `protocol-server-management`: Configure and operate MediaMTX protocol servers, runtime resources, kick actions, players, URL helpers, and protocol metrics from the dashboard.

### Modified Capabilities
- `dashboard-admin-experience`: Extend administrative UX requirements to protocol configuration saves and protocol runtime kick actions.
- `mediamtx-service-endpoints`: Extend browser-visible URL behavior to HLS, WebRTC, RTSP/RTSPS, RTMP/RTMPS, SRT, RTP, and MPEG-TS protocol helper URLs.

## Impact

- Affected code includes `app/page.tsx`, `components/global-config-view.tsx`, `components/stream-player.tsx`, `lib/mediamtx-api.ts`, `lib/mediamtx-url.mjs`, shared notification/audit/permission helpers, and related tests or verification scripts.
- Uses existing MediaMTX Control API proxy routes and does not introduce a new backend service.
- Implementation must account for version-dependent MediaMTX fields by rendering supported fields defensively and preserving unknown configuration values.
- `todo.md` section 4 should be updated only after implementation and verification are complete.
