## Context

MediaMTX Dashboard is a Next.js SPA with 15+ existing OpenSpec capabilities. Path configuration is managed through `PathForm` (reusable component at `components/path-management/path-form.tsx`) which currently handles source type selection, `sourceOnDemand`, recording, and forwarding (`runOnReady`). However, the following gaps exist:

1. **Stream modes are implicit**: The current UI has a single `sourceOnDemand` toggle but does not clearly distinguish between publisher mode, pull modes, or always-available mode.
2. **`runOn*` hooks are incomplete**: Only `runOnReady`/`runOnReadyRestart` are exposed via `ForwardingConfig`. `runOnDemand`, `runOnDemandRestart`, `runOnUnDemand`, `runOnInit`, and other hooks exist in the OpenAPI spec and MediaMTX config (`mediamtx.yml:661-740`) but are missing from the `PathConf` TypeScript interface and UI.
3. **No runtime state display**: The `Path` runtime interface exposes `ready: boolean` and `readyTime: string | null` but the path list does not display offline/connecting/ready state.
4. **Reusable command template pattern exists**: `ForwardingConfig` (command template + textarea + env vars) and `ProxyConfig` (template selector with fields) provide established UI patterns to follow.

### Files to Consider

| File | Role |
|---|---|
| `lib/mediamtx-api.ts:181-210` | PathConf interface — must extend |
| `lib/path-management.mjs` | PATH_FIELD_REGISTRY — must extend |
| `components/path-management/path-form.tsx` | Path form — must add new sections |
| `components/forwarding-config.tsx` | Reference pattern for command templates |
| `components/proxy-config.tsx` | Reference pattern for template selector |
| `components/path-management/path-list.tsx` | Path list — must add state badges |
| `app/page.tsx` | Main SPA — inline path rendering may need state badges |
| `components/on-demand-config.tsx` | **New** — command template component for runOnDemand |
| `openapi.yaml` | Reference — already has all required PathConf fields |
| `mediamtx.yml:655-740` | MediaMTX hook definitions — source of truth |

## Goals / Non-Goals

**Goals:**
- Expose 4 distinct stream modes in the path add/edit UI: Publisher, Pull from Upstream, On-Demand Pull, Always Pull
- Allow operators to configure `runOnInit` commands for static command-based sources
- Allow operators to configure `runOnDemand`, `runOnDemandRestart`, and `runOnUnDemand` with command template presets
- Display path state (offline/connecting/ready) in the path list
- Extend TypeScript `PathConf` interface to cover all missing `runOn*` fields from MediaMTX
- Extend `PATH_FIELD_REGISTRY` with all missing hook fields

**Non-Goals:**
- Not building a log-based command lifecycle viewer (todo mentions "if possible from logs/metrics" — deferred to a later phase)
- Not refactoring the inline path dialogs in `app/page.tsx` to use the reusable `PathForm` (scope is additive, not restructuring)
- Not adding `runOnRead`, `runOnReadRestart`, `runOnUnread` or recording hooks — these are separate features
- Not implementing actual log/metrics scraping for command lifecycle — only UI configuration

## Decisions

### D1: Stream Mode Selector — Dedicated UI Group, Not Sub-options

- **Decision**: Add a "Stream Mode" radio/button group in `PathForm` that visually distinguishes all 4 modes, instead of relying on the existing source type dropdown + scattered toggles.
- **Rationale**: The current UX makes it unclear whether a path will persist when publisher goes offline. A dedicated mode group makes the behavior explicit at a glance. Each mode maps cleanly to specific `source` + `sourceOnDemand` + `runOn*` combinations.
- **Alternatives considered**: Enhancing the existing `sourceOnDemand` switch with labels ("Always Available" / "On Demand") — rejected because it doesn't cover publisher mode vs pull mode distinction.

**Mode → Config Mapping:**

| Mode | `source` | `sourceOnDemand` | Additional |
|---|---|---|---|
| Publisher | `"publisher"` | N/A | Wait for external publisher |
| Pull from Upstream | URL | `false` | Always pull upstream source |
| On-Demand Pull | URL | `true` | Pull only when readers exist |
| Always Pull | URL or `"publisher"` | `false` | Uses `runOnInit` to start source process |

### D2: Always Pull Uses `runOnInit`, Not `runOnDemand`

