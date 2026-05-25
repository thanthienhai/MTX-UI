## ADDED Requirements

### Requirement: Non-Blocking Notifications
The dashboard SHALL use toast or notification UI for user feedback instead of browser `alert()`.

#### Scenario: Administrative action succeeds
- **WHEN** a user completes a configuration update, kick, delete, JWKS refresh, or comparable administrative action
- **THEN** the dashboard MUST show a success notification without blocking the page.

#### Scenario: Administrative action fails
- **WHEN** a user action fails with a `MediaMtxApiError`
- **THEN** the dashboard MUST show an error notification using the error wrapper's user-safe message.

#### Scenario: Alert usage is checked
- **WHEN** implementation is verified
- **THEN** dashboard code MUST NOT call browser `alert()` for MediaMTX operation feedback.

### Requirement: API-Backed Module States
Each dashboard module that reads MediaMTX data SHALL render loading, empty, and error states.

#### Scenario: Module data is loading
- **WHEN** a module starts fetching MediaMTX data
- **THEN** the module MUST show a loading state that keeps the layout stable.

#### Scenario: Module has no records
- **WHEN** a successful API response contains no items for the module
- **THEN** the module MUST show an empty state with controls appropriate to that module.

#### Scenario: Module fetch fails
- **WHEN** a module cannot load its MediaMTX data
- **THEN** the module MUST show an error state and provide a retry or refresh action where the operation is allowed.

### Requirement: Dashboard Audit Log
The dashboard SHALL record audit log entries for administrative operations.

#### Scenario: Administrative mutation succeeds
- **WHEN** a user changes configuration, adds or deletes a path, kicks a connection or session, deletes a recording segment, or refreshes JWKS
- **THEN** the dashboard MUST append an audit entry containing timestamp, actor when known, action, target, payload summary, and success result.

#### Scenario: Administrative mutation fails
- **WHEN** an administrative mutation fails
- **THEN** the dashboard MUST append an audit entry containing timestamp, actor when known, action, target, payload summary, failure result, and error summary.

#### Scenario: Audit log is displayed
- **WHEN** a user opens the audit log view or panel
- **THEN** the dashboard MUST display recent audit entries in reverse chronological order.

### Requirement: MediaMTX Action Permission Guards
The dashboard SHALL gate views and actions by MediaMTX action permissions: `api`, `metrics`, `pprof`, `publish`, `read`, and `playback`.

#### Scenario: User lacks API permission
- **WHEN** a user lacks `api` permission
- **THEN** configuration and Control API administrative actions MUST be hidden or disabled and action handlers MUST refuse execution.

#### Scenario: User lacks metrics or pprof permission
- **WHEN** a user lacks `metrics` or `pprof` permission
- **THEN** the corresponding metrics or pprof links, panels, and fetch actions MUST be hidden or disabled.

#### Scenario: User lacks stream permissions
- **WHEN** a user lacks `publish`, `read`, or `playback` permission
- **THEN** controls that require the missing stream action MUST be hidden or disabled and direct handler execution MUST be rejected.

### Requirement: Configurable Refresh and Polling
The dashboard SHALL provide configurable refresh and polling behavior for MediaMTX runtime modules.

#### Scenario: Manual refresh is requested
- **WHEN** a user activates refresh for a module
- **THEN** the dashboard MUST reload that module's data and update loading or error state accordingly.

#### Scenario: Polling is enabled
- **WHEN** polling is enabled for a module
- **THEN** the dashboard MUST refresh that module on the configured interval while the module remains mounted and visible.

#### Scenario: Polling is disabled or interval changes
- **WHEN** polling is disabled or its interval is changed
- **THEN** the dashboard MUST stop the old interval and apply the new polling configuration without leaking timers.
