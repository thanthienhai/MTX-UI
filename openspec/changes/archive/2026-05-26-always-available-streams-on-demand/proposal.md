## Why

MediaMTX paths currently lack persistent availability and on-demand publishing controls in the dashboard UI. When a publisher disconnects, the path goes offline — there is no mechanism to keep it alive via static commands (FFmpeg loop, camera process, external stream pull). The `runOnDemand`, `runOnDemandRestart`, and `runOnUnDemand` hooks exist in MediaMTX config but are not exposed in the UI. This limits operators from building resilient streaming pipelines that self-heal and respond to reader demand.

## What Changes

- **Always-Available Streams mode selector**: The path add/edit form gains a "Stream Mode" section that clearly distinguishes 4 modes:
  - Publisher mode (`source: "publisher"`)
  - Pull from upstream (`source: <URL>`, `sourceOnDemand: false`)
  - On-demand pull (`source: <URL>`, `sourceOnDemand: true`)
  - Always pull (`source: <URL>`, `sourceOnDemand: false` + restart hooks)
- **Command-based static source**: New UI to configure `runOnInit` command that starts a static source (e.g., FFmpeg loop MP4) ensuring the path is always available even when no publisher is pushing.
- **Path state indicators**: The path list displays offline/connecting/ready state for each path, derived from the runtime API `ready` field.
- **On-Demand Publishing UI**: New collapsible section in the path form for `runOnDemand`, `runOnDemandRestart`, and `runOnUnDemand` with:
  - Command template presets (Loop MP4, Start Camera, Pull External Stream)
  - Editable textarea with environment variable helper
  - Restart toggle and timeout/close-after fields
- **Type system updates**: `PathConf` interface extended with all missing `runOn*` hook fields from the OpenAPI spec.
- **Field registry updates**: `PATH_FIELD_REGISTRY` extended with `runOnDemandRestart`, `runOnDemandStartTimeout`, `runOnDemandCloseAfter`, `runOnUnDemand`, `runOnInit`, `runOnInitRestart`, `runOnNotReady`, `runOnRead`, `runOnReadRestart`, `runOnUnread`.

## Capabilities

### New Capabilities
- `always-available-streams`: Source mode management — distinct UI modes for publisher, pull from upstream, on-demand pull, always pull. Static command source via `runOnInit`. Path state indicators (offline/connecting/ready).
- `on-demand-publishing`: UI configuration for `runOnDemand` / `runOnDemandRestart` / `runOnUnDemand` hooks with command templates (FFmpeg loop MP4, camera process, external stream pull), env var helper, and lifecycle indicators.

### Modified Capabilities
- `path-management-ui`: Source configuration requirement extended to include stream mode selection and new hook fields in the add/edit form.
- `forwarding-config`: No requirement changes — existing `runOnReady` pattern is a separate hook with different semantics. On-demand publishing is additive, not a modification.

## Impact

- **`lib/mediamtx-api.ts`**: `PathConf` interface extended with 10+ new optional fields.
- **`lib/path-management.mjs`**: `PATH_FIELD_REGISTRY` extended with new hook entries; `detectSourceType` may need update for new source mode semantics.
- **`components/path-management/path-form.tsx`**: New collapsible section for stream mode selector; new collapsible section for on-demand publishing.
- **`components/path-management/path-list.tsx`** / **`app/page.tsx`**: Path row to show offline/connecting/ready state badges.
- **New component**: `components/on-demand-config.tsx` (pattern: `ForwardingConfig` command template + `ProxyConfig` template selector).
- **`openapi.yaml`**: Already has all required fields — no spec changes needed.
