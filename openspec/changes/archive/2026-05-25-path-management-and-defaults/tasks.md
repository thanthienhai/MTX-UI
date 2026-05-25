## 1. Client and Contract Foundation

- [x] 1.1 Extend `PathConf`, `Path`, `PathReader`, and related types with path fields required by source-specific forms, runtime readers, bytes, tracks, and `useAbsoluteTimestamp`.
- [x] 1.2 Add or update client helpers for path list/get/add/patch/replace/delete, runtime path list/get, path defaults get/patch, and supported reader/session kick resolution.
- [x] 1.3 Extend stream URL utilities to generate RTSP, RTSPS, RTMP, HLS, WebRTC, and SRT URLs for normal, regex, and `all_others` path names.
- [x] 1.4 Update OpenAPI contract assertions for path config fields, path lifecycle endpoints, path defaults endpoints, runtime path endpoints, and URL builders.
- [x] 1.5 Add client and utility tests for path name encoding, replace/delete payloads, path defaults patch payloads, runtime reader fields, kick resolution, and stream URL generation.

## 2. Path Form and Defaults Utilities

- [x] 2.1 Create a reusable path field registry for common path options, source-specific options, recording fields, defaults comparison, and reset behavior.
- [x] 2.2 Implement path form mapping utilities for configured paths, new paths, replace payloads, and minimal patch payloads.
- [x] 2.3 Implement path name mode helpers for normal names, regex names, and `all_others`.
- [x] 2.4 Implement configured/runtime path merge utilities that preserve config-only, runtime-only, and matched path rows.
- [x] 2.5 Implement path defaults mapping, diff, reset-to-default, apply-to-all payload generation, and validation utilities.
- [x] 2.6 Implement JSON/YAML import/export utilities for `pathDefaults` with parse validation and preview payload generation.

## 3. Path Management UI

- [ ] 3.1 Replace the limited path card list with a path management component that shows configured and runtime path rows together.
- [ ] 3.2 Render ready status, source type/id, tracks, active readers, bytes in/out, and config/runtime availability for each path row.
- [ ] 3.3 Add path create/edit forms supporting normal, regex, and `all_others` path names.
- [ ] 3.4 Add source configuration controls for `publisher`, RTSP/RTSPS, RTMP/RTMPS, HLS, SRT, WHEP, RTP, redirect, and Raspberry Pi Camera sources.
- [ ] 3.5 Add common path controls for `sourceFingerprint`, `sourceOnDemand`, `sourceOnDemandStartTimeout`, `sourceOnDemandCloseAfter`, `maxReaders`, `overridePublisher`, and `useAbsoluteTimestamp`.
- [ ] 3.6 Implement explicit add, patch, replace, and delete actions with payload previews, confirmation for destructive actions, notifications, audit events, and data refresh.

- [ ] 3.1 Replace the limited path card list with a path management component that shows configured and runtime path rows together.
- [ ] 3.2 Render ready status, source type/id, tracks, active readers, bytes in/out, and config/runtime availability for each path row.
- [ ] 3.3 Add path create/edit forms supporting normal, regex, and `all_others` path names.
- [ ] 3.4 Add source configuration controls for `publisher`, RTSP/RTSPS, RTMP/RTMPS, HLS, SRT, WHEP, RTP, redirect, and Raspberry Pi Camera sources.
- [ ] 3.5 Add common path controls for `sourceFingerprint`, `sourceOnDemand`, `sourceOnDemandStartTimeout`, `sourceOnDemandCloseAfter`, `maxReaders`, `overridePublisher`, and `useAbsoluteTimestamp`.
- [ ] 3.6 Implement explicit add, patch, replace, and delete actions with payload previews, confirmation for destructive actions, notifications, audit events, and data refresh.

## 4. Runtime Actions and URL Actions

- [ ] 4.1 Show generated RTSP, RTSPS, RTMP, HLS, WebRTC, and SRT URLs for selected paths.
- [ ] 4.2 Implement copy stream URL and open playback actions with permission checks and notifications.
- [ ] 4.3 Implement live preview for ready paths using the existing stream player behavior.
- [ ] 4.4 Implement active reader/session details and kick actions for supported runtime reader/session types.
- [ ] 4.5 Preserve existing polling/manual refresh behavior for configured path and runtime path data.

## 5. Path Defaults UI

- [ ] 5.1 Add a dedicated `pathDefaults` screen or tab section that loads and edits path default fields.
- [ ] 5.2 Implement minimal path defaults patch save with preview, notifications, audit events, field errors, and unsaved-state preservation.
- [ ] 5.3 Implement comparison UI showing which path fields match defaults and which fields override defaults.
- [ ] 5.4 Implement reset-to-default for individual path fields.
- [ ] 5.5 Implement apply-defaults-to-all with affected path preview, batch patch execution, partial failure reporting, notifications, and audit events.
- [ ] 5.6 Implement JSON/YAML import and export for path defaults with validation and preview before patch.

## 6. Permissions and Safety

- [ ] 6.1 Enforce `api` permission checks for all path config, defaults, import, apply, delete, replace, and kick actions.
- [ ] 6.2 Enforce `read` and `playback` permission checks for live preview and playback URL actions.
- [ ] 6.3 Preserve unsaved form state on failed path/default mutations and show user-safe API errors.
- [ ] 6.4 Add audit entries for successful and failed path lifecycle, runtime kick, defaults save, import, reset, and apply-to-all actions.

## 7. Verification

- [ ] 7.1 Add unit tests for path form serialization, minimal patch generation, path name modes, merge utilities, defaults diff/reset/apply, and JSON/YAML import/export.
- [ ] 7.2 Add dashboard behavior tests for path list/runtime display, source forms, add/edit/replace/delete actions, URL actions, preview, active readers, and kick actions.
- [ ] 7.3 Add dashboard behavior tests for path defaults save, comparison, reset, apply-to-all, import/export, and permission-disabled states.
- [ ] 7.4 Run existing MediaMTX API, dashboard experience, dashboard overview, protocol management, and path-related test scripts and fix regressions.
- [ ] 7.5 Run `npx tsc --noEmit`, `npm test`, and `openspec validate path-management-and-defaults`.
