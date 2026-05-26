## ADDED Requirements

### Requirement: Hook template for rclone is available
The dashboard SHALL provide a ready-to-use command template for `runOnRecordSegmentComplete` that uses rclone to upload completed segments to remote storage.

#### Scenario: Rclone template is displayed
- **WHEN** an operator opens the remote upload configuration
- **THEN** the dashboard MUST show a pre-filled template command: `rclone copy "{{ .RecordPath }}" "remote:stream-recordings/{{ .Path }}"` with explanatory comments.

#### Scenario: Template variables are documented
- **WHEN** an operator views the template
- **THEN** the dashboard MUST document available MediaMTX environment variables: `MTX_PATH`, `MTX_RECORD_PATH`, `MTX_RECORD_FORMAT`, `MTX_RECORD_SEGMENT_DURATION`.

### Requirement: UI for configuring upload command
The dashboard SHALL provide an editor for operators to configure the custom upload command.

#### Scenario: Upload command is editable
- **WHEN** an operator edits the upload command
- **THEN** the dashboard MUST accept multi-line input for the shell command, stored in localStorage, with a "Sao chép" button to copy to clipboard for use in MediaMTX config.

#### Scenario: Upload command is saved locally
- **WHEN** an operator saves the upload command
- **THEN** the dashboard MUST persist the command to localStorage and show a clear indicator that this is stored client-side only.

### Requirement: File system and security warnings are shown
The dashboard SHALL display prominent warnings about filesystem access and command security risks.

#### Scenario: Filesystem access warning is shown
- **WHEN** the remote upload section is displayed
- **THEN** the dashboard MUST show a warning: "MediaMTX cần quyền ghi filesystem để tạo file ghi hình. Hook runOnRecordSegmentComplete chạy với quyền của process MediaMTX."

#### Scenario: Command security warning is shown
- **WHEN** the remote upload section is displayed
- **THEN** the dashboard MUST show a warning: "Cảnh báo bảo mật: Hook command chạy với quyền MediaMTX. Không nhúng secret/password trực tiếp vào command. Sử dụng environment variables hoặc file cấu hình riêng."
