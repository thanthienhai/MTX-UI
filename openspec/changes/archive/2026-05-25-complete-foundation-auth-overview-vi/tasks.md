## 1. Foundation Helpers and API Coverage

- [x] 1.1 Audit `lib/mediamtx-api.ts` against `openapi.yaml` and add any missing typed methods for global config, path defaults, path configs, runtime paths, HLS muxers, protocol resources, recordings, and JWKS refresh.
- [x] 1.2 Ensure all foundational client methods use the unified API error wrapper with operation context and user-safe messages.
- [x] 1.3 Complete service URL helper support for independent Control API, HLS, playback, metrics, and pprof base URLs, including normalization of trailing slashes and Control API suffixes.
- [x] 1.4 Keep the Next.js Control API proxy upstream configuration separate from browser-visible service URLs and preserve forwarded methods, headers, query strings, and request bodies.
- [x] 1.5 Add or update script tests that verify foundational API client coverage, URL normalization, and proxy upstream separation.

## 2. Vietnamese Endpoint and Common Dashboard UI

- [x] 2.1 Add Vietnamese labels, helper text, validation feedback, save/reset actions, and status copy for endpoint settings covering Control API, HLS, playback, metrics, and pprof.
- [x] 2.2 Localize affected module loading, empty, error, retry, refresh, polling, notification, audit, and permission guard messages into Vietnamese.
- [x] 2.3 Replace any remaining blocking `alert()` feedback in affected workflows with localized non-blocking notifications.
- [x] 2.4 Verify technical identifiers such as protocol names, endpoint paths, config keys, and permission action keys remain readable and unchanged where needed.

## 3. Auth, Session, and Permissions

- [x] 3.1 Complete Basic Auth and bearer/JWT login flows with Vietnamese form labels, mode controls, validation, and submit feedback.
- [x] 3.2 Validate `api` permission during login and show distinct Vietnamese errors for unreachable MediaMTX, invalid credentials, missing API permission, and unexpected server failures.
- [x] 3.3 Implement logout and automatic session expiry through the session abstraction, ensuring protected routes clear expired sessions before protected requests.
- [x] 3.4 Ensure API request authorization headers are derived from the active session mode without UI components reading raw browser storage directly.
- [x] 3.5 Display effective `api`, `metrics`, `pprof`, `publish`, `read`, and `playback` permissions in Vietnamese and enforce permission-aware hidden/disabled controls plus handler-level guards.
- [x] 3.6 Add or update auth/session tests for login modes, permission probing, error classification, logout, expiry, storage abstraction, and permission guards.

## 4. Overview Data and Health

- [x] 4.1 Load overview service status from global configuration, service endpoint settings, permissions, and available runtime data for API, metrics, pprof, playback, RTSP, RTMP, HLS, WebRTC, and SRT.
- [x] 4.2 Load configured path count, ready/live path count, protocol reader/resource counts, inbound/outbound byte totals, and partial unavailable states without failing the full overview.
- [x] 4.3 Calculate inbound and outbound bitrate from byte deltas, elapsed time, first-sample handling, and counter reset detection.
- [x] 4.4 Render Vietnamese overview cards for service status, stream summary, protocol counts, traffic totals, API latency, metrics scrape status, last config update, and config sync warnings.
- [x] 4.5 Implement endpoint-aware and permission-aware quick actions for add path, open playback, open metrics, and refresh/restart overview data.
- [x] 4.6 Add or update overview tests for partial failures, protocol aggregation, bitrate calculation, endpoint-aware quick actions, and Vietnamese state labels.

## 5. Verification

- [x] 5.1 Run the existing project test suite with `npm test`.
- [x] 5.2 Run `npm run lint` if available and address issues in touched files.
- [ ] 5.3 Manually verify login, logout, expired session routing, overview refresh, endpoint settings, disabled permission actions, and MediaMTX-unreachable states in the browser.
- [ ] 5.4 Update `todo.md` checkboxes for sections 0 through 2 only after implementation and verification are complete.
