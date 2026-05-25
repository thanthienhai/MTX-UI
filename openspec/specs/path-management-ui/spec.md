### Requirement: Path list combines configured and runtime paths
The dashboard SHALL provide a path list that displays configured paths together with runtime path status from MediaMTX.

#### Scenario: Configured and runtime paths are loaded
- **WHEN** the operator opens the path management view
- **THEN** the dashboard MUST fetch configured paths from `/v3/config/paths/list` and runtime paths from `/v3/paths/list`.

#### Scenario: Configured path has runtime state
- **WHEN** a configured path has a matching runtime path
- **THEN** the dashboard MUST show ready status, source type/id, tracks, readers, bytes received, and bytes sent from runtime data.

#### Scenario: Configured path has no runtime state
- **WHEN** a configured path has no matching runtime path
- **THEN** the dashboard MUST show the path as configured but not currently ready.

#### Scenario: Runtime-only path is visible
- **WHEN** MediaMTX returns a runtime path that is not in the configured path list
- **THEN** the dashboard MUST show it as a runtime path and clearly indicate that no explicit configuration entry is loaded.

### Requirement: Path names are managed
The dashboard SHALL support normal path names, regex path names, and `all_others` path configuration.

#### Scenario: Normal path name is entered
- **WHEN** an operator creates or edits a normal path
- **THEN** the dashboard MUST preserve the entered path name and use it as the encoded `{name}` parameter for path configuration API calls.

#### Scenario: Regex path name is entered
- **WHEN** an operator marks a path name as regex-based
- **THEN** the dashboard MUST preserve the regex expression in the path configuration name and visually distinguish it from normal path names.

#### Scenario: all_others path is selected
- **WHEN** an operator selects the `all_others` path mode
- **THEN** the dashboard MUST save the path configuration with the exact name `all_others`.

### Requirement: Path configuration lifecycle is supported
The dashboard SHALL allow operators to add, edit, replace, and delete path configurations.

#### Scenario: Path configuration is added
- **WHEN** an operator submits a valid new path configuration
- **THEN** the dashboard MUST call `/v3/config/paths/add/{name}` and refresh configured and runtime path data after success.

#### Scenario: Path configuration is patched
- **WHEN** an operator edits fields on an existing path and saves as patch
- **THEN** the dashboard MUST call `/v3/config/paths/patch/{name}` with only changed editable fields.

#### Scenario: Path configuration is replaced
- **WHEN** an operator explicitly chooses replace for an existing path
- **THEN** the dashboard MUST call `/v3/config/paths/replace/{name}` with the full submitted path configuration.

#### Scenario: Path configuration is deleted
- **WHEN** an operator confirms path configuration deletion
- **THEN** the dashboard MUST call `/v3/config/paths/delete/{name}` and remove the configured entry after success.

### Requirement: Path source configuration is supported
The dashboard SHALL expose source configuration for all requested MediaMTX path source modes.

#### Scenario: Publisher source is selected
- **WHEN** an operator selects `publisher` as the source
- **THEN** the dashboard MUST save `source` as `publisher` and show common source/path options.

#### Scenario: URL-based source is selected
- **WHEN** an operator selects RTSP, RTSPS, RTMP, RTMPS, HLS, SRT, or WHEP source mode
- **THEN** the dashboard MUST allow entering the source URL and save it through the `source` field.

#### Scenario: RTP source is selected
- **WHEN** an operator selects RTP source mode
- **THEN** the dashboard MUST expose RTP-specific fields supported by the path configuration model and preserve them in the payload.

#### Scenario: Redirect source is selected
- **WHEN** an operator selects redirect source mode
- **THEN** the dashboard MUST expose redirect source fields supported by the path configuration model and preserve them in the payload.

#### Scenario: Raspberry Pi Camera source is selected
- **WHEN** an operator selects Raspberry Pi Camera source mode
- **THEN** the dashboard MUST expose Raspberry Pi Camera fields supported by the path configuration model and preserve them in the payload.

### Requirement: Common path options are editable
The dashboard SHALL expose common source and path options for path configurations.

#### Scenario: Source common options are edited
- **WHEN** an operator edits `sourceFingerprint`, `sourceOnDemand`, `sourceOnDemandStartTimeout`, or `sourceOnDemandCloseAfter`
- **THEN** the dashboard MUST serialize the changed values in the path configuration payload.

#### Scenario: Reader and publisher options are edited
- **WHEN** an operator edits `maxReaders`, `overridePublisher`, or `useAbsoluteTimestamp`
- **THEN** the dashboard MUST serialize the changed values in the path configuration payload.

### Requirement: Path URLs are generated
The dashboard SHALL generate stream URLs for configured paths.

#### Scenario: Stream URLs are shown
- **WHEN** a path is selected
- **THEN** the dashboard MUST show available RTSP, RTSPS, RTMP, HLS, WebRTC, and SRT URLs using configured service addresses where available.

#### Scenario: Stream URL is copied
- **WHEN** an operator activates copy for a generated stream URL
- **THEN** the dashboard MUST copy the URL to the clipboard and show a non-blocking notification.

#### Scenario: Playback URL is opened
- **WHEN** an operator activates open playback for a path
- **THEN** the dashboard MUST open the playback URL when the current session has playback permission.

### Requirement: Path runtime actions are supported
The dashboard SHALL expose runtime actions for previewing, inspecting, and kicking active path readers or sessions.

#### Scenario: Live preview is requested
- **WHEN** an operator previews a ready path and has read or playback permission
- **THEN** the dashboard MUST render the existing live preview/player for that path.

#### Scenario: Active readers are shown
- **WHEN** a runtime path has active readers
- **THEN** the dashboard MUST show reader type, id, and available traffic details from runtime data.

#### Scenario: Reader or session is kicked
- **WHEN** an operator kicks a reader or protocol session with a supported runtime type
- **THEN** the dashboard MUST call the corresponding MediaMTX kick endpoint and refresh runtime data after success.

### Requirement: Path management feedback and guards are enforced
The dashboard SHALL enforce permissions and provide operator feedback for path management actions.

#### Scenario: API permission is missing
- **WHEN** the current session lacks `api` permission
- **THEN** add, edit, replace, delete, and kick actions MUST be disabled and action handlers MUST reject direct execution.

#### Scenario: Read or playback permission is missing
- **WHEN** the current session lacks read or playback permission
- **THEN** live preview and open playback actions MUST be disabled.

#### Scenario: Path mutation succeeds
- **WHEN** a path add, patch, replace, delete, or kick action succeeds
- **THEN** the dashboard MUST show a success notification and append an audit entry.

#### Scenario: Path mutation fails
- **WHEN** a path add, patch, replace, delete, or kick action fails
- **THEN** the dashboard MUST preserve unsaved form state, show a user-safe error notification, and append a failure audit entry.
