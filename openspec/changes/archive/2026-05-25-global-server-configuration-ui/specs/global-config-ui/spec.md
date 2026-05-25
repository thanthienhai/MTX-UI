## ADDED Requirements

### Requirement: Global Configuration Read and Edit
The dashboard SHALL provide a UI to read and edit the MediaMTX global server configuration via the Control API.

#### Scenario: Global configuration is loaded on mount
- **WHEN** the user navigates to the global configuration view
- **THEN** the dashboard MUST fetch the full `GlobalConf` from `GET /v3/config/global/get` and populate the form fields.

#### Scenario: Global configuration is patched
- **WHEN** the user modifies one or more fields and triggers a save
- **THEN** the dashboard MUST call `PATCH /v3/config/global/patch` with a `Partial<GlobalConf>` payload containing only the changed fields.

#### Scenario: API permission is missing
- **WHEN** the user lacks the `api` permission
- **THEN** the dashboard MUST hide or disable the global configuration view and refuse edit actions.

### Requirement: General Settings Fields
The dashboard SHALL render editable form fields for the following general server configuration settings.

#### Scenario: Log level is configured
- **WHEN** the user opens the global configuration form
- **THEN** the dashboard MUST render a `logLevel` field with values: `"error"`, `"warn"`, `"info"`, `"debug"`.

#### Scenario: Log destinations are configured
- **WHEN** the user opens the global configuration form
- **THEN** the dashboard MUST render a `logDestinations` field as a multi-select or comma-separated input for allowed values: `"stdout"`, `"file"`, `"syslog"`.

#### Scenario: Structured logging is toggled
- **WHEN** the user opens the global configuration form
- **THEN** the dashboard MUST render a `logStructured` toggle switch (boolean).

#### Scenario: Log file path is configured
- **WHEN** the user opens the global configuration form
- **THEN** the dashboard MUST render a `logFile` text input for the log file path.

#### Scenario: Syslog prefix is configured
- **WHEN** the user opens the global configuration form
- **THEN** the dashboard MUST render a `sysLogPrefix` text input for the syslog prefix string.

#### Scenario: Packet dump toggle is configured
- **WHEN** the user opens the global configuration form
- **THEN** the dashboard MUST render a `dumpPackets` toggle switch (boolean).

#### Scenario: Read timeout is configured
- **WHEN** the user opens the global configuration form
- **THEN** the dashboard MUST render a `readTimeout` numeric input (in seconds).

#### Scenario: Write timeout is configured
- **WHEN** the user opens the global configuration form
- **THEN** the dashboard MUST render a `writeTimeout` numeric input (in seconds).

#### Scenario: Write queue size is configured
- **WHEN** the user opens the global configuration form
- **THEN** the dashboard MUST render a `writeQueueSize` numeric input (packet count).

#### Scenario: UDP max payload size is configured
- **WHEN** the user opens the global configuration form
- **THEN** the dashboard MUST render a `udpMaxPayloadSize` numeric input (in bytes).

#### Scenario: UDP read buffer size is configured
- **WHEN** the user opens the global configuration form
- **THEN** the dashboard MUST render a `udpReadBufferSize` numeric input (in bytes).

### Requirement: Global Hook Fields
The dashboard SHALL render editable fields for global MediaMTX hooks.

#### Scenario: On-connect hook is configured
- **WHEN** the user opens the global configuration form
- **THEN** the dashboard MUST render a `runOnConnect` text input for the connect hook command.

#### Scenario: On-connect restart toggle is configured
- **WHEN** the user opens the global configuration form
- **THEN** the dashboard MUST render a `runOnConnectRestart` toggle switch (boolean).

#### Scenario: On-disconnect hook is configured
- **WHEN** the user opens the global configuration form
- **THEN** the dashboard MUST render a `runOnDisconnect` text input for the disconnect hook command.

### Requirement: Hot Reload and Payload Preview
The dashboard SHALL support hot-reload patching with payload preview and per-field error feedback.

#### Scenario: Payload is previewed before apply
- **WHEN** the user triggers a save for a field group
- **THEN** the dashboard MUST show the exact JSON payload that will be sent in a collapsed code preview block before the request is dispatched.

#### Scenario: Patch succeeds
- **WHEN** a `PATCH /v3/config/global/patch` request returns a 2xx response
- **THEN** the dashboard MUST show a success notification and update the "last synced" timestamp.

#### Scenario: Patch fails with field-level error
- **WHEN** the API returns a 4xx response with per-field error details
- **THEN** the dashboard MUST display the error message inline below the affected field and show a toast with a summary error notification.

#### Scenario: Patch fails with general error
- **WHEN** the API returns an error without per-field details
- **THEN** the dashboard MUST show a non-blocking error notification via the existing notification system.

### Requirement: Loading and Error States
The global configuration UI SHALL handle loading and error states consistently with the dashboard pattern.

#### Scenario: Configuration is loading
- **WHEN** the global configuration is being fetched from the API
- **THEN** the UI MUST show a loading state that preserves layout stability.

#### Scenario: Configuration fetch fails
- **WHEN** the initial `getGlobalConfig()` call fails
- **THEN** the UI MUST show an error state with a retry action.
