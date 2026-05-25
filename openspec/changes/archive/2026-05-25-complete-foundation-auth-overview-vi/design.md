## Context

The existing dashboard is a Next.js application with a MediaMTX proxy route, typed API helpers, auth/session utilities, permission helpers, reusable module states, notifications, and overview helper logic. `todo.md` marks the broad foundation, auth/session, and overview work as started, but the remaining sub-items still need to be completed and presented in Vietnamese for operators.

This change crosses API client coverage, endpoint URL configuration, authentication, permission guards, overview data aggregation, notifications, and dashboard copy. It should build on the existing modules instead of introducing a separate backend or a new state-management system.

## Goals / Non-Goals

**Goals:**

- Complete MediaMTX Control API client coverage for the foundational endpoints listed in `todo.md` sections 0 through 2.
- Support independent base URLs for Control API, HLS, playback, metrics, and pprof across helpers, UI configuration, and relevant links/fetches.
- Complete Basic Auth and bearer/JWT login, API permission validation, logout, session expiry, permission display, and permission-aware controls.
- Complete overview cards using real MediaMTX config/runtime data, endpoint configuration, permissions, metrics scrape results, API latency, and byte-delta bitrate calculations.
- Localize affected dashboard UI text into Vietnamese, including labels, buttons, status names, empty/error states, notifications, and permission descriptions.
- Preserve existing toast, audit log, module state, refresh/polling, and permission guard patterns.

**Non-Goals:**

- Implement full feature areas after overview, such as global server configuration forms, protocol-specific configuration pages, recording playback, logs, pprof analysis, or deployment documentation.
- Add a dashboard backend service beyond the existing Next.js proxy route.
- Replace the current component library, route structure, or authentication storage strategy with a production cookie/session service.
- Translate repository documentation or code identifiers; the requirement is for user-facing UI copy in the affected workflows.

## Decisions

1. Use existing helper modules as the integration boundary.

   The MediaMTX client, URL helpers, auth utilities, permission helpers, overview helper, and proxy route already define most boundaries needed by this work. Extending them keeps behavior testable through existing script-based tests and avoids coupling page components directly to raw endpoint paths or browser storage.

   Alternative considered: add feature-specific client logic inside components. That would be faster locally but would make permission checks, credential handling, URL normalization, and tests harder to keep consistent.

2. Treat Vietnamese copy as the default user-facing language for affected areas.

   The dashboard sections touched by this change should render Vietnamese text directly for operational labels, statuses, actions, errors, and notifications. Internal code names, MediaMTX field names, endpoint names, and protocol acronyms remain unchanged when they are technical identifiers.

   Alternative considered: introduce a full i18n framework. That is unnecessary for this scoped change and would add migration work unrelated to the requested foundation/auth/overview completion.

3. Resolve auth state through a session abstraction, not direct component storage access.

   Components should call auth/session utilities to create, read, expire, clear, and derive request authorization. This satisfies the safer storage requirement while leaving room for a later server-managed session without rewriting UI components.

   Alternative considered: continue direct `sessionStorage` usage in login and protected pages. That keeps current behavior simple but fails the requirement to isolate credential persistence.

4. Build overview data from partial, independently failing sources.

   Overview refresh should collect global config, service endpoints, path configs, runtime paths, protocol resources, metrics scrape status, and byte counters as independently as possible. A failure in metrics or one protocol resource should degrade that region without blocking the rest of the overview.

   Alternative considered: fail the whole overview when any request fails. That would make health issues more visible, but it would reduce operator value during partial MediaMTX outages.

5. Calculate bitrate from cumulative byte samples in dashboard state.

   MediaMTX runtime responses and/or metrics can expose cumulative byte counters. The dashboard should keep the previous sample, elapsed time, and reset detection in overview helper logic so components display a stable value without duplicating math.

   Alternative considered: require Prometheus rates from a metrics backend. That would be more sophisticated but is outside this dashboard-only change and would make bitrate unavailable when only the Control API is configured.

## Risks / Trade-offs

- API shape drift in MediaMTX versions -> Use `openapi.yaml`, existing OpenAPI contract tests, and defensive optional field handling for runtime objects.
- Credentials remain browser-side in development -> Keep credential persistence behind an adapter and avoid direct component access so production storage can be swapped later.
- Partial overview data can confuse users -> Label unknown/degraded Vietnamese states clearly and keep per-card error details available.
- Localized text can obscure technical fields -> Keep protocol names, endpoint paths, and config key names in their original technical form while translating surrounding UI copy.
- Metrics availability depends on separate endpoint configuration and permission -> Treat metrics scrape as a health input, not a hard dependency for overview rendering.

## Migration Plan

1. Extend client, URL, auth, permission, and overview helpers with tests.
2. Update login, protected dashboard, overview, endpoint settings, notifications, and state components to use Vietnamese copy and the helper contracts.
3. Verify the script test suite and manually check the dashboard flows with MediaMTX reachable and unreachable.
4. Rollback is a normal code revert; no persisted data migration is required.
