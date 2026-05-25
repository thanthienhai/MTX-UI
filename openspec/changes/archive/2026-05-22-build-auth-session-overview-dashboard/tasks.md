## 1. Auth Session Foundation

- [x] 1.1 Replace bare auth token helpers with a versioned dashboard session model that records credential mode, username when available, issued time, expiry time, and effective permissions.
- [x] 1.2 Add a session persistence adapter so UI code no longer reads or writes raw credential values directly through `sessionStorage`.
- [x] 1.3 Add auth header generation for Basic Auth and bearer token/JWT sessions through the shared auth utility.
- [x] 1.4 Add session expiry checks that clear expired sessions before protected routes or MediaMTX requests proceed.

## 2. Login and Logout Flow

- [x] 2.1 Update the login screen to let users choose Basic Auth username/password or token/JWT credential mode.
- [x] 2.2 Validate submitted credentials by probing MediaMTX Control API access through the existing dashboard proxy.
- [x] 2.3 Classify login failures into connection failure, invalid credentials, missing `api` permission, and unexpected server failure messages.
- [x] 2.4 Store the structured session only after validation succeeds and route the user to the protected dashboard.
- [x] 2.5 Update logout to clear the structured session, reset permission state, and route the user to login.

## 3. Permissions and RBAC

- [x] 3.1 Resolve effective permissions for `api`, `metrics`, `pprof`, `publish`, `read`, and `playback` during login/session hydration.
- [x] 3.2 Display the current user's permission state in the dashboard.
- [x] 3.3 Apply permission guards to metrics, pprof, playback, path/config administration, publish, and read-related controls.
- [x] 3.4 Re-check required permission inside protected action handlers before making MediaMTX calls.
- [x] 3.5 Show disabled or hidden states for unavailable controls without breaking the surrounding dashboard layout.

## 4. Overview Data Model

- [x] 4.1 Add an overview aggregation utility or hook that loads global config, path configs, runtime paths, muxers, protocol resources, metrics status, and service URLs.
- [x] 4.2 Derive enabled, disabled, or unknown status for API, metrics, pprof, playback, RTSP, RTMP, HLS, WebRTC, and SRT.
- [x] 4.3 Derive configured path count, ready/live path count, and reader or resource counts grouped by protocol.
- [x] 4.4 Derive total inbound bytes and outbound bytes from runtime path and protocol data.
- [x] 4.5 Add bitrate calculation from successive byte samples, including first-sample and counter-reset handling.

## 5. Overview UI and Health Cards

- [x] 5.1 Render overview service status cards using the real overview data model.
- [x] 5.2 Render stream summary cards for configured paths, live paths, readers by protocol, total bytes, and calculated bitrate.
- [x] 5.3 Add health cards for API latency, metrics scrape status, last config update, and dashboard/backend config sync warning state.
- [x] 5.4 Add loading, empty, and non-blocking error states for overview regions.
- [x] 5.5 Ensure overview refresh does not block unrelated cards when one service probe fails.

## 6. Quick Actions

- [x] 6.1 Add an overview quick action that opens or navigates to the add path workflow when `api` permission is available.
- [x] 6.2 Add a playback quick action that opens the selected or default playback URL when `playback` permission is available.
- [x] 6.3 Add a metrics quick action that opens the configured metrics endpoint only when metrics is enabled and `metrics` permission is available.
- [x] 6.4 Add a refresh or restart data quick action that reloads overview data, updates health cards, and recalculates bitrate.

## 7. Verification

- [x] 7.1 Add unit tests for session parsing, session expiry, logout clearing, and auth header generation.
- [x] 7.2 Add tests for login validation error classification and missing `api` permission handling.
- [x] 7.3 Add tests for permission guard behavior and stale handler permission checks.
- [x] 7.4 Add tests for overview aggregation, service status mapping, byte totals, bitrate deltas, and counter reset handling.
- [x] 7.5 Run type checking and fix TypeScript errors introduced by auth/session and overview changes.
- [x] 7.6 Run linting and relevant dashboard tests.
