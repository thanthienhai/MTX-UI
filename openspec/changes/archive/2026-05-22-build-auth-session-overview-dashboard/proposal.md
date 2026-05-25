## Why

The dashboard needs to move beyond a basic login gate and static status presentation so operators can authenticate against real MediaMTX deployments, understand their effective permissions, and see live server health before taking administrative actions. This change adds production-oriented auth/session behavior and an overview dashboard backed by actual MediaMTX configuration, runtime, and service health data.

## What Changes

- Upgrade the current login flow to support Basic Auth username/password credentials and token/JWT credentials when the MediaMTX deployment uses JWT authentication.
- Validate API access after login and show clear MediaMTX connection or authorization failures.
- Add dashboard session management with logout, automatic expiration, and a safer production credential storage strategy than raw `sessionStorage`.
- Add UI RBAC behavior that exposes the current user permissions and hides or disables controls for unavailable permissions.
- Add an overview dashboard that reports real server capability status for API, metrics, pprof, playback, and RTSP, RTMP, HLS, WebRTC, and SRT protocols.
- Add stream summary data for configured paths, ready/live paths, readers by protocol, inbound/outbound bytes, and bitrate calculated from byte deltas.
- Add health cards for API latency, metrics scrape status, last configuration update, and configuration sync warnings.
- Add quick actions for adding a path, opening playback, opening metrics, and manually refreshing or restarting dashboard data.

## Capabilities

### New Capabilities

- `dashboard-auth-session`: Login, credential modes, API permission validation, session expiration, logout, safer credential handling, current-permission display, and UI RBAC behavior.
- `dashboard-overview`: Real MediaMTX service status, stream summary metrics, calculated bitrate, health cards, configuration sync warnings, and overview quick actions.

### Modified Capabilities

- None.

## Impact

- Affected code includes dashboard pages under `app/`, shared UI components under `components/`, MediaMTX API client and URL helpers under `lib/`, auth/session utilities, permission utilities, polling hooks, and route proxy behavior where credential forwarding or error normalization is required.
- The implementation depends on MediaMTX Control API access, runtime path data, global/path configuration data, metrics availability, and configured service base URLs for playback, metrics, and pprof.
- User-facing behavior changes include more explicit login failure states, session expiry handling, permission-aware controls, live overview cards, health warnings, and dashboard quick actions.
