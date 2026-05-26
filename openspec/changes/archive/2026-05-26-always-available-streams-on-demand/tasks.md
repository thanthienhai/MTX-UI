## 1. Type System & Registry Updates

- [x] 1.1 Extend `PathConf` interface in `lib/mediamtx-api.ts` with missing `runOn*` fields: `runOnDemand`, `runOnDemandRestart`, `runOnDemandStartTimeout`, `runOnDemandCloseAfter`, `runOnUnDemand`, `runOnInit`, `runOnInitRestart`, `runOnNotReady`, `runOnRead`, `runOnReadRestart`, `runOnUnread`, `fallback`
- [x] 1.2 Extend `PATH_FIELD_REGISTRY` in `lib/path-management.mjs` with entries for: `runOnDemandRestart`, `runOnDemandStartTimeout`, `runOnDemandCloseAfter`, `runOnUnDemand`, `runOnInit`, `runOnInitRestart`, `runOnNotReady`, `runOnRead`, `runOnReadRestart`, `runOnUnread`

## 2. Stream Mode Selector Component

- [x] 2.1 Create stream mode type: `type StreamMode = "publisher" | "pullUpstream" | "onDemandPull" | "alwaysPull"`
- [x] 2.2 Build mode → config mapping function (`source`, `sourceOnDemand`, `runOnInit` field mapping)
- [x] 2.3 Create `StreamModeSelector` UI component with 4 radio/button options with descriptions
- [x] 2.4 Integrate `StreamModeSelector` into `PathForm` (`path-form.tsx`) between source URL and proxy config sections
- [x] 2.5 Update `buildPayload()` to include `runOnInit`/`runOnInitRestart` when "Always Pull" mode is selected
- [x] 2.6 Update form reset logic and initial data loading to handle stream mode

## 3. Path State Indicators

- [x] 3.1 Create `PathStateBadge` component showing Offline (gray) / Connecting (yellow) / Ready (green) based on runtime `Path.ready` and `Path.source`
- [x] 3.2 Add `PathStateBadge` to the path list in `path-list.tsx`
- [x] 3.3 Add `readyTime` tooltip on hover for Ready state

## 4. On-Demand Publishing Component

- [x] 4.1 Create `components/on-demand-config.tsx` following `ForwardingConfig` pattern with:
  - [x] 4.1.1 Enable/disable toggle for on-demand publishing
  - [x] 4.1.2 Command template selector with 3 presets (MP4 loop, camera, external pull)
  - [x] 4.1.3 Template field inputs (file path, device, upstream URL)
  - [x] 4.1.4 Editable textarea for `runOnDemand` command
  - [x] 4.1.5 `runOnDemandRestart` switch toggle
  - [x] 4.1.6 `runOnUnDemand` command input
  - [x] 4.1.7 `runOnDemandStartTimeout` and `runOnDemandCloseAfter` duration inputs
  - [x] 4.1.8 Environment variable helper box (`MTX_PATH`, `MTX_QUERY`, `RTSP_PORT`, `G1`-`G5`)
  - [x] 4.1.9 Security warning banner
- [x] 4.2 Integrate `OnDemandConfig` into `PathForm` as a collapsible section after forwarding section
- [x] 4.3 Update `buildPayload()` to include on-demand fields
- [x] 4.4 Update form reset logic and initial data loading for on-demand fields

## 5. PathForm Integration

- [x] 5.1 Add `runOnInit` and `runOnInitRestart` fields to `PathForm` (shown when stream mode is "Always Pull")
- [x] 5.2 Update `validateForm()` to validate duration fields for `runOnDemandStartTimeout` and `runOnDemandCloseAfter`
- [x] 5.3 Update `buildPayload()` to include all new fields conditionally
- [x] 5.4 Verify LSP diagnostics clean on all modified files (tsc shows no new errors)

## 6. Verification

- [x] 6.1 Verify all new fields are included in add/patch/replace API payloads
- [x] 6.2 Verify stream mode selector maps to correct config values
- [x] 6.3 Verify path state badges display correctly for offline/connecting/ready states
- [x] 6.4 Verify on-demand command templates generate correct FFmpeg commands
- [x] 6.5 Run `lsp_diagnostics` on all changed files (tsc --noEmit passes with no new errors)
- [x] 6.6 Run build to verify no compilation errors
