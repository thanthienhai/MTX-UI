## Context

MediaMTX's hook system allows running external commands when specific events occur (connect, disconnect, path init, new reader, etc.). The current dashboard UI for hooks is fragmented:

- **Global hooks** (3 fields) live in `GlobalConfigView` using simple single-line `Input` components
- **Path hooks** span 5+ UI patterns across `path-form.tsx`, `forwarding-config.tsx`, `on-demand-config.tsx`, and `remote-upload-config.tsx`
- **5 path hook fields** (`runOnNotReady`, `runOnRead`, `runOnReadRestart`, `runOnUnread`, `runOnRecordSegmentCreate`) have **zero UI**
- **No reusable command editor** exists — each component builds its own textarea, env var helper, and security warning from scratch

All backend types (`PathConf`, `GlobalConf`) and API methods (`updatePath`, `patchGlobalConfig`) are already in place. Implementation is purely UI-layer.

## Goals / Non-Goals

**Goals:**
- Create a dedicated "Hooks" tab in the dashboard navigation
- Build a reusable `HookCommandEditor` component that provides: multiline textarea, env var helper (with click-to-insert), template snippets, security warning, restart toggle
- Surface ALL 14 path-level hook fields in the Hooks tab, organized by lifecycle category
- Move global hooks from `GlobalConfigView` to the Hooks tab
- Support per-path hook editing via path selector dropdown
- Integrate `HookCommandEditor` into existing `ForwardingConfig` and `OnDemandConfig` components

**Non-Goals:**
- Backend changes (no API client changes needed — types and methods already support all hooks)
- Hook test runner (will add placeholder UI but full implementation requires a backend dashboard)
- Removing existing hook-related UIs from path-form.tsx (editing hooks during path creation/editing is still valuable)
- Re-writing the ForwardingConfig or OnDemandConfig template systems — they remain as specialized UIs but their textarea delegates to HookCommandEditor

## Decisions

### Decision 1: New "Hooks" tab vs. expanding existing tabs
**Chosen: New dedicated tab.**

- **Alternatives considered:**
  - Expand Global Config tab — too crowded, mixes global and path concerns
  - Expand Paths tab — already complex with path list + add/edit dialog
  - Sub-tabs under a "Cấu hình" section — adds UI complexity
- **Rationale**: Hooks are a cross-cutting concern (global + per-path) with enough UI surface (14+ fields + command editor) to warrant their own tab. This follows the same pattern as Recording, which also blends global settings + per-path data.

### Decision 2: Reusable HookCommandEditor component
**Chosen: Build a self-contained component with env var click-to-insert.**

- **Core design:**
  - Controlled component — receives `value`/`onChange` like any input
  - Renders a styled `Textarea` (shadcn/ui) with monospace font
  - Collapsible env var panel — clicking a variable inserts `$VAR_NAME` at cursor position via `textarea.selectionStart`
  - Optional template selector for hooks that have presets
  - Optional restart toggle for hooks with `*Restart` boolean
  - Security warning banner shown when command is non-empty
- **Why not reuse existing inline patterns?**: Each current component duplicates env var UI, warning styling, and textarea patterns. A single component eliminates duplication and ensures consistency.

### Decision 3: Path hooks in Hooks tab vs. only in path form
**Chosen: Both — Hooks tab for overview + path form for inline editing.**

- The Hooks tab provides a centralized view for managing all hooks of a selected path
- The path edit dialog retains its existing hook sections for convenience during path configuration
- Both surfaces write to the same API (`PATCH /v3/config/paths/patch/{name}`)
- No sync issues because both read from the same source of truth (API)

### Decision 4: Path selector implementation
**Chosen: Dropdown selector inside the Hooks tab content.**

- Load configured paths on mount from `GET /v3/config/paths/list`
- Dropdown shows path names with live status badge (LIVE/idle)
- On selection, fetch path config from `GET /v3/config/paths/get/{name}`
- Render hook fields grouped by category
- Dirty state warning when switching paths with unsaved changes

### Decision 5: Component tree structure

```
Tabs (app/page.tsx)
└── TabsContent value="hooks"
    └── HooksView (new)
        ├── Global Hooks Card
        │   └── HookCommandEditor × 3 (runOnConnect, runOnConnectRestart switch, runOnDisconnect)
        │   └── [Save button] → patchGlobalConfig()
        │
        └── Path Hooks Card
            ├── PathSelector (dropdown)
            │
            ├── Lifecycle Section
            │   ├── HookCommandEditor: runOnInit + runOnInitRestart
            │   ├── HookCommandEditor: runOnReady + runOnReadyRestart
            │   └── HookCommandEditor: runOnNotReady
            │
            ├── On-Demand Section
            │   ├── HookCommandEditor: runOnDemand + runOnDemandRestart
            │   ├── [Timeouts: startTimeout, closeAfter]
            │   ├── HookCommandEditor: runOnUnDemand
            │   └── [Template selector if specialized UI needed]
            │
            ├── Read Events Section
            │   ├── HookCommandEditor: runOnRead + runOnReadRestart
            │   └── HookCommandEditor: runOnUnread
            │
            └── Recording Section
                ├── HookCommandEditor: runOnRecordSegmentCreate
                └── HookCommandEditor: runOnRecordSegmentComplete
                └── [Remote Upload config reference]
```

## Risks / Trade-offs

- **[Risk]** Moving global hooks from GlobalConfigView to Hooks tab may confuse existing users.
  → **Mitigation**: Keep the original fields visible during transition. Add a description banner: "Global hooks đã được chuyển sang tab Hooks."

- **[Risk]** The Hooks tab may feel empty when no paths are configured.
  → **Mitigation**: Show empty state with CTA to create a path. Show at minimum the Global Hooks card.

- **[Risk]** Duplicate hook editors (Hooks tab + path-form dialog) could lead to confusion.
  → **Mitigation**: Both edit the same backend data. The Hooks tab is the "full view"; path-form is the "quick edit". Document this pattern.

- **[Risk]** HookCommandEditor component might become bloated with too many features.
  → **Mitigation**: Keep the component focused on text editing + env vars. Templates are optional props; restart toggle is optional. The component degrades gracefully when optional props are omitted.

- **[Trade-off]** Showing all 14 hook fields at once may overwhelm users.
  → **Mitigation**: Group by lifecycle category with collapsed sections. Each section can be expanded independently. Most hooks will be empty (not configured) by default.

## Open Questions

1. Should the "Hooks" tab be hidden when `api` permission is denied? (Global hooks need `api` to PATCH, but viewing could be read-only)
2. Should path-level hooks be rendered for ALL configured paths, or only for the selected path? (Both have merit — "all paths" is more complex but more powerful)
3. Should `ForwardingConfig` and `OnDemandConfig` be fully replaced by HookCommandEditor, or keep their template UIs as enhanced wrappers?
