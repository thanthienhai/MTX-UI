## Why

The dashboard currently needs broader MediaMTX management coverage and safer operational UX to administer a production server without hand-written API calls or browser alerts. This change establishes complete typed access to the MediaMTX Control API and the dashboard behavior needed to operate configuration, runtime resources, permissions, polling, and related service endpoints consistently.

## What Changes

- Add a complete TypeScript API client for the MediaMTX Control API endpoints required by the dashboard.
- Normalize TypeScript request and response schemas from the MediaMTX OpenAPI contract.
- Add a unified API error wrapper for Control API failures, proxy failures, validation failures, and unexpected responses.
- Replace `alert()`-style feedback with toast or notification UI.
- Add loading, empty, and error states for each dashboard module that reads or mutates MediaMTX data.
- Add dashboard-side audit logging for administrative operations.
- Add permission guards mapped to MediaMTX actions: `api`, `metrics`, `pprof`, `publish`, `read`, and `playback`.
- Add configurable refresh and polling controls for runtime views.
- Add configurable base URLs for the Control API, HLS server, playback server, metrics server, and pprof server.

## Capabilities

### New Capabilities

- `mediamtx-control-api-client`: Complete typed client coverage for MediaMTX Control API configuration, runtime resources, sessions, connections, recordings, and JWKS refresh.
- `mediamtx-api-contracts`: TypeScript schema normalization and unified error behavior based on the MediaMTX OpenAPI contract.
- `dashboard-admin-experience`: Dashboard UX requirements for notifications, loading/empty/error states, audit logs, permissions, and refresh or polling behavior.
- `mediamtx-service-endpoints`: Configurable base URL behavior for Control API, HLS, playback, metrics, and pprof services.

### Modified Capabilities

- None.

## Impact

- Affected code includes `lib/mediamtx-api.ts`, `lib/mediamtx-url.mjs`, route proxy code under `app/api/mediamtx/[...path]/route.ts`, dashboard pages and components under `app/` and `components/`, and any shared auth or permission utilities.
- The implementation will depend on the existing `openapi.yaml` as the source of truth for schemas and endpoint shapes.
- Dashboard behavior will change from ad hoc calls and blocking alerts to typed client operations, structured error handling, notifications, audit records, permission-aware controls, and configurable polling.
