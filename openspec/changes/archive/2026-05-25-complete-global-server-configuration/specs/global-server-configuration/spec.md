## ADDED Requirements

### Requirement: Global Configuration Read and Edit
The dashboard SHALL provide a Vietnamese Global Server Configuration view backed by the MediaMTX Control API.

#### Scenario: Global config loads
- **WHEN** a user with `api` permission opens the global server configuration view
- **THEN** the dashboard MUST call `GET /v3/config/global/get` and render the returned global configuration in editable controls.

#### Scenario: Global config load fails
- **WHEN** the global config request fails
- **THEN** the dashboard MUST show a Vietnamese error state with a retry action and MUST NOT use a blocking browser alert.

#### Scenario: User lacks API permission
- **WHEN** the current user lacks `api` permission
- **THEN** the dashboard MUST disable global configuration editing and MUST prevent patch handlers from calling MediaMTX.

### Requirement: General Settings Fields
The dashboard SHALL expose requested MediaMTX general global settings as editable fields.

#### Scenario: General fields render
- **WHEN** global configuration data is available
- **THEN** the dashboard MUST render controls for `logLevel`, `logDestinations`, `logStructured`, `logFile`, `sysLogPrefix`, `dumpPackets`, `readTimeout`, `writeTimeout`, `writeQueueSize`, `udpMaxPayloadSize`, and `udpReadBufferSize`.

#### Scenario: General fields are changed
- **WHEN** a user changes one or more general settings
- **THEN** the dashboard MUST track only changed fields as dirty and prepare a patch payload containing only those changed keys.

### Requirement: Global Hook Fields
The dashboard SHALL expose requested MediaMTX global hook settings as editable fields.

#### Scenario: Hook fields render
- **WHEN** global configuration data is available
- **THEN** the dashboard MUST render controls for `runOnConnect`, `runOnConnectRestart`, and `runOnDisconnect`.

#### Scenario: Hook fields are changed
- **WHEN** a user changes one or more global hook settings
- **THEN** the dashboard MUST track only changed hook fields as dirty and prepare a patch payload containing only those changed keys.

### Requirement: Hot Reload Patch Preview
The dashboard SHALL require a payload preview step before applying global configuration patches.

#### Scenario: Preview is requested
- **WHEN** a user chooses to save changed global configuration fields
- **THEN** the dashboard MUST show the exact JSON payload that will be sent to `PATCH /v3/config/global/patch`.

#### Scenario: Patch is applied
- **WHEN** the user confirms a previewed payload
- **THEN** the dashboard MUST send `PATCH /v3/config/global/patch` with only the previewed fields.

#### Scenario: No fields changed
- **WHEN** a user tries to save a section with no dirty fields
- **THEN** the dashboard MUST show a Vietnamese non-blocking informational message and MUST NOT call the patch endpoint.

### Requirement: Patch Feedback and Field Errors
The dashboard SHALL display localized success and failure feedback for global configuration patches.

#### Scenario: Patch succeeds
- **WHEN** MediaMTX accepts a global configuration patch
- **THEN** the dashboard MUST show a Vietnamese success notification, update the original snapshot, clear dirty state for patched fields, and update the last-synced timestamp.

#### Scenario: Patch fails with field errors
- **WHEN** MediaMTX rejects a patch with field-specific error details
- **THEN** the dashboard MUST show inline errors below the matching fields and a Vietnamese non-blocking error notification.

#### Scenario: Patch fails without field errors
- **WHEN** MediaMTX rejects a patch without field-specific details
- **THEN** the dashboard MUST show a Vietnamese non-blocking error notification with a user-safe error message.

### Requirement: Global Configuration Audit Trail
The dashboard SHALL record audit log entries for global configuration patch attempts.

#### Scenario: Patch attempt succeeds
- **WHEN** a global configuration patch succeeds
- **THEN** the dashboard MUST append an audit entry with actor when known, action, target `global`, payload summary, and success result.

#### Scenario: Patch attempt fails
- **WHEN** a global configuration patch fails
- **THEN** the dashboard MUST append an audit entry with actor when known, action, target `global`, payload summary, failure result, and error summary.
