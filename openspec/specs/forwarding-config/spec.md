## ADDED Requirements

### Requirement: Forwarding enable/disable per path

The system SHALL provide a Forwarding configuration section in the Path Edit dialog with an enable/disable toggle.

#### Scenario: Enable forwarding
- **WHEN** user opens the Path Edit dialog for a new or existing path
- **THEN** there SHALL be a "Forwarding" section with an enable/disable switch
- **THEN** enabling forwarding SHALL reveal the forwarding configuration fields

#### Scenario: Load forwarding state from existing config
- **WHEN** user opens the Path Edit dialog for an existing path that has `runOnReady` set
- **THEN** the Forwarding switch SHALL be enabled
- **THEN** the target URL and protocol SHALL be parsed from the existing command when possible
- **THEN** the command textarea SHALL show the existing command

### Requirement: Forward target protocol presets

The system SHALL provide preset templates for common forward target protocols.

#### Scenario: Select RTSP target
- **WHEN** user selects "RTSP" as the target protocol
- **THEN** the generated command SHALL use the `-f rtsp` output format
- **THEN** the placeholder text SHALL show `rtsp://target-server:8554/stream`

#### Scenario: Select RTMP target
- **WHEN** user selects "RTMP" as the target protocol
- **THEN** the generated command SHALL use the `-f flv` output format
- **THEN** the placeholder text SHALL show `rtmp://target-server/live/stream`

#### Scenario: Select SRT target
- **WHEN** user selects "SRT" as the target protocol
- **THEN** the generated command SHALL use the `-f mpegts` output format
- **THEN** the placeholder text SHALL show `srt://target-server:9000?streamid=publish:stream`

#### Scenario: Select HLS/HTTP target
- **WHEN** user selects "HLS/HTTP" as the target protocol
- **THEN** the generated command SHALL use the `-f hls` output format with `-hls_time 6 -hls_list_size 4`
- **THEN** the placeholder text SHALL show `http://target-server:8888/stream.m3u8`

### Requirement: Target URL input

The system SHALL provide a URL input field for the forward target address.

#### Scenario: Enter target URL
- **WHEN** user enters a target URL (e.g., `rtsp://192.168.1.100:8554/stream`)
- **THEN** the generated FFmpeg command SHALL update in real-time to reflect the new target
- **THEN** the command textarea SHALL show the complete command

#### Scenario: Target URL updates command
- **WHEN** user changes the target URL
- **THEN** the command SHALL be regenerated with the new URL while preserving other settings

### Requirement: Editable FFmpeg command preview

The system SHALL provide an editable textarea showing the full FFmpeg command.

#### Scenario: View generated command
- **WHEN** user configures forwarding settings
- **THEN** a read-write textarea SHALL display the generated FFmpeg command
- **THEN** the user SHALL be able to edit the command directly
- **THEN** the preset inputs (target type, URL) SHALL NOT overwrite manual edits

#### Scenario: Manual command edit preserved
- **WHEN** user manually edits the command textarea
- **THEN** the edited command SHALL be saved as-is when the form is submitted
- **THEN** subsequent changes to preset inputs SHALL update the textarea (overwriting manual edits)

### Requirement: runOnReadyRestart toggle

The system SHALL provide a toggle for `runOnReadyRestart`.

#### Scenario: Enable restart
- **WHEN** user enables forwarding
- **THEN** there SHALL be a switch labeled "Tự động khởi động lại nếu lệnh thoát" (runOnReadyRestart)
- **THEN** the switch SHALL default to enabled

#### Scenario: Disable restart
- **WHEN** user turns off the restart switch
- **THEN** the `runOnReadyRestart` field SHALL be set to `false` in the PATCH payload

### Requirement: Command validation

The system SHALL validate the forwarding command before saving.

#### Scenario: Command not empty when enabled
- **WHEN** forwarding is enabled
- **THEN** the command field SHALL be required
- **THEN** if the command is empty, the form SHALL show a validation error: "Command không được để trống"
- **THEN** the form SHALL NOT submit until the error is resolved

#### Scenario: Command valid when disabled
- **WHEN** forwarding is disabled
- **THEN** no validation SHALL be performed on the command field
- **THEN** the `runOnReady` field SHALL be set to empty string in the PATCH payload

### Requirement: FFmpeg dependency warning

The system SHALL display a security warning about FFmpeg dependency.

#### Scenario: Warning displayed when forwarding enabled
- **WHEN** user enables forwarding
- **THEN** a prominent warning banner SHALL be displayed with:
  - Warning icon (AlertTriangle)
  - Title: "Yêu cầu FFmpeg"
  - Message: "Forward cần FFmpeg trên server. Command chạy với quyền của process MediaMTX. Không sử dụng command từ nguồn không tin cậy."
  - The warning SHALL use the amber color scheme (same as snapshot-config.tsx)

#### Scenario: Warning hidden when disabled
- **WHEN** forwarding is disabled
- **THEN** the warning banner SHALL be hidden

### Requirement: Integration with path save

The system SHALL include forwarding fields in the path PATCH payload.

#### Scenario: Save path with forwarding config
- **WHEN** user saves the path with forwarding enabled
- **THEN** the PATCH payload SHALL include `runOnReady` (the command text) and `runOnReadyRestart` (boolean)
- **THEN** the API call SHALL use the existing `updatePath()` function

#### Scenario: Save path with forwarding disabled
- **WHEN** user saves the path with forwarding disabled
- **THEN** the PATCH payload SHALL NOT include `runOnReady` (or set it to empty)
- **THEN** the PATCH payload SHALL NOT include `runOnReadyRestart`
