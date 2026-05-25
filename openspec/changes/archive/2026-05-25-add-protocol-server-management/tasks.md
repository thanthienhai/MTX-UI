## 1. Data and Helper Foundations

- [x] 1.1 Audit `openapi.yaml`, `mediamtx.yml`, and `lib/mediamtx-api.ts` for all protocol configuration fields required by RTSP/RTSPS, RTMP/RTMPS, HLS, WebRTC/WHEP/WHIP, SRT, RTP, and MPEG-TS.
- [x] 1.2 Extend MediaMTX TypeScript types only where needed for protocol global configuration fields, optional runtime metrics, and version-dependent values.
- [x] 1.3 Add protocol configuration metadata for field labels, supported enum values, sensitive TLS fields, and structured array fields.
- [x] 1.4 Add helper utilities that build field-scoped global configuration patch payloads and preserve unknown or unsupported fields.
- [x] 1.5 Extend URL helper utilities for RTSP/RTSPS, RTMP/RTMPS, HLS, WebRTC/WHEP/WHIP, SRT, RTP, and MPEG-TS examples.

## 2. Protocol Configuration UI

- [x] 2.1 Create a dedicated protocol server management component or dashboard section with protocol tabs for RTSP/RTSPS, RTMP/RTMPS, HLS, WebRTC/WHEP/WHIP, SRT, and RTP/MPEG-TS.
- [x] 2.2 Implement enable/disable and address controls for `rtsp`, `rtmp`, `hls`, `webrtc`, `srt`, and related protocol address fields.
- [x] 2.3 Implement RTSP/RTSPS controls for transports, encryption, auth methods, RTP/RTCP/SRTP/SRTCP addresses, multicast IP/ports, TLS key, and TLS cert.
- [x] 2.4 Implement RTMP/RTMPS controls for encryption, address fields, TLS key, and TLS cert.
- [x] 2.5 Implement HLS controls for address, HTTPS/TLS, always remux, variant, segment count, segment duration, part duration, CORS, and trusted proxies.
- [x] 2.6 Implement WebRTC controls for address, HTTPS/TLS, local UDP/TCP addresses, ICE servers/STUN/TURN, CORS, and trusted proxies.
- [x] 2.7 Implement SRT controls for address and path-level publish/read passphrase guidance.
- [x] 2.8 Implement RTP/MPEG-TS controls or guidance for `rtpSDP`, MPEG-TS publish/read workflows, and `rtspDemuxMpegts`.
- [x] 2.9 Add validation and changed-field preview before protocol configuration patches are submitted.

## 3. Runtime Resource Views

- [x] 3.1 Add reusable protocol runtime list/detail UI with stable loading, empty, error, and refresh states.
- [x] 3.2 Wire RTSP and RTSPS connections and sessions list/detail views to existing MediaMTX clients.
- [x] 3.3 Wire RTMP and RTMPS connection list/detail views to existing MediaMTX clients.
- [x] 3.4 Wire HLS muxer list/detail views to existing MediaMTX clients.
- [x] 3.5 Wire WebRTC session list/detail views to existing MediaMTX clients.
- [x] 3.6 Wire SRT connection list/detail views to existing MediaMTX clients.
- [x] 3.7 Display SRT RTT, packet loss, retransmit, send rate, and receive rate metrics when present and hide absent metrics safely.

## 4. Runtime Actions, Permissions, and Audit

- [x] 4.1 Add confirmation flows for RTSP session, RTMP/RTMPS connection, WebRTC session, and SRT connection kick actions.
- [x] 4.2 Gate protocol configuration edits and kick actions by `api` permission, including direct handler guards.
- [x] 4.3 Gate protocol read helper/player actions by `read` permission and publish helper actions by `publish` permission.
- [x] 4.4 Add non-blocking success and error notifications for protocol configuration saves and kick actions.
- [x] 4.5 Add audit entries for protocol configuration saves and kick actions, masking sensitive TLS key/cert material in payload summaries.

## 5. Player and URL Guidance

- [x] 5.1 Add HLS live player entry points that use configured HLS service URLs and selected paths.
- [x] 5.2 Add WebRTC low-latency player entry point or generated WebRTC read URL guidance based on configured service settings.
- [x] 5.3 Show browser publish/read URLs for HLS, WebRTC, WHEP, and WHIP workflows.
- [x] 5.4 Show sample RTSP/RTSPS, RTMP/RTMPS, SRT, RTP, and MPEG-TS publish/read URLs using current config or documented defaults.
- [x] 5.5 Ensure helper URLs fall back to explicit placeholders instead of malformed strings when config is unavailable.

## 6. Verification

- [x] 6.1 Add or update script tests for protocol URL helper generation and fallback behavior.
- [x] 6.2 Add or update script tests for protocol patch payload construction, enum validation, unknown-field preservation, and sensitive audit summaries.
- [x] 6.3 Add or update script tests for protocol runtime client coverage and kick action wiring.
- [x] 6.4 Run `npm test` and fix failures.
- [x] 6.5 Run `npm run build` and fix failures.
- [x] 6.6 Update `todo.md` section 4 checklist items after implementation and verification are complete.
