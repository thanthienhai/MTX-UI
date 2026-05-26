## 1. Field Registry & Utilities

- [x] 1.1 Add `runOnReadyRestart` entry to `PATH_FIELD_REGISTRY` in `lib/path-management.mjs` with `appliesToDefaults: true`
- [x] 1.2 Update `runOnReady` registry entry in `lib/path-management.mjs` — add `appliesToDefaults: true`

## 2. Forwarding Config Component

- [x] 2.1 Create `components/forwarding-config.tsx` with enable/disable toggle switch
- [x] 2.2 Add target protocol selector (Select component) with options: RTSP, RTMP, SRT, HLS/HTTP
- [x] 2.3 Add target URL input field with per-protocol placeholders
- [x] 2.4 Implement FFmpeg command generator function that builds command from protocol + URL + pathName
- [x] 2.5 Add editable command preview textarea synced with generated command
- [x] 2.6 Add `runOnReadyRestart` toggle switch
- [x] 2.7 Add FFmpeg dependency security warning banner (amber AlertTriangle)
- [x] 2.8 Implement command validation (non-empty when enabled)
- [x] 2.9 Add helper text explaining environment variables (`MTX_PATH`, `RTSP_PORT`, etc.)

## 3. Path Form Integration

- [x] 3.1 Import `ForwardingConfig` in `components/path-management/path-form.tsx`
- [x] 3.2 Add forwarding state variables: `runOnReady`, `runOnReadyRestart`
- [x] 3.3 Load forwarding fields from `initialPath` in the `useEffect` initialization
- [x] 3.4 Add forwarding fields to `resetForm()`
- [x] 3.5 Add Forwarding section JSX in the dialog (after Recording section, before Separator + Common Options)
- [x] 3.6 Include `runOnReady` and `runOnReadyRestart` in `buildPayload()`
- [x] 3.7 Verify LSP diagnostics clean on all changed files

## 4. Verify & Finalize

- [x] 4.1 Run `lsp_diagnostics` on all modified files — no new errors
- [x] 4.2 Build project with `pnpm build` — no errors
- [x] 4.3 Review diff against existing patterns (snapshot-config.tsx, remote-upload-config.tsx) for consistency
