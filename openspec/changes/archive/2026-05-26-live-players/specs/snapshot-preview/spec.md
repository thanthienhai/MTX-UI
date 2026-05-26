## ADDED Requirements

### Requirement: Snapshot FFmpeg command generator
The system SHALL provide UI to generate and manage `runOnReady` FFmpeg commands for extracting snapshot frames from streams.

#### Scenario: Generate snapshot command
- **WHEN** user configures snapshot in Path Edit dialog
- **THEN** the system SHALL generate an FFmpeg command template
- **THEN** the template SHALL include `-i` with the stream source
- **THEN** the template SHALL include `-vf fps=1/<interval>` for periodic capture
- **THEN** the template SHALL output to `{outputPath}/{filename}-%04d.jpg`

#### Scenario: Configurable interval
- **WHEN** user sets a snapshot interval (e.g., "10s")
- **THEN** the command SHALL use `-vf fps=1/10` to capture one frame every 10 seconds
- **THEN** the default interval SHALL be 10 seconds

#### Scenario: Configurable output path
- **WHEN** user sets an output path (e.g., "./snapshots/%path/")
- **THEN** the command SHALL use this path for frame output
- **THEN** the path MAY contain `%path` variable (resolved to stream path name)

### Requirement: Snapshot config UI
The system SHALL provide a configuration interface for snapshot settings within the Path Edit dialog.

#### Scenario: Snapshot toggle in path config
- **WHEN** editing or adding a path
- **THEN** there SHALL be a "Snapshot" section with an enable/disable toggle
- **THEN** enabling SHALL require FFmpeg command template to be set
- **THEN** a warning SHALL be displayed: "Cần FFmpeg trên server và quyền ghi filesystem"

#### Scenario: Command preview
- **WHEN** user configures snapshot settings
- **THEN** the UI SHALL show a preview of the generated `runOnReady` command
- **THEN** the user SHALL be able to edit the command directly

### Requirement: Thumbnail in path list
The system SHALL display snapshot thumbnails (if available) in the path list.

#### Scenario: Thumbnail shows latest snapshot
- **WHEN** viewing the path list
- **THEN** if snapshots exist for a path, the latest snapshot thumbnail SHALL be displayed next to the path name
- **THEN** if no snapshots exist, no thumbnail SHALL be shown

### Requirement: Snapshot gallery
The system SHALL provide a gallery view for browsing all snapshots.

#### Scenario: Open snapshot gallery
- **WHEN** user clicks "Snapshots" on a path
- **THEN** a gallery dialog SHALL open showing all snapshot images for that path
- **THEN** each snapshot SHALL show its timestamp
- **THEN** user SHALL be able to delete individual snapshots
- **THEN** user SHALL be able to download snapshots

### Requirement: Security warning for FFmpeg
The system SHALL warn users about FFmpeg dependency and filesystem access risks.

#### Scenario: Warning displayed
- **WHEN** snapshot feature is enabled
- **THEN** a warning banner SHALL be displayed: "Snapshot cần FFmpeg trên server. Command chạy với quyền của process MediaMTX. Đảm bảo output path an toàn."
- **THEN** the warning SHALL be visible in both snapshot config and gallery UI
