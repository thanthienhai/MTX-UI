## ADDED Requirements

### Requirement: User can view and modify playback server enable/disable state
The system SHALL display a toggle switch for enabling/disabling the MediaMTX Playback Server.

#### Scenario: Toggle playback enabled
- **WHEN** the user toggles the "Bật playback" switch to ON
- **THEN** the system SHALL set `playback: true` in the pending configuration changes

#### Scenario: Toggle playback disabled
- **WHEN** the user toggles the "Bật playback" switch to OFF
- **THEN** the system SHALL set `playback: false` in the pending configuration changes

### Requirement: User can configure playback server address
The system SHALL provide an input field for `playbackAddress`.

#### Scenario: Enter valid playback address
- **WHEN** the user enters a valid address (e.g., `:9996`)
- **THEN** the system SHALL accept the value and include it in the configuration PATCH payload

### Requirement: User can configure HTTPS/TLS encryption
The system SHALL provide a toggle for enabling/disabling TLS encryption on the playback server.

#### Scenario: Toggle encryption on
- **WHEN** the user toggles HTTPS/TLS encryption to ON
- **THEN** the system SHALL set `playbackEncryption: true` in the pending configuration

#### Scenario: Toggle encryption off
- **WHEN** the user toggles HTTPS/TLS encryption to OFF
- **THEN** the system SHALL set `playbackEncryption: false` in the pending configuration

### Requirement: User can configure CORS Allow-Origin
The system SHALL provide an input field for `playbackAllowOrigin`.

#### Scenario: Enter CORS origin
- **WHEN** the user enters a CORS origin value (e.g., `*`)
- **THEN** the system SHALL accept the value and include it in the configuration PATCH payload

### Requirement: User can configure trusted proxies
The system SHALL provide a way to specify trusted proxy IPs or CIDRs for the playback server.

#### Scenario: Add trusted proxy
- **WHEN** the user enters a trusted proxy IP or CIDR (e.g., `10.0.0.0/8`)
- **THEN** the system SHALL add it to the `playbackTrustedProxies` array in the pending configuration

#### Scenario: Remove trusted proxy
- **WHEN** the user removes a proxy from the list
- **THEN** the system SHALL remove it from the `playbackTrustedProxies` array

### Requirement: User can preview and save playback configuration changes
The system SHALL show a diff preview before applying configuration changes, similar to RecordingSettingsView.

#### Scenario: Preview changes
- **WHEN** the user clicks "Xem trước & lưu" and there are pending changes
- **THEN** the system SHALL display a preview card showing the JSON PATCH payload

#### Scenario: Save changes
- **WHEN** the user confirms the preview and clicks "Áp dụng thay đổi"
- **THEN** the system SHALL call `PATCH /v3/config/global/patch` with the playback configuration fields

#### Scenario: Discard changes
- **WHEN** the user clicks "Hủy" in the preview
- **THEN** the system SHALL discard the preview and show the original values

#### Scenario: Save failure
- **WHEN** the PATCH API call fails
- **THEN** the system SHALL display an error notification with the error message from the API

### Requirement: Playback configuration changes are recorded in audit log
The system SHALL append audit events for playback configuration changes.

#### Scenario: Audit event on save
- **WHEN** the user successfully saves playback configuration changes
- **THEN** the system SHALL create an audit event with action `playback.settings.patch`, including the changed fields summary
