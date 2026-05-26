## Why

MediaMTX does not have native forwarding — stream forwarding to remote servers must be done via FFmpeg commands in the `runOnReady` hook. Currently, there is no UI for this. Users must manually edit the YAML config or use the raw API. Adding a Forwarding configuration UI in the Path Edit dialog makes it easy to set up forwarding to RTSP, RTMP, SRT, or HLS targets without leaving the dashboard.

## What Changes

- New `forwarding-config.tsx` component for configuring stream forwarding per path.
- Integration into `path-form.tsx` (Path Edit dialog) as a new section, following the same pattern as Recording and Snapshot.
- FFmpeg command generator with presets for RTSP, RTMP, SRT, and HLS/HTTP targets.
- Editable command preview textarea so users can customize the generated command.
- `runOnReadyRestart` toggle switch.
- Command validation (non-empty when enabled, valid target URL).
- Security warning banner about FFmpeg dependency and filesystem/credential risks.
- Forwarding fields (`runOnReady`, `runOnReadyRestart`) included in path PATCH payloads.
- Update `PATH_FIELD_REGISTRY` entries for `runOnReady` to include `appliesToDefaults: true`.

## Capabilities

### New Capabilities
- `forwarding-config`: UI for configuring per-path stream forwarding via FFmpeg `runOnReady` hook — target protocol presets, URL input, command generation, validation, and security warnings.

### Modified Capabilities
*(No existing specs are modified — this is an entirely new capability.)*

## Impact

- **New component**: `components/forwarding-config.tsx` — the core config form (similar to `snapshot-config.tsx`).
- **Modified component**: `components/path-management/path-form.tsx` — add Forwarding section to the dialog, include forwarding fields in `buildPayload()`.
- **Modified utility**: `lib/path-management.mjs` — update `PATH_FIELD_REGISTRY` for `runOnReady` to enable path defaults support; add `runOnReadyRestart` registry entry.
- **No API changes**: `runOnReady` and `runOnReadyRestart` already exist in `PathConf` and the Control API.
- **No new dependencies**: FFmpeg is a runtime dependency of MediaMTX, not of this dashboard.
