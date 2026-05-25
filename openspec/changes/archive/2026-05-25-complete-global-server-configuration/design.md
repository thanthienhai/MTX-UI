## Context

The dashboard already has the foundational MediaMTX Control API client and shared admin UX patterns: permission guards, toasts, loading/error states, audit logging, and Vietnamese-facing copy in recent dashboard work. The next requested scope is `todo.md` section 3, which focuses on global server configuration through `GET /v3/config/global/get` and `PATCH /v3/config/global/patch`.

There is an older active change named `global-server-configuration-ui` that described much of this feature. This change restates the current requested implementation scope as a fresh, self-contained change so it can be applied directly against the current codebase state.

## Goals / Non-Goals

**Goals:**

- Provide a Global Server Configuration UI that reads the backend global config from MediaMTX Control API.
- Render editable Vietnamese controls for all requested general setting fields and global hook fields.
- Patch only changed fields through `PATCH /v3/config/global/patch`.
- Show an exact JSON payload preview before applying a patch.
- Display success/failure feedback with non-blocking notifications and inline field-level errors when available.
- Enforce `api` permission before edits and record audit log entries for global config patch attempts.
- Keep the implementation aligned with existing dashboard components and tests.

**Non-Goals:**

- Implement protocol-specific server settings beyond the requested general and global hook fields.
- Edit authentication users, path defaults, path configs, recording settings, or protocol pages.
- Add a new backend service, database, or external validation library.
- Replace MediaMTX's server-side validation with a complete client-side schema.

## Decisions

1. Use a dedicated configuration component.

   A focused `GlobalConfigView` component keeps global server settings separate from overview, runtime monitoring, and path management. This fits the existing dashboard tab structure and makes verification easier.

   Alternative considered: expand the existing server tab. That would mix local status controls, read-only snapshots, and patchable backend settings in one surface.

2. Patch dirty fields only.

   The UI should compute the difference between the original backend snapshot and the current form state, then send only changed keys. This reduces accidental overwrites when another operator or process changes unrelated config fields.

   Alternative considered: send the entire global config object. That is simpler but increases the blast radius of a form submit.

3. Preview before apply.

   Before applying any patch, the dashboard should show the exact JSON payload that will be sent. This is especially useful for hook command fields and low-level networking values.

   Alternative considered: immediate save on button click. That is faster but gives operators less control over potentially sensitive server-wide settings.

4. Reuse MediaMTX API validation.

   The dashboard should do lightweight input normalization where it is obvious, but field validity ultimately comes from MediaMTX. API response details should be mapped to inline field errors when possible.

   Alternative considered: duplicate the full MediaMTX validation schema client-side. That would be brittle across MediaMTX versions.

5. Keep technical identifiers visible.

   User-facing labels and feedback should be Vietnamese, while config keys such as `logLevel` and `runOnConnect` remain visible near fields or payload previews so operators can correlate UI edits with MediaMTX documentation.

   Alternative considered: translate every field name entirely. That would reduce clarity for operators familiar with MediaMTX config keys.

## Risks / Trade-offs

- Stale backend snapshot -> Provide refresh, last-synced timestamp, and dirty state indicators before patching.
- Field-level error shape varies by MediaMTX version -> Parse obvious key-based errors and fall back to a localized general error notification.
- Hook commands are sensitive -> Require payload preview and preserve technical command text exactly.
- Missing `api` permission -> Disable editing and guard handlers before calling Control API.
- Existing completed change overlaps this scope -> Treat this change as the active source for implementation and keep artifacts self-contained.

## Migration Plan

1. Extend or verify `GlobalConf` typing and global config client methods.
2. Implement or complete `GlobalConfigView` with sections for general settings and global hooks.
3. Wire the view into the dashboard configuration tab with permission/audit/notification integration.
4. Add or update tests for global config fields, dirty patch payloads, preview UX, errors, permissions, and Vietnamese copy.
5. Verify with `npm test`, `npm run lint`, type checking, and a browser smoke test against reachable and unreachable MediaMTX states.
