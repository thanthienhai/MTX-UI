## 1. HookCommandEditor Component

- [x] 1.1 Create `components/hook-command-editor.tsx` with core props interface (`value`, `onChange`, `hookName`, `envVars?`, `templates?`, `restartEnabled?`, `onRestartChange?`, `pathName?`)
- [x] 1.2 Implement multiline `<Textarea>` with monospace font (`min-h-[80px] font-mono text-xs`) and placeholder text
- [x] 1.3 Implement collapsible env var helper panel with click-to-insert at cursor position via `textarea.selectionStart`
- [x] 1.4 Implement optional template selector dropdown with `TemplateDef[]` interface and dynamic field rendering
- [x] 1.5 Implement security warning banner (amber/AlertTriangle) shown when command is non-empty
- [x] 1.6 Implement optional restart toggle switch (for hooks with `*Restart` boolean)
- [x] 1.7 Implement read-only mode when `disabled` prop is set
- [x] 1.8 Support different env var sets per hook context (global, lifecycle, on-demand, read-event, recording)

## 2. HooksView Page Component

- [x] 2.1 Create `components/hooks-view.tsx` as the main Hooks tab container
- [x] 2.2 Implement Global Hooks card with `HookCommandEditor` for `runOnConnect`, `runOnConnectRestart`, `runOnDisconnect`
- [x] 2.3 Implement path selector dropdown that loads configured paths from `GET /v3/config/paths/list`
- [x] 2.4 Implement path config loading on selection via `GET /v3/config/paths/get/{name}`
- [x] 2.5 Implement dirty state tracking and unsaved-changes warning on path switch
- [x] 2.6 Implement save logic per section (global via `patchGlobalConfig`, path via `updatePath`)
- [x] 2.7 Implement loading/empty/error states for path data
- [x] 2.8 Integrate `CommandLifecycleBadge` for runtime command status display

## 3. Path Hook Sections (by Lifecycle Category)

- [x] 3.1 Implement "Lifecycle" section: `runOnInit` + `runOnInitRestart`, `runOnReady` + `runOnReadyRestart`, `runOnNotReady`
- [x] 3.2 Implement "On-Demand" section: `runOnDemand` + `runOnDemandRestart` + `runOnDemandStartTimeout` + `runOnDemandCloseAfter`, `runOnUnDemand`
- [x] 3.3 Implement "Read Events" section: `runOnRead` + `runOnReadRestart`, `runOnUnread`
- [x] 3.4 Implement "Recording" section: `runOnRecordSegmentCreate`, `runOnRecordSegmentComplete`
- [x] 3.5 Add command lifecycle badges to each active hook section

## 4. Tab Integration in Dashboard

- [x] 4.1 Add `TabsTrigger value="hooks"` with icon in `app/page.tsx` TabsList
- [x] 4.2 Add `TabsContent value="hooks"` rendering `<HooksView>` with permissions/username/auditEvent props
- [x] 4.3 Remove "Global hooks" card from `components/global-config-view.tsx`
- [x] 4.4 Remove `hookKeys` array and related preview/patch logic for hooks from global-config-view.tsx

## 5. Integrate HookCommandEditor into Existing Components

- [x] 5.1 Update `components/forwarding-config.tsx` to use `HookCommandEditor` for its command textarea while retaining protocol selector and URL input
- [x] 5.2 Update `components/on-demand-config.tsx` to use `HookCommandEditor` for `runOnDemand` and `runOnUnDemand` textareas while retaining template system
- [x] 5.3 Update `components/path-management/path-form.tsx` to use `HookCommandEditor` for `runOnInit` textarea

## 6. Quality & Polish

- [x] 6.1 — Build passes clean
- [x] 6.2 — Hook fields can be read, edited, and saved
- [x] 6.3 — Global hooks migrated to Hooks tab, removed from GlobalConfigView
- [x] 6.4 — ForwardingConfig and OnDemandConfig use HookCommandEditor
- [x] 6.5 — Permission guard via `permissions.api !== false`
- [x] 6.6 — Audit events for global patch and path patch
- [x] 6.7 — Empty states implemented (no paths, no hooks, loading)
