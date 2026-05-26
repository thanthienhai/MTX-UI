## ADDED Requirements

### Requirement: Dedicated Hooks management tab

The dashboard SHALL provide a dedicated "Hooks" tab in the main navigation for managing all MediaMTX hooks.

#### Scenario: Hooks tab is available

- **WHEN** the user is logged in and views the dashboard
- **THEN** there SHALL be a "Hooks" tab in the main tab navigation bar alongside other tabs
- **AND** the tab SHALL have a representative icon and label "Hooks"

#### Scenario: Hooks tab loads on click

- **WHEN** the user clicks the "Hooks" tab
- **THEN** the dashboard SHALL display the hooks management view
- **AND** the view SHALL display global hooks and path-level hooks in separate sections

### Requirement: Global hooks section

The dashboard SHALL display and allow editing of global hooks within the Hooks tab.

#### Scenario: Global hooks are displayed

- **WHEN** the Hooks tab is active
- **THEN** the dashboard SHALL fetch global config from `GET /v3/config/global/get`
- **AND** display `runOnConnect`, `runOnConnectRestart`, `runOnDisconnect` fields in a "Global Hooks" card

#### Scenario: Global hook field is edited

- **WHEN** the user modifies a global hook field
- **THEN** the field SHALL update locally immediately
- **AND** changed fields SHALL be visually marked as "unsaved"

#### Scenario: Global hooks are saved

- **WHEN** the user clicks "Save" for global hooks
- **THEN** the dashboard SHALL compute dirty fields and call `PATCH /v3/config/global/patch` with only changed fields
- **AND** show a success/failure notification

### Requirement: Path-level hooks section with path selector

The dashboard SHALL provide a path selector to view and edit hooks for a specific configured path.

#### Scenario: Path selector is displayed

- **WHEN** the Hooks tab is active
- **THEN** the dashboard SHALL load all configured paths from `GET /v3/config/paths/list`
- **AND** display a path selector (dropdown or list) to choose which path to manage

#### Scenario: Path hooks are loaded on selection

- **WHEN** the user selects a path from the path selector
- **THEN** the dashboard SHALL fetch path config from `GET /v3/config/paths/get/{name}`
- **AND** display all hook fields for that path grouped by lifecycle category

#### Scenario: No paths configured

- **WHEN** there are no configured paths
- **THEN** the dashboard SHALL show an empty state message: "Chưa có path nào. Tạo path trước để cấu hình path hooks."

### Requirement: Path hooks are grouped by lifecycle category

The dashboard SHALL organize path-level hook fields into logical categories for clarity.

#### Scenario: Lifecycle hooks group

- **WHEN** path hooks are displayed for a selected path
- **THEN** the dashboard SHALL group `runOnInit`, `runOnInitRestart`, `runOnReady`, `runOnReadyRestart`, `runOnNotReady` under a "Lifecycle" section
- **AND** display each hook with its command editor

#### Scenario: On-Demand hooks group

- **WHEN** path hooks are displayed for a selected path
- **THEN** the dashboard SHALL group `runOnDemand`, `runOnDemandRestart`, `runOnDemandStartTimeout`, `runOnDemandCloseAfter`, `runOnUnDemand` under an "On-Demand" section
- **AND** display each hook with its command editor

#### Scenario: Read Event hooks group

- **WHEN** path hooks are displayed for a selected path
- **THEN** the dashboard SHALL group `runOnRead`, `runOnReadRestart`, `runOnUnread` under a "Read Events" section
- **AND** display each hook with its command editor

#### Scenario: Recording hooks group

- **WHEN** path hooks are displayed for a selected path
- **THEN** the dashboard SHALL group `runOnRecordSegmentCreate`, `runOnRecordSegmentComplete` under a "Recording" section
- **AND** display each hook with its command editor

### Requirement: Path hooks are saved per-path

The dashboard SHALL save path-level hook changes via the existing path PATCH API.

#### Scenario: Path hooks are saved

- **WHEN** the user modifies path hook fields and clicks "Save"
- **THEN** the dashboard SHALL compute dirty fields and call `PATCH /v3/config/paths/patch/{name}` with only changed hook fields
- **AND** show a success/failure notification

#### Scenario: Path selector resets dirty state

- **WHEN** the user selects a different path while there are unsaved changes
- **THEN** the dashboard SHALL warn: "Bạn có thay đổi chưa lưu. Tiếp tục sẽ mất các thay đổi này."
- **AND** allow the user to cancel or discard

### Requirement: Command lifecycle status display

The dashboard SHALL show the runtime status of hook commands when runtime path data is available.

#### Scenario: Command lifecycle badge is shown

- **WHEN** a path is selected that has active hook commands and runtime data is available
- **THEN** the dashboard SHALL display a `CommandLifecycleBadge` next to each active hook
- **AND** the badge SHALL indicate: running, starting, idle, stopped, failed, or unknown state
