## ADDED Requirements

### Requirement: Stream mode selector distinguishes availability behavior

The dashboard SHALL provide a dedicated "Stream Mode" selector in the path add/edit form that explicitly labels each mode's availability behavior.

#### Scenario: Stream mode is shown in path add form

- **WHEN** an operator opens the path add form
- **THEN** the dashboard MUST display a "Stream Mode" section with the following selectable modes: "Publisher mode", "Pull from upstream", "On-demand pull", "Always pull"

#### Scenario: Publisher mode is selected

- **WHEN** an operator selects "Publisher mode" as the stream mode
- **THEN** the dashboard MUST set `source` to `"publisher"` and disable the source URL input
- **AND** the dashboard MUST show a note: "Wait for external publisher (RTSP, RTMP, WebRTC...)"

#### Scenario: Pull from upstream is selected

- **WHEN** an operator selects "Pull from upstream" as the stream mode
- **THEN** the dashboard MUST show a source URL input and set `sourceOnDemand` to `false`
- **AND** the dashboard MUST show a note: "Source is always connected — persists even without readers"

#### Scenario: On-demand pull is selected

- **WHEN** an operator selects "On-demand pull" as the stream mode
- **THEN** the dashboard MUST show a source URL input and set `sourceOnDemand` to `true`
- **AND** the dashboard MUST show the `sourceOnDemandStartTimeout` and `sourceOnDemandCloseAfter` fields
- **AND** the dashboard MUST show a note: "Source connects only when a reader requests the stream"

#### Scenario: Always pull is selected

- **WHEN** an operator selects "Always pull" as the stream mode
- **THEN** the dashboard MUST set `sourceOnDemand` to `false`
- **AND** the dashboard MUST show a command input for `runOnInit` with an optional restart toggle
- **AND** the dashboard MUST show a note: "Source process starts automatically and stays running"

### Requirement: Static source with runOnInit command

The dashboard SHALL allow operators to configure a `runOnInit` command that starts a static source process when the path is initialized.

#### Scenario: runOnInit command is configured

- **WHEN** an operator enters a command in the `runOnInit` field and saves the path
- **THEN** the dashboard MUST include `runOnInit` and `runOnInitRestart` in the path patch/add payload

#### Scenario: runOnInit restart toggle is used

- **WHEN** an operator toggles `runOnInitRestart` on
- **THEN** the dashboard MUST set `runOnInitRestart: true` in the path payload
- **AND** the dashboard MUST show a note: "Command will restart automatically if it exits"

### Requirement: Path state indicators show offline/connecting/ready

The dashboard SHALL display the runtime state of each path in the path list using color-coded badges.

#### Scenario: Path is ready

- **WHEN** a runtime path has `ready: true`
- **THEN** the dashboard MUST show a green "Ready" badge with the `readyTime` timestamp as tooltip

#### Scenario: Path has source but is not ready

- **WHEN** a runtime path has a non-null `source` but `ready: false`
- **THEN** the dashboard MUST show a yellow "Connecting" badge

#### Scenario: Path has no source and is not ready

- **WHEN** a runtime path has `source: null` and `ready: false`
- **THEN** the dashboard MUST show a gray "Offline" badge
