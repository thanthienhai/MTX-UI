## Why

The dashboard already has foundational pieces marked as started, but the remaining gaps from `todo.md` sections 0 through 2 prevent Vietnamese operators from configuring MediaMTX endpoints, logging in reliably, and understanding real server health from the overview. Completing this change turns the foundation, auth/session, and overview areas into usable, localized workflows before deeper protocol and configuration screens are built.

## What Changes

- Complete independent service base URL configuration for Control API, HLS, playback, metrics, and pprof.
- Ensure the MediaMTX Control API client exposes the remaining foundational endpoints for global config, path defaults, path configs, runtime paths, HLS muxers, protocol connections/sessions, recordings, and JWT JWKS refresh.
- Extend login and session behavior with Basic Auth, bearer/JWT token mode, API permission validation, logout, session expiry, and clearer MediaMTX connection/credential errors.
- Make UI permission handling visible and enforceable for `api`, `metrics`, `pprof`, `publish`, `read`, and `playback`.
- Complete the overview dashboard with real service status, stream totals, protocol reader/resource counts, byte and bitrate metrics, health cards, sync warnings, and permission-aware quick actions.
- Localize the affected dashboard interface text, labels, states, actions, and error messages into Vietnamese for Vietnamese users and operators.
- No breaking changes are expected.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `mediamtx-service-endpoints`: Complete service URL configuration for Control API, HLS, playback, metrics, and pprof, including Vietnamese-facing configuration labels and validation feedback.
- `mediamtx-control-api-client`: Complete typed Control API coverage for the foundational endpoints listed in `todo.md` section 0.
- `dashboard-auth-session`: Complete login modes, API permission validation, logout, expiry, session abstraction, permission display, and permission-aware UI behavior with Vietnamese interface copy.
- `dashboard-overview`: Complete real server status, stream summary, traffic/bitrate, health cards, sync warnings, and quick actions with Vietnamese interface copy.
- `dashboard-admin-experience`: Ensure affected loading, empty, error, notification, audit, refresh, and permission guard experiences remain non-blocking and localized.

## Impact

- Affected code includes `lib/mediamtx-api.ts`, `lib/mediamtx-url.mjs`, `lib/auth.ts`, `lib/mediamtx-permissions.ts`, `lib/dashboard-overview.mjs`, the Next.js MediaMTX proxy route, login and dashboard pages, overview components, notification/state components, and related tests under `scripts/`.
- The change uses the existing MediaMTX OpenAPI contract in `openapi.yaml` and existing dashboard patterns; no new backend service is introduced.
- The UI language for the affected areas becomes Vietnamese, including form labels, buttons, permission names, status text, empty/error states, and operator-facing notifications.