- **Decision**: The "Always Pull" mode maps to `runOnInit` (command starts on path init and persists), distinct from On-Demand Publishing which uses `runOnDemand` (starts only on reader demand).
- **Rationale**: `runOnInit` starts when MediaMTX loads the path config and runs continuously. `runOnDemand` starts only when a reader requests the path. "Always Available" means the source should be up regardless of readers — hence `runOnInit`.
- **Consequence**: The "Always Pull" mode section in PathForm will show a command input for `runOnInit` + `runOnInitRestart` toggle.

### D3: On-Demand Config as Standalone Component

- **Decision**: Create `components/on-demand-config.tsx` following the same pattern as `ForwardingConfig` (command template selector + editable textarea + env var helper + restart toggle).
- **Rationale**: Encapsulation and reuse. The component handles all `runOnDemand`/`runOnDemandRestart`/`runOnUnDemand` fields in one place. `PathForm` imports and places it as a collapsible section, same as `ForwardingConfig`.
- **Alternatives considered**: Inlining fields directly into `PathForm` — rejected because it would bloat an already-large component (840 lines).

### D4: Command Templates Follow `ProxyConfig` Pattern

- **Decision**: Define templates as typed objects with `label`, `generateCommand(pathName, params)`, and `fields` array (for user-provided parameters like file path, camera device, upstream URL).
- **Rationale**: `ProxyConfig` already demonstrates this pattern with `PROXY_TEMPLATES` — fields array drives dynamic form inputs, `generateUrl` builds the result. Reusing this pattern ensures consistency.
- **Templates for On-Demand**:
  - `mp4Loop`: Parameter = file path → `ffmpeg -re -stream_loop -1 -i "${filePath}" -c copy -f rtsp rtsp://localhost:${RTSP_PORT}/${MTX_PATH}`
  - `startCamera`: Parameter = camera device → `ffmpeg -f v4l2 -i "${device}" -c:v libx264 -f rtsp rtsp://localhost:${RTSP_PORT}/${MTX_PATH}`
  - `pullStream`: Parameter = upstream URL → `ffmpeg -i "${upstreamUrl}" -c copy -f rtsp rtsp://localhost:${RTSP_PORT}/${MTX_PATH}`

### D5: Path State via Runtime API Polling

- **Decision**: Use the existing polling mechanism to fetch runtime paths (`GET /v3/paths/list`) and display `ready`/`readyTime` as badges in the path list. No new API calls needed.
- **Rationale**: The runtime API already returns `ready: boolean` — the data exists but is not surfaced visually. Adding a colored badge (green=ready, yellow=connecting, gray=offline) requires only UI changes.
- **State mapping**:
  - `source === null && !ready` → offline (gray)
  - `source !== null && !ready` → connecting (yellow)
  - `ready === true` → ready (green)

### D6: Type Extensions Follow OpenAPI, Not Guesswork

- **Decision**: All new `PathConf` fields will be added as optional (`?:`) matching the OpenAPI spec types. No field will be made required.
- **Rationale**: Backward compatibility — existing path configs lack these fields and must continue working. The OpenAPI spec is the source of truth for field types.

## Risks / Trade-offs

- **[UI Complexity] The PathForm already has 840 lines.** Adding two new collapsible sections (stream mode + on-demand publishing) will push it past 1000 lines. → Mitigation: Keep each new section encapsulated (stream mode selector as a self-contained group, on-demand config as an imported component).
- **[Inline Dialogs] The main page (`app/page.tsx`) uses simplified inline dialogs instead of `PathForm`.** New features will only appear in `PathForm`, not the inline version. → Mitigation: Accepted trade-off — the inline dialogs are simplified for quick adds. Full `PathForm` is the canonical editor. Future work could refactor to use `PathForm` exclusively.
- **[Command Security] Allowing arbitrary shell commands in `runOn*` fields is a security risk.** → Mitigation: Display a security warning banner (existing pattern from `forwarding-config.tsx` and `snapshot-config.tsx`). No command validation — MediaMTX executes whatever is configured.
- **[Backend Version] If the MediaMTX version doesn't support these hooks, the UI will show fields that have no effect.** → Mitigation: Fields are always rendered (no version detection). This matches the existing pattern — the UI sends fields and MediaMTX ignores unsupported ones.
