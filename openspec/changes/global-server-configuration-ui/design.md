## Context

The dashboard currently has no UI for editing the MediaMTX global server configuration. The existing "Server" tab in `app/page.tsx` stores protocol toggle state locally via `useState` without persisting to the backend (no `patchGlobalConfig` calls exist). A "Control API Snapshot" card displays the current global config read-only.

The `GlobalConf` type and `getGlobalConfig()`/`patchGlobalConfig()` methods already exist in `lib/mediamtx-api.ts` but are unused. The UI component library (`components/ui/`) provides Card, Input, Select, Switch, Dialog, Button, Label — all ready for form building. Notifications and permission guards (`useNotifications`, `requireMediaMtxAction`) are established patterns.

## Goals / Non-Goals

**Goals:**
- Provide a dedicated global configuration view that reads `GlobalConf` from the Control API on mount and renders editable fields for general settings and global hooks.
- Support hot-reload patching via `PATCH /v3/config/global/patch` with per-field granularity.
- Show a payload preview before applying changes so operators can verify the exact JSON being sent.
- Display per-field success/failure feedback after patch, including field-level error messages from the API.
- Apply `api` permission guard to all view and edit operations.
- Integrate notifications, the audit log, and loading/error states using existing dashboard patterns.

**Non-Goals:**
- Server restart or configuration reload orchestration (MediaMTX applies patches hot by default).
- Validation beyond what the API returns (no client-side schema validation beyond type safety).
- Editing `authInternalUsers` via this UI (complex nested array editing — defer to a dedicated auth UI).

## Decisions

1. **Dedicated "Configuration" tab rather than expanding the Server tab.** The existing Server tab mixes protocol toggles with read-only snapshot data. Adding the full editable global config form there would make it overly long and mix concerns. A new "Configuration" tab keeps the UI focused and follows the existing tab-navigation pattern.

2. **Single-page inline form (not a Dialog).** Unlike path editing (which uses a Dialog for a single item), the global config is a single document that users will iteratively tweak and patch. An always-visible form with real-time editing feels more natural for a settings page. Use Cards with sections, similar to the existing Server tab layout.

3. **Per-field patch (not whole-form submit).** Sending the entire form as one patch risks overwriting concurrent changes made by other dashboard users or external tools. Instead, each field group (General, Logging, Hooks) has its own Save button that patches only its fields. This maps to the user's "patch từng field" requirement.

4. **Payload preview in a collapsible code block.** Before each save, show the exact JSON payload that will be sent. This gives operators confidence about what's being changed, especially for destructive operations. Use a read-only `<pre>` block with syntax-highlighted JSON, collapsed by default.

5. **Field-level error display via inline messages.** When the API returns field-specific errors (e.g., invalid log level value), display the error message directly below the offending field rather than only in a toast. Use `<p className="text-sm text-red-500">` pattern already established in the codebase.

6. **Existing `patchGlobalConfig` method is sufficient.** No new API client methods are needed. The existing `getGlobalConfig()` fetches the full config for display, and `patchGlobalConfig(Partial<GlobalConf>)` applies changes. Field-level patching is achieved by sending only the changed fields.

## Risks / Trade-offs

- **[Race condition]** Rapid patching of different field groups could produce PATCH conflicts. → Mitigation: Disable all save buttons while any patch is in flight; show a brief cooldown.
- **[Partial update vs full snapshot]** The form starts with a full GET snapshot but only sends partial PATCHes. If another client changes a field the user hasn't touched, their form will show stale data. → Mitigation: Add a "Refresh from server" button and show a "last synced" timestamp.
- **[Field coverage gap]** The existing `GlobalConf` interface only covers a subset of all possible MediaMTX global config fields (no logging fields like `logLevel`, `logDestinations`, `logFile`, `sysLogPrefix`, etc., and no hook fields like `runOnConnect`). → Mitigation: Extend the `GlobalConf` interface in `lib/mediamtx-api.ts` with the missing fields from the MediaMTX OpenAPI spec.
