## Context

The dashboard already authenticates against MediaMTX, displays the current session permissions, reads and patches global configuration, and exposes a partial auth tab in `app/page.tsx`. MediaMTX authentication settings live on `GlobalConf`, so most persisted changes can use the existing `GET /v3/config/global/get` and `PATCH /v3/config/global/patch` flow. The current typed client includes `authInternalUsers` and `refreshJwks()`, but it does not fully model all requested auth fields or provide a reusable auth configuration API surface for the UI.

The implementation should complete authentication administration as an operator workflow, not as static sample cards. It must fit the dashboard's existing permission-aware behavior, notification system, audit events, and Vietnamese UI copy.

## Goals / Non-Goals

**Goals:**
- Provide a complete auth configuration UI for `internal`, `http`, and `jwt` methods.
- Read current auth settings from MediaMTX global configuration and patch only changed auth fields.
- Manage `authInternalUsers` with add, edit, delete, username `any`, password plain/hash entry, IP allowlists, and permissions by action/path.
- Support HTTP and JWT auth fields, HTTP auth testing, and JWKS refresh from the dashboard.
- Render a usable permission matrix for `publish`, `read`, `playback`, `api`, `metrics`, and `pprof`.
- Add typed client coverage for missing auth configuration fields and auth helper operations.

**Non-Goals:**
- Do not change the dashboard login/session storage architecture beyond what the auth configuration UI needs.
- Do not implement server-side password hashing in the dashboard unless MediaMTX requires a separate API for it; entered plain or prefixed hash values are sent as configuration values.
- Do not replace existing global configuration sections unrelated to authentication.

## Decisions

1. Store authentication settings through the global configuration patch flow.

   Auth settings are part of `GlobalConf`, and the existing dashboard already has a tested read/patch pattern for global configuration. Reusing that flow keeps hot reload behavior, field-level errors, notifications, and audit logging consistent. The alternative was to create a separate local persistence layer, but that would diverge from MediaMTX as the source of truth.

2. Model authentication UI state separately from the generic global config form.

   The auth UI should map `GlobalConf` into an explicit auth form state with internal users, HTTP settings, JWT settings, and permission rows. This avoids scattering auth-specific validation inside the general settings form. The alternative was to add every auth field to `GlobalConfigView`, but internal-user editing and matrix controls need richer interactions than simple scalar fields.

3. Treat permission entries as structured rows with action, optional path, and regex awareness.

   MediaMTX permissions use action/path pairs, while the UI needs to expose a matrix. The UI should keep a normalized row model and serialize back to `AuthInternalUserPermission[]` for internal users, HTTP excludes, and JWT excludes. Regex paths should remain literal path values in the payload, with UI validation and labeling so operators can distinguish exact path and regex intent.

4. Preserve entered password values without attempting to inspect secrets.

   The dashboard should allow blank password fields when editing a user to mean "keep existing value", require explicit replacement when changed, and accept either plain text or recognized hash-prefixed values. The alternative was to always round-trip password values, but that risks unnecessary secret exposure and accidental overwrite.

5. Use dedicated client helpers for auth actions.

   The UI should call named client functions for auth configuration patching, HTTP auth test/probe, and JWKS refresh rather than embedding raw endpoint strings in components. This keeps tests focused and allows the implementation to adapt if the local OpenAPI contract needs endpoint additions for HTTP auth testing.

## Risks / Trade-offs

- MediaMTX version drift for auth fields and helper endpoints -> Keep the typed model permissive enough to include documented auth fields, update `openapi.yaml` or local contract tests where the bundled contract is missing fields, and surface unsupported endpoint failures clearly.
- Password editing can accidentally clear credentials -> Use explicit "replace password" controls and omit `pass` from patch payloads unless the operator provides a value.
- Permission matrix serialization can produce invalid combinations -> Validate allowed actions, require paths when path-scoped permissions are selected, and show payload preview before patching.
- Regex paths can be misunderstood as exact paths -> Label regex entries distinctly and keep path values visible in the matrix before save.
- Auth misconfiguration can lock out dashboard access -> Preserve patch preview, audit events, clear error handling, and avoid automatic method switching without an explicit save.

## Migration Plan

1. Extend typed auth configuration models and client helpers.
2. Build the auth configuration component behind existing `api` permission checks.
3. Replace static auth tab content with live data from `GlobalConf`.
4. Add focused tests for form mapping, patch payloads, client endpoints, and permission matrix behavior.
5. Roll back by hiding the auth tab or reverting to the previous static tab while leaving existing login/session behavior unchanged.

## Open Questions

- The bundled `openapi.yaml` does not currently list every requested field, such as `authHTTPFingerprint`, `authJWTIssuer`, and `authJWTAudience`; implementation should confirm the target MediaMTX version and update the local contract accordingly.
- The exact HTTP auth test endpoint contract needs confirmation against the deployed MediaMTX version; if MediaMTX does not expose one, the dashboard must clearly report that live testing is unavailable instead of pretending a saved configuration was tested.
