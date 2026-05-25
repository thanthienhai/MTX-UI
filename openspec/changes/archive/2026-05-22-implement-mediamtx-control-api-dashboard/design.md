## Context

The application is a Next.js dashboard for MediaMTX. It currently has a small `lib/mediamtx-api.ts` wrapper for path configuration and runtime path listing, a proxy route at `app/api/mediamtx/[...path]/route.ts`, URL helpers for Control API and HLS, and a single dashboard page that still uses browser `alert()` for user feedback. The repository also includes `openapi.yaml`, which defines the MediaMTX `/v3` Control API endpoints and schemas requested by this change.

This change crosses API client structure, generated or normalized TypeScript contracts, error handling, dashboard UI state, audit behavior, permissions, polling, and configurable service endpoints. The implementation needs to preserve the existing Next.js architecture while replacing ad hoc dashboard calls with reusable typed primitives.

## Goals / Non-Goals

**Goals:**

- Provide complete typed client coverage for the requested MediaMTX Control API endpoints.
- Keep endpoint paths, payload shapes, and response shapes aligned with `openapi.yaml`.
- Centralize fetch behavior, authentication header handling, JSON parsing, empty response handling, and structured error wrapping.
- Replace blocking alert feedback with reusable toast or notification components.
- Add loading, empty, and error state handling to each module that renders API-backed dashboard data.
- Record dashboard-side audit entries for administrative operations such as config changes, kicks, deletes, and JWKS refreshes.
- Enforce UI permission guards for MediaMTX action categories before showing or executing restricted operations.
- Add configurable polling and manual refresh behavior for runtime views.
- Expand URL configuration so Control API, HLS, playback, metrics, and pprof services can be configured independently.

**Non-Goals:**

- Replacing MediaMTX authorization or server-side access control.
- Adding new MediaMTX endpoints not present in the bundled OpenAPI contract.
- Building persistent server-side audit storage unless the current app already has a persistence layer suitable for it.
- Redesigning the entire dashboard visual language beyond the controls and states needed for this change.

## Decisions

1. Use `openapi.yaml` as the source of truth for types and client method coverage.

   The implementation will either generate TypeScript types from the OpenAPI document or maintain a checked-in normalized schema module that is traceable to OpenAPI component names. This avoids hand-written drift and supports the requested full endpoint coverage. An alternative was continuing with local interfaces inside `lib/mediamtx-api.ts`, but that has already diverged from the full API surface and would scale poorly.

2. Split low-level transport from domain-specific endpoint groups.

   A shared transport layer will own base URL resolution, auth headers, request serialization, response parsing, and `MediaMtxApiError` creation. Endpoint groups will expose named methods for global config, path defaults, path configs, runtime paths, muxers, protocol connections and sessions, recordings, and auth JWKS refresh. An alternative was a single flat file with all methods, but grouped modules make permissions, tests, and dashboard imports easier to reason about.

3. Preserve the existing Next.js proxy as the default Control API base while allowing explicit service URLs.

   Browser calls should continue to default to `/api/mediamtx` for Control API requests so credentials and CORS behavior remain predictable. Server-facing proxy configuration will continue to use server environment variables. HLS, playback, metrics, and pprof URL helpers will be separate so one service can be moved without affecting the others. An alternative was a single MediaMTX base URL with derived ports, but deployments often expose these services differently.

4. Use a unified error envelope across client and dashboard components.

   All failed API calls will throw or return a structured error with status, status text, endpoint, method, parsed MediaMTX error body when available, and a user-safe message. Dashboard components will use that envelope for error states, toasts, and audit failure entries. An alternative was catching generic `Error`, but it loses the details needed to debug operations.

5. Keep audit logging dashboard-side and append-only for this change.

   Administrative actions will record actor, action, target, payload summary, result, timestamp, and error summary when available. If no backend persistence exists, entries can live in client state and optional local storage behind a small audit service. An alternative was introducing a database-backed audit service, but that is outside the current app shape and can be added later without changing event semantics.

6. Treat permission guards as UI and client execution gates.

   Permission checks will map dashboard operations to MediaMTX action labels: `api`, `metrics`, `pprof`, `publish`, `read`, and `playback`. Guarded UI will hide or disable unavailable controls, and action handlers will re-check permissions before invoking mutating operations. This improves dashboard safety without claiming to replace MediaMTX server enforcement.

7. Implement polling as a reusable hook or service with per-module configuration.

   Runtime views will support manual refresh, enabled or disabled polling, and configurable intervals. Mutating operations will trigger a targeted refresh after success. An alternative was page-level `setInterval`, but shared polling behavior reduces leaks and inconsistent refresh UX.

## Risks / Trade-offs

- OpenAPI drift between bundled `openapi.yaml` and deployed MediaMTX versions -> Keep schema generation or normalization explicit and make unsupported responses surface through `MediaMtxApiError`.
- Large client surface can become hard to test -> Group endpoint methods by resource and add table-driven tests for path, method, encoding, and response handling.
- Dashboard-side audit logs can be cleared by the user -> Define the audit event shape now and keep persistence swappable for a later backend-backed implementation.
- Permission guards can be mistaken for server authorization -> Keep server authorization unchanged and document guards as dashboard behavior only.
- Aggressive polling can overload small deployments -> Default to conservative intervals, allow polling to be disabled, and avoid polling hidden or unmounted modules.
- Multiple base URLs can create confusing configuration -> Centralize normalization helpers and expose the effective configured URL in settings or diagnostics where practical.

## Migration Plan

1. Add normalized schemas and the shared Control API transport without changing existing dashboard behavior.
2. Port existing path config and runtime path calls onto the new client while preserving current UI behavior.
3. Add the remaining endpoint groups and unit coverage for request construction and error handling.
4. Introduce notifications, state wrappers, permission guards, audit logging, and polling controls in dashboard modules.
5. Add service URL helpers and configuration tests for Control API, HLS, playback, metrics, and pprof.
6. Remove obsolete alert usage and any redundant API helpers once the dashboard imports the new client.

Rollback can revert dashboard imports to the previous small API wrapper if needed, because the proxy route and existing MediaMTX endpoints remain compatible.

## Open Questions

- Whether schema types will be generated during build or checked in as a normalized TypeScript module depends on the preferred project dependency footprint.
- Whether audit logs should persist only in local browser storage or use a future server-side store is not yet defined.
- The exact source of user permissions in the current app needs to be confirmed during implementation; the guard API should isolate that decision from UI components.
