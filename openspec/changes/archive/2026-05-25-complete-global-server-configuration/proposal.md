## Why

Operators need a complete Vietnamese dashboard workflow for reading and safely editing MediaMTX global server configuration through the Control API instead of relying on raw API calls or direct `mediamtx.yml` edits. The checklist in `todo.md` section 3 defines the next high-value configuration surface: general server settings, global hooks, hot-reload patching, payload preview, and clear success/failure feedback.

## What Changes

- Build or complete a Global Server Configuration UI backed by `GET /v3/config/global/get` and `PATCH /v3/config/global/patch`.
- Support editable general settings for `logLevel`, `logDestinations`, `logStructured`, `logFile`, `sysLogPrefix`, `dumpPackets`, `readTimeout`, `writeTimeout`, `writeQueueSize`, `udpMaxPayloadSize`, and `udpReadBufferSize`.
- Support editable global hook settings for `runOnConnect`, `runOnConnectRestart`, and `runOnDisconnect`.
- Provide hot-reload UX with field-scoped patch payloads, preview before apply, loading state, success/failure notifications, and inline field-level errors.
- Preserve existing dashboard patterns for Vietnamese UI copy, permission guards, audit logging, module states, and non-blocking notifications.
- No breaking changes are expected.

## Capabilities

### New Capabilities

- `global-server-configuration`: Read, edit, validate, preview, and hot-reload MediaMTX global server configuration from the dashboard.

### Modified Capabilities

- `dashboard-admin-experience`: Ensure global configuration updates use existing localized notifications, loading/error states, audit log entries, and permission guards.
- `mediamtx-control-api-client`: Ensure global configuration get/patch client behavior is complete and suitable for field-scoped patches.

## Impact

- Affected code includes `components/global-config-view.tsx`, `app/page.tsx`, `lib/mediamtx-api.ts`, shared UI/state/notification/audit helpers, and related script tests.
- The implementation uses existing Control API endpoints and does not introduce new backend services or external dependencies.
- `todo.md` section 3 should be updated only after implementation and verification are complete.
