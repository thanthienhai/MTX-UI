## ADDED Requirements

### Requirement: Protocol Administrative Feedback
The dashboard SHALL apply existing administrative feedback behavior to protocol configuration saves and protocol runtime actions.

#### Scenario: Protocol configuration save succeeds
- **WHEN** an authorized operator saves a protocol server configuration patch
- **THEN** the dashboard MUST show a non-blocking success notification and append an audit entry with timestamp, actor when known, action, target, payload summary, and success result.

#### Scenario: Protocol configuration save fails
- **WHEN** a protocol server configuration patch fails with a `MediaMtxApiError`
- **THEN** the dashboard MUST show a non-blocking error notification using the user-safe message and append an audit entry with failure result and error summary.

#### Scenario: Protocol runtime kick succeeds
- **WHEN** an authorized operator kicks an RTSP session, RTMP connection, WebRTC session, or SRT connection
- **THEN** the dashboard MUST show a non-blocking success notification and append an audit entry for the kicked resource.

#### Scenario: Protocol runtime kick fails
- **WHEN** a protocol runtime kick action fails with a `MediaMtxApiError`
- **THEN** the dashboard MUST show a non-blocking error notification using the user-safe message and append an audit entry with failure result and error summary.

### Requirement: Protocol Permission Guards
The dashboard SHALL gate protocol server configuration and runtime mutation actions by MediaMTX action permissions.

#### Scenario: User lacks API permission for protocol configuration
- **WHEN** a user lacks `api` permission
- **THEN** protocol configuration edit controls and runtime kick actions MUST be hidden or disabled and direct handlers MUST refuse execution.

#### Scenario: User lacks read permission for playback helpers
- **WHEN** a user lacks `read` permission
- **THEN** protocol read URL helpers and player entry points MUST be hidden or disabled where they would expose stream read workflows.

#### Scenario: User lacks publish permission for publish helpers
- **WHEN** a user lacks `publish` permission
- **THEN** protocol publish URL helpers MUST be hidden or disabled where they would expose stream publish workflows.
