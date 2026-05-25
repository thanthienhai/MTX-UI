## Context

The dashboard already reads configured paths, runtime paths, path defaults, protocol runtime resources, and service URLs from MediaMTX. It also has a basic path list and add/edit/delete flows in `app/page.tsx`, plus protocol runtime tooling in `components/protocol-server-management.tsx`. The current implementation does not yet provide a complete path administration experience for source-type-specific fields, path defaults, runtime comparison, URL actions, reader/session inspection, or import/export workflows.

This change should turn path administration into a coherent operator workflow while reusing the existing MediaMTX client, permission guards, notifications, audit events, polling, and stream player patterns.

## Goals / Non-Goals

**Goals:**
- Provide one path management UI that merges configured path data with runtime path state.
- Support configured path add, edit, replace, and delete operations for normal names, regex names, and `all_others`.
- Support source-specific configuration for publisher, URL-based sources, WHEP, RTP, redirect, and Raspberry Pi Camera sources.
- Expose common source/path options and runtime details including ready state, source identity, tracks, readers, and byte counters.
- Provide per-path URL actions for RTSP, RTSPS, RTMP, HLS, WebRTC, and SRT where enough service configuration is available.
- Provide a dedicated `pathDefaults` screen with edit, apply-to-all, override comparison, reset-to-default, and JSON/YAML import/export.
- Preserve permission-aware behavior for `api`, `read`, `playback`, and runtime kick actions.

**Non-Goals:**
- Do not replace MediaMTX as the source of truth for path configuration or runtime state.
- Do not implement full protocol-specific media playback beyond existing preview/open URL capabilities.
- Do not add server-side persistence for imported defaults; imports must still be applied through MediaMTX path defaults patching.

## Decisions

1. Keep configured and runtime path data separate in state, then join by path name in the UI.

   Configured paths come from `/v3/config/paths/list`, while runtime paths come from `/v3/paths/list`. Keeping both payloads intact avoids losing runtime-only details or config-only paths. The UI can derive a merged row model for display, filtering, sorting, and actions. The alternative was to normalize both responses into one shared model immediately, but that would obscure which fields can be patched and which are runtime-only.

2. Use reusable path form utilities for path config and defaults.

   Path config and path defaults share many fields, including source, common source options, recording options, and reader limits. A shared field registry should define editable fields, labels, source applicability, default reset behavior, and serialization. The alternative was to duplicate add/edit/default forms, but that would create drift and make default comparison fragile.

3. Treat `replace` as an explicit operator action.

   Patch should remain the default edit behavior because it is less destructive and matches existing hot-reload behavior. Replace should be available when the operator intentionally wants the submitted path config to become the full config record. The alternative was to always replace from the form, but that risks clearing fields not represented in the current UI.

4. Represent regex paths and `all_others` as first-class path name modes.

   Path names have special semantics in MediaMTX. The UI should expose normal, regex, and `all_others` modes while preserving the exact serialized name. The alternative was a single free-text field, but it would make validation and operator intent unclear.

5. Generate stream URLs from existing service URL builders and loaded global/path config.

   URL actions should use the dashboard's normalized service URL utilities so deployment base paths and configured endpoints remain consistent. The alternative was hard-coded URL formatting in components, which would duplicate existing normalization logic and break proxy deployments.

6. Keep import/export local to the browser.

   JSON export can use native serialization. YAML support can use a small parser/serializer utility or dependency if the repo accepts one during implementation. Imported content must be validated and previewed before patching `pathDefaults`. The alternative was server-side import/export, but there is no current backend persistence layer for this dashboard.

## Risks / Trade-offs

- Path field coverage can lag MediaMTX releases -> Keep `PathConf` permissive, update OpenAPI contract tests for fields the UI uses, and show unsupported fields in import previews without silently dropping them.
- Replace can remove configuration fields -> Make replace explicit, show a payload preview, and keep patch as the default edit action.
- Runtime readers may map to different protocol kick APIs -> Resolve reader/session type to the matching runtime client where possible and show a clear unsupported action state when no kick endpoint exists.
- URL generation depends on service address configuration -> Show generated URLs only when the needed base URL/address is available and provide copy/open errors through notifications.
- YAML import/export can add dependency risk -> Prefer a narrow utility and tests; if a dependency is required, keep it isolated to the import/export module.
- Applying defaults to all paths can mutate many records -> Require preview/confirmation, use patch operations where possible, audit each affected path or summarize the batch, and preserve rollback information in notifications/audit payloads.

## Migration Plan

1. Extend typed path models, URL helpers, and contract checks for fields used by the UI.
2. Add path config/default mapping utilities and tests.
3. Build the Path Management UI by replacing the current limited path cards/forms behind the existing Paths tab.
4. Build the Path Defaults UI as a dedicated section reachable from the Paths/config area.
5. Add dashboard behavior tests for path lifecycle, runtime rows, URL actions, defaults comparison, import/export, and permission-disabled states.
6. Roll back by hiding the new components and restoring the previous path list/add/edit/delete cards while keeping client additions in place.

## Open Questions

- The exact field set for Raspberry Pi Camera, WHEP, redirect, and RTP source options should be confirmed against the target MediaMTX version before implementation finalizes the field registry.
- YAML import/export format should be either strict MediaMTX-compatible YAML or a dashboard-friendly YAML representation of the same `pathDefaults` object; implementation should choose one and document it in UI tests.
