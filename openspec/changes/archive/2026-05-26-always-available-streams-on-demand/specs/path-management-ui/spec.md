## ADDED Requirements

### Requirement: Path config payload includes new hook fields

The dashboard SHALL include all configured `runOn*` fields when building path add/patch/replace payloads.

#### Scenario: On-demand fields are included in payload

- **WHEN** an operator configures on-demand publishing fields and saves
- **THEN** the dashboard MUST include `runOnDemand`, `runOnDemandRestart`, `runOnUnDemand`, `runOnDemandStartTimeout`, and `runOnDemandCloseAfter` in the API call payload

#### Scenario: Always-available fields are included in payload

- **WHEN** an operator configures "Always Pull" mode with a `runOnInit` command
- **THEN** the dashboard MUST include `runOnInit` and `runOnInitRestart` in the API call payload

#### Scenario: Source on-demand mode syncs with stream mode selector

- **WHEN** an operator changes the stream mode selector
- **THEN** the dashboard MUST update the `sourceOnDemand` field accordingly (`true` for "On-demand pull", `false` for "Pull from upstream" and "Always pull")

### Requirement: Path list shows stream mode

The dashboard SHALL indicate the stream mode in the path list or detail view.

#### Scenario: Stream mode is indicated in path actions

- **WHEN** an operator views a path's details
- **THEN** the dashboard MUST show the effective stream mode based on `source`, `sourceOnDemand`, and `runOnInit`/`runOnDemand` fields

## MODIFIED Requirements

### Requirement: Path source configuration is supported

**Note:** Extended from original requirement — the source configuration now includes stream mode semantics alongside source type selection.

#### Scenario: Publisher source is selected

- **WHEN** an operator selects `publisher` as the source
- **THEN** the dashboard MUST save `source` as `publisher` and show common source/path options
- **AND** the dashboard MUST set the stream mode to "Publisher mode" by default

#### Scenario: URL-based source is selected

- **WHEN** an operator selects RTSP, RTSPS, RTMP, RTMPS, HLS, SRT, or WHEP source mode
- **THEN** the dashboard MUST allow entering the source URL and save it through the `source` field
- **AND** the dashboard MUST set the stream mode to "Pull from upstream" by default
- **AND** the operator MAY change the stream mode to "On-demand pull" or "Always pull"
