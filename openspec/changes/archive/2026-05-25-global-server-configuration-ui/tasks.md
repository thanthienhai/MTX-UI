## 1. Extend GlobalConf Type

- [x] 1.1 Add missing general settings fields to `GlobalConf` interface in `lib/mediamtx-api.ts`: `logLevel`, `logDestinations`, `logStructured`, `logFile`, `sysLogPrefix`, `dumpPackets`, `readTimeout`, `writeTimeout`, `writeQueueSize`, `udpMaxPayloadSize`, `udpReadBufferSize`.
- [x] 1.2 Add missing global hook fields to `GlobalConf`: `runOnConnect`, `runOnConnectRestart`, `runOnDisconnect`.
- [x] 1.3 Run type checking to verify the extended `GlobalConf` does not break existing usages.

## 2. Global Configuration Tab Setup

- [x] 2.1 Add a "Configuration" tab trigger and content section to the `Tabs` component in `app/page.tsx`, following the existing tab pattern (Overview, Server, Paths, Auth, Recording, Monitoring).
- [x] 2.2 Create a `GlobalConfigView` component that renders inside the new Configuration tab content.
- [x] 2.3 Wire `GlobalConfigView` to fetch `getGlobalConfig()` on mount and store the result in local state.
- [x] 2.4 Add loading state (using `LoadingState` component) while config is being fetched.
- [x] 2.5 Add error state with retry action (using `ErrorState` component) if the fetch fails.
- [x] 2.6 Add a "last synced" timestamp display that updates after successful fetch or patch.

## 3. General Settings Section

- [x] 3.1 Build a `GeneralSettingsCard` component with `Card`, `CardHeader`, `CardTitle`, `CardContent`.
- [x] 3.2 Render a `<Select>` field for `logLevel` with options: `"error"`, `"warn"`, `"info"`, `"debug"`.
- [x] 3.3 Render a `<Select>` or multi-tag input for `logDestinations` with options: `"stdout"`, `"file"`, `"syslog"`.
- [x] 3.4 Render a `<Switch>` toggle for `logStructured` (boolean).
- [x] 3.5 Render a text `<Input>` for `logFile` (file path string).
- [x] 3.6 Render a text `<Input>` for `sysLogPrefix` (prefix string).
- [x] 3.7 Render a `<Switch>` toggle for `dumpPackets` (boolean).
- [x] 3.8 Render a number `<Input>` for `readTimeout` (seconds).
- [x] 3.9 Render a number `<Input>` for `writeTimeout` (seconds).
- [x] 3.10 Render a number `<Input>` for `writeQueueSize` (packet count).
- [x] 3.11 Render a number `<Input>` for `udpMaxPayloadSize` (bytes).
- [x] 3.12 Render a number `<Input>` for `udpReadBufferSize` (bytes).
- [x] 3.13 Add a "Save" button for the General Settings section that collects changed fields and triggers a patch.

## 4. Global Hooks Section

- [x] 4.1 Build a `GlobalHooksCard` component with `Card`, `CardHeader`, `CardTitle`, `CardContent`.
- [x] 4.2 Render a text `<Input>` for `runOnConnect` (shell command string).
- [x] 4.3 Render a `<Switch>` toggle for `runOnConnectRestart` (boolean).
- [x] 4.4 Render a text `<Input>` for `runOnDisconnect` (shell command string).
- [x] 4.5 Add a "Save" button for the Hooks section that collects changed fields and triggers a patch.

## 5. Hot Reload UX — Patch, Preview, and Error Feedback

- [x] 5.1 Implement a reusable `PatchPreview` component that displays the JSON patch payload in a collapsed `<pre>` code block before dispatch.
- [x] 5.2 Wire each section's Save button to show the `PatchPreview` as a confirmation step before sending the `PATCH` request.
- [x] 5.3 On successful patch (2xx response), show a success notification via `useNotifications()` and update the form state and "last synced" timestamp.
- [x] 5.4 On patch failure with per-field error details, parse the error response and display inline error messages below the affected fields.
- [x] 5.5 On patch failure without per-field details, show a non-blocking error notification via `useNotifications()`.
- [x] 5.6 Disable all section Save buttons while any patch request is in flight.
- [x] 5.7 Add dirty-field tracking per section so only changed fields are included in each PATCH payload.

## 6. Permissions and Audit

- [x] 6.1 Apply `requireMediaMtxAction(permissions, "api")` guard in all save handlers.
- [x] 6.2 Disable all form inputs and Save buttons when the user lacks `api` permission.
- [x] 6.3 Add audit log entries for successful and failed global config patches via `appendAuditEvent()`.

## 7. Integration and Verification

- [x] 7.1 Run type checking and fix all TypeScript errors introduced by the new component, extended types, and hooks.
- [x] 7.2 Run linting and resolve any lint issues.
- [x] 7.3 Manually verify the Configuration tab renders, loads data, shows loading/error states, patches fields, shows payload preview, and handles success/failure feedback.
