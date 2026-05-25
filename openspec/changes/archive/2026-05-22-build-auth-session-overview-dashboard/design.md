## Context

The application is a Next.js MediaMTX dashboard with an existing login page, protected route wrapper, `lib/auth.ts` session helpers, a typed MediaMTX API client, permission utilities, polling hooks, notification UI, and a large dashboard page that already reads path, protocol, metrics, pprof, and playback-related data. Current login behavior is Basic Auth oriented and stores credentials directly in `sessionStorage`; dashboard permissions can be toggled in the UI but are not derived from a validated login/session model. The overview already shows some runtime data, but it needs to become a first-class live server overview with explicit service status, health, bitrate, sync, and quick-action behavior.

## Goals / Non-Goals

**Goals:**

- Support Basic Auth and bearer token/JWT credential modes from the login screen and shared auth utilities.
- Validate API access after login by making a real MediaMTX Control API request and surfacing connection, authentication, and authorization failures clearly.
- Represent dashboard sessions with expiry metadata, logout behavior, and a production-ready abstraction that can move credentials out of raw browser storage.
- Derive and display the current user's effective MediaMTX permissions, then use them to hide or disable restricted UI actions.
- Build an overview model from real Control API, runtime path, protocol, metrics, and service URL data.
- Calculate bitrate from byte deltas across refresh samples without resetting cumulative byte counters.
- Show health cards for API latency, metrics scrape status, last config update, and dashboard/backend config sync warnings.
- Provide quick actions for add path, playback, metrics, and refresh/restart data that respect permissions and service availability.

**Non-Goals:**

- Replacing MediaMTX server-side authentication or authorization.
- Implementing a full identity provider or JWT issuer inside the dashboard.
- Persisting long-lived secrets in a new database or secret manager as part of this change.
- Reworking the entire dashboard visual system beyond the auth/session and overview screens.
- Adding MediaMTX server endpoints that are not available through existing Control API, metrics, or configured service URLs.

## Decisions

1. Keep the browser-facing Control API path proxied through the existing Next.js route.

   The login validator and dashboard data loaders will continue to use the existing `/api/mediamtx` proxy by default so CORS, server base URL normalization, and allowed header forwarding stay centralized. Direct service links such as playback, metrics, and pprof can still use their configured public base URLs. An alternative was to call the MediaMTX Control API directly from the browser, but that would duplicate CORS and credential handling in each deployment.

2. Introduce a session object instead of storing a bare auth token.

   `lib/auth.ts` should manage a versioned session record containing credential mode, username when applicable, token reference or credential value, issued time, expiry time, and effective permissions. For the immediate implementation, browser storage can remain the fallback for local development, but it should be behind an adapter so production deployments can switch to httpOnly cookie-backed sessions or another server-managed mechanism without changing UI components. An alternative was to keep `sessionStorage` helpers and add fields beside them, but that spreads credential policy across the app.

3. Validate login by probing API access, not by trusting local form state.

   After the user submits Basic Auth or bearer/JWT credentials, the dashboard will call a low-risk Control API endpoint such as global config get or path list through the shared client and classify failures as connection, invalid credentials, missing `api` permission, or unexpected server response. This keeps the login screen honest and allows clear messages before entering the dashboard. An alternative was to only store credentials and let the dashboard fail later, but that delays the error and makes RBAC unreliable.

4. Model effective permissions separately from UI preferences.

   Permissions should come from the authenticated session when known and map to MediaMTX action names already used by `lib/mediamtx-permissions.ts`: `api`, `metrics`, `pprof`, `publish`, `read`, and `playback`. UI controls may still render disabled with an explanatory state, but action handlers must re-check permissions before invoking protected operations. An alternative was only hiding controls, but handler checks prevent stale UI state from executing restricted work.

5. Build a dashboard overview view model from existing typed client calls.

   The overview should aggregate global config, path configs, runtime paths, HLS muxers, protocol resources, metrics status, and service URLs into a single derived object for rendering. This keeps UI components simple and makes the calculations testable. An alternative was to calculate each card inline inside `app/page.tsx`, but that would make refresh deltas, warnings, and health state harder to test.

6. Calculate bitrate from successive byte samples.

   The overview will keep the previous total inbound/outbound byte sample and timestamp, then compute bits per second from positive byte deltas divided by elapsed seconds. First sample, counter resets, missing data, or non-positive elapsed time must show an unavailable or zero-rate state rather than misleading negative values. An alternative was to display total bytes only, but the requirement explicitly asks for bitrate from byte delta.

7. Treat metrics and service health as best-effort diagnostics.

   Metrics scrape status can be determined by fetching the configured metrics endpoint when permitted, recording success/failure and latency. pprof and playback should show configured and permission-gated availability; they do not need deep endpoint probing unless existing helpers make that cheap and reliable. An alternative was to hard-fail the whole overview when metrics is unavailable, but MediaMTX can operate without metrics enabled.

## Risks / Trade-offs

- Browser fallback storage can still expose credentials in development -> Isolate storage behind an adapter, document the production cookie/session path, and avoid direct `sessionStorage` calls outside auth utilities.
- MediaMTX deployments may not expose permission introspection uniformly -> Derive known permissions from validated auth/config data where available and default conservatively for unknown restricted actions.
- Metrics endpoint probing can fail because of network topology even when Control API works -> Report metrics scrape status independently from API health and avoid blocking the rest of the overview.
- Byte counters may reset when MediaMTX restarts or paths are recreated -> Clamp negative deltas and show the next valid sample after reset.
- A single dashboard page can grow further in complexity -> Move auth/session, overview aggregation, and bitrate calculations into reusable utilities or hooks with unit tests.

## Migration Plan

1. Add the session model, credential mode helpers, expiry handling, and storage adapter while keeping existing Basic Auth behavior compatible.
2. Update login to support Basic and token/JWT modes, validate API access, persist the structured session, and render clear failure states.
3. Update protected routing and API calls to respect session expiry, logout, auth header generation, and effective permissions.
4. Add overview aggregation utilities for service status, stream counts, byte totals, bitrate deltas, health cards, and sync warnings.
5. Wire overview cards and quick actions into the dashboard using existing UI primitives, notification behavior, permission guards, and refresh/polling hooks.
6. Add focused tests for auth/session parsing, expiry, auth header generation, permission gates, bitrate calculations, health state mapping, and quick-action disabled states.

Rollback can restore the previous login/session helpers and overview rendering because the MediaMTX proxy route and typed client endpoints remain compatible.

## Open Questions

- The exact source of authoritative user permissions may depend on the deployed MediaMTX auth mode; implementation should keep the permission resolver replaceable.
- Production credential storage may require an additional server route for httpOnly cookie sessions if the deployment should avoid exposing bearer credentials to browser JavaScript entirely.
- Metrics content parsing requirements are not yet defined; initial health can use scrape success, latency, and optional byte counters if available.
