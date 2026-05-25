## Why

The dashboard currently has no dedicated UI for viewing and editing the MediaMTX global server configuration. Operators must either use raw API calls or manually edit `mediamtx.yml`. Adding a structured global configuration page enables safe hot-reload editing of server-wide settings, logging, and global hooks without server restarts, with visual preview and field-level error feedback.

## What Changes

- Add a dedicated global configuration page/panel that reads and writes `GlobalConf` via the Control API (`GET /v3/config/global/get`, `PATCH /v3/config/global/patch`).
- Render general server settings as structured form fields: `logLevel`, `logDestinations`, `logStructured`, `logFile`, `sysLogPrefix`, `dumpPackets`, `readTimeout`, `writeTimeout`, `writeQueueSize`, `udpMaxPayloadSize`, `udpReadBufferSize`.
- Render global hook fields: `runOnConnect`, `runOnConnectRestart`, `runOnDisconnect`.
- Add hot-reload UX: field-level patching, payload preview before applying, and success/failure notifications with field-level error display.
- Group settings into logical sections (General, Logging, Hooks) with loading, empty, and error states.
- Apply permission guards (`api` permission required for viewing and editing).

## Capabilities

### New Capabilities

- `global-config-ui`: Read, edit, and hot-reload the MediaMTX global server configuration through a structured form UI with payload preview, field-level patching, and error feedback.

### Modified Capabilities

- None.

## Impact

- Affected code includes the dashboard page or component files under `app/`, the existing `GlobalConf` type and `getGlobalConfig`/`patchGlobalConfig` client methods in `lib/mediamtx-api.ts`, and shared UI components in `components/`.
- The implementation builds on the existing `mediamtx-control-api-client` spec (global config get/patch) and the `dashboard-admin-experience` spec (notifications, permission guards, loading/error states).
- No new API endpoints or dependencies required; the feature uses already-implemented client methods.
