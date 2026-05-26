## ADDED Requirements

### Requirement: Reusable HookCommandEditor component

The system SHALL provide a reusable `HookCommandEditor` React component for editing hook commands across all hooks UI.

#### Scenario: Component accepts hook metadata props

- **WHEN** the `HookCommandEditor` is rendered
- **THEN** it SHALL accept props: `value` (current command string), `onChange` (callback), `hookName` (e.g., "runOnReady"), `envVars` (available MTX_* variables), `templates` (optional template definitions), `restartEnabled` (optional boolean), `onRestartChange` (optional callback), `pathName` (current path name for template generation)

#### Scenario: Component renders multiline textarea

- **WHEN** the `HookCommandEditor` is rendered
- **THEN** it SHALL display a resizable `<Textarea>` with monospace font
- **AND** the textarea SHALL have a minimum height of 80px
- **AND** the textarea SHALL support paste of multi-line commands

### Requirement: Env var helper panel

The `HookCommandEditor` SHALL display available environment variables for the hook context.

#### Scenario: Env vars are displayed

- **WHEN** the hook command editor has focus or is visible
- **THEN** a collapsible panel SHALL display environment variables available to the hook
- **AND** each env var SHALL show the variable name and its description
- **AND** clicking an env var SHALL insert it at cursor position in the textarea

#### Scenario: Env vars differ by hook context

- **WHEN** the hook is a global hook (`runOnConnect`, `runOnDisconnect`)
- **THEN** the env vars SHALL include: `MTX_API_PORT`, `MTX_LOG_LEVEL`, `MTX_READ_TIMEOUT`
- **WHEN** the hook is a lifecycle hook (`runOnInit`, `runOnReady`)
- **THEN** the env vars SHALL include: `MTX_PATH`, `RTSP_PORT`, `MTX_SOURCE_TYPE`, `G1`, `G2`...
- **WHEN** the hook is a read event hook (`runOnRead`, `runOnUnread`)
- **THEN** the env vars SHALL include: `MTX_PATH`, `RTSP_PORT`, `MTX_READER_TYPE`, `G1`, `G2`...
- **WHEN** the hook is a recording hook (`runOnRecordSegmentCreate`, `runOnRecordSegmentComplete`)
- **THEN** the env vars SHALL include: `MTX_PATH`, `MTX_RECORD_PATH`, `MTX_RECORD_FORMAT`, `MTX_RECORD_SEGMENT_DURATION`, `G1`, `G2`...

### Requirement: Template snippets selector

The `HookCommandEditor` SHALL optionally provide template snippets for quick command generation.

#### Scenario: Template selector is shown

- **WHEN** the `HookCommandEditor` is configured with `templates` prop
- **THEN** a template selector dropdown SHALL be displayed above the textarea
- **AND** selecting a template SHALL populate the textarea with the generated command

#### Scenario: Template field inputs

- **WHEN** a template is selected that requires input fields
- **THEN** the editor SHALL render the required fields (text, number, URL) below the template selector
- **AND** changing field values SHALL regenerate the command in real-time

#### Scenario: Custom command option

- **WHEN** the template selector has a "Tùy chỉnh (custom)" option
- **THEN** selecting custom SHALL clear template fields
- **AND** only show the raw textarea for manual editing

### Requirement: Security warning banner

The `HookCommandEditor` SHALL display a security warning when a command is configured.

#### Scenario: Security banner is shown

- **WHEN** the hook command is non-empty (command is configured)
- **THEN** a warning banner SHALL be displayed with:
  - Warning icon (AlertTriangle)
  - Title: "Cảnh báo bảo mật"
  - Message: "Hook command chạy với quyền của process MediaMTX. Chỉ sử dụng command từ nguồn tin cậy. Không nhúng mật khẩu trực tiếp vào command."

### Requirement: Restart toggle

The `HookCommandEditor` SHALL optionally render a restart toggle for hooks that support it.

#### Scenario: Restart toggle is shown

- **WHEN** the hook has a corresponding `*Restart` boolean field (e.g., `runOnReadyRestart` for `runOnReady`)
- **THEN** the editor SHALL display a "Tự động khởi động lại nếu lệnh thoát" switch below the textarea
- **AND** the `onRestartChange` callback SHALL fire when toggled

### Requirement: Read-only mode

The `HookCommandEditor` SHALL support a read-only mode for users without `api` permission.

#### Scenario: Read-only mode

- **WHEN** the user lacks `api` permission
- **THEN** the textarea and all interactive elements SHALL be disabled
- **AND** a message SHALL indicate "Cần quyền api để chỉnh sửa hook command"
