## 1. API and Type Foundation

- [x] 1.1 Verify `GlobalConf` includes `logLevel`, `logDestinations`, `logStructured`, `logFile`, `sysLogPrefix`, `dumpPackets`, `readTimeout`, `writeTimeout`, `writeQueueSize`, `udpMaxPayloadSize`, `udpReadBufferSize`, `runOnConnect`, `runOnConnectRestart`, and `runOnDisconnect`.
- [x] 1.2 Verify `getGlobalConfig()` uses `GET /v3/config/global/get` and `patchGlobalConfig()` uses `PATCH /v3/config/global/patch`.
- [x] 1.3 Add or update API client tests confirming partial global config patches do not include unchanged fields and failures use `MediaMtxApiError`.

## 2. Global Configuration View

- [x] 2.1 Ensure the dashboard has a dedicated Vietnamese configuration tab or section that renders `GlobalConfigView`.
- [x] 2.2 Load global config on mount, store the original backend snapshot, and show Vietnamese loading, empty, and error states with retry.
- [x] 2.3 Show last-synced timestamp and unsaved-change indicators after successful load or patch.

## 3. General Settings Form

- [x] 3.1 Render Vietnamese controls for `logLevel`, `logDestinations`, `logStructured`, `logFile`, `sysLogPrefix`, and `dumpPackets`.
- [x] 3.2 Render Vietnamese controls for `readTimeout`, `writeTimeout`, `writeQueueSize`, `udpMaxPayloadSize`, and `udpReadBufferSize`.
- [x] 3.3 Track dirty general settings and build a patch payload containing only changed general setting keys.

## 4. Global Hooks Form

- [x] 4.1 Render Vietnamese controls for `runOnConnect`, `runOnConnectRestart`, and `runOnDisconnect`.
- [x] 4.2 Track dirty hook settings and build a patch payload containing only changed hook keys.
- [x] 4.3 Preserve hook command text exactly in form state and payload preview.

## 5. Hot Reload UX and Feedback

- [x] 5.1 Show an exact JSON payload preview before applying a global config patch.
- [x] 5.2 Apply previewed patches through `patchGlobalConfig()` and disable save/apply controls while patching.
- [x] 5.3 On success, show a Vietnamese success notification, update the original snapshot, clear dirty state, and update last-synced timestamp.
- [x] 5.4 On failure, show Vietnamese non-blocking error feedback and map field-specific API errors to inline field messages where possible.
- [x] 5.5 If no fields are dirty, show a Vietnamese informational notification and avoid calling the patch endpoint.

## 6. Permissions and Audit

- [x] 6.1 Disable editing when the user lacks `api` permission and show Vietnamese permission guidance.
- [x] 6.2 Guard patch handlers with `requireMediaMtxAction(permissions, "api")` before calling MediaMTX.
- [x] 6.3 Append audit entries for successful and failed global config patches with actor, action, target, payload summary, result, and error summary.

## 7. Verification

- [x] 7.1 Add or update tests for global config form fields, dirty patch payloads, preview behavior, permission guards, errors, and Vietnamese copy.
- [x] 7.2 Run `npm test`.
- [x] 7.3 Run `npm run lint`.
- [x] 7.4 Run TypeScript type checking with `npx tsc --noEmit`.
- [ ] 7.5 Manually verify the configuration view with reachable and unreachable MediaMTX states before updating `todo.md` section 3.
- [ ] 7.6 Update `todo.md` section 3 checkboxes after implementation and verification are complete.
