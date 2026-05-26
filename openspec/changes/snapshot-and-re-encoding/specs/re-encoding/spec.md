## ADDED Requirements

### Requirement: Re-encoding toggle
The system SHALL provide an enable/disable toggle for re-encoding configuration in the Path Edit dialog.

#### Scenario: Toggle re-encoding
- **WHEN** user edits or adds a path
- **THEN** there SHALL be a "Re-Encoding" section with an enable/disable toggle
- **WHEN** re-encoding is enabled
- **THEN** the template selector and command editor SHALL be shown
- **WHEN** re-encoding is disabled
- **THEN** the `runOnReady` command SHALL be cleared and template fields SHALL be hidden

### Requirement: Engine selector (FFmpeg / GStreamer)
The system SHALL allow users to choose between FFmpeg and GStreamer engines for each re-encoding template.

#### Scenario: Engine tab switching
- **WHEN** re-encoding is enabled
- **THEN** there SHALL be a tab or switch to select FFmpeg or GStreamer
- **WHEN** user switches engine
- **THEN** the generated command SHALL update to the corresponding engine syntax
- **THEN** the template fields SHALL remain the same (only command syntax changes)

### Requirement: Re-encoding templates
The system SHALL provide 5 re-encoding templates, each with both FFmpeg and GStreamer command generation.

#### Scenario: H264 to H264 bitrate change
- **WHEN** user selects "H264 to H264 bitrate change" template
- **THEN** fields SHALL be shown: target bitrate (e.g., `1M`), maxrate, output URL
- **THEN** FFmpeg command SHALL use `-c:v libx264 -b:v $bitrate -maxrate $maxrate`
- **THEN** GStreamer command SHALL use `x264enc bitrate=$kbps`

#### Scenario: H265 to H264 for browser compatibility
- **WHEN** user selects "H265 to H264" template
- **THEN** fields SHALL be shown: output URL, optional audio codec
- **THEN** FFmpeg command SHALL use `-c:v libx264 -c:a aac`
- **THEN** GStreamer command SHALL decode H265 and re-encode with x264enc

#### Scenario: Audio transcode to AAC/Opus
- **WHEN** user selects "Audio transcode" template
- **THEN** fields SHALL be shown: audio codec (AAC or Opus), output URL
- **THEN** FFmpeg command SHALL use `-c:a aac` or `-c:a libopus`
- **THEN** GStreamer command SHALL use `faac` or `opusenc`

#### Scenario: Scale resolution
- **WHEN** user selects "Scale resolution" template
- **THEN** fields SHALL be shown: target width, target height, output URL
- **THEN** FFmpeg command SHALL use `-vf scale=$width:$height`
- **THEN** GStreamer command SHALL use `videoscale ! video/x-raw,width=$width,height=$height`

#### Scenario: Add low-bitrate substream
- **WHEN** user selects "Low-bitrate substream" template
- **THEN** fields SHALL be shown: target bitrate (default `500k`), resolution (default `640:360`), output URL
- **THEN** FFmpeg command SHALL combine `-b:v $bitrate -vf scale=$resolution`
- **THEN** GStreamer command SHALL use `x264enc bitrate=$kbps` with `videoscale`

### Requirement: Command preview and editing
The system SHALL show a preview of the generated re-encoding command and allow direct editing.

#### Scenario: Command preview
- **WHEN** user fills in template fields
- **THEN** the generated FFmpeg/GStreamer command SHALL appear in an editable textarea
- **THEN** the textarea SHALL use monospace font for readability

#### Scenario: Manual command editing
- **WHEN** user edits the command textarea directly
- **THEN** the user's edits SHALL be preserved (not overwritten by template changes unless re-selected)
- **WHEN** user changes a template field
- **THEN** the command SHALL regenerate from the template

### Requirement: Attach command to runOnReady hook
The generated re-encoding command SHALL be attached to the `runOnReady` hook on the path.

#### Scenario: Set runOnReady on enable
- **WHEN** user enables re-encoding and configures the command
- **THEN** the system SHALL set `runOnReady` to the generated command
- **THEN** the system SHALL set `runOnReadyRestart` to `true`
- **WHEN** user disables re-encoding
- **THEN** the system SHALL clear `runOnReady` and set `runOnReadyRestart` to `false`

### Requirement: CPU warning
The system SHALL display a warning about CPU usage when re-encoding is enabled.

#### Scenario: CPU warning display
- **WHEN** re-encoding is enabled
- **THEN** a warning banner SHALL be displayed: "Cảnh báo: Re-encoding tiêu tốn nhiều CPU. Đảm bảo server có đủ tài nguyên."
- **THEN** the warning SHALL be amber/ yellow with a CPU icon
- **THEN** the warning SHALL persist as long as re-encoding is enabled

### Requirement: Security warning for FFmpeg/GStreamer commands
The system SHALL display warnings about command execution risks.

#### Scenario: Security warning
- **WHEN** re-encoding is enabled
- **THEN** a security warning SHALL be shown: "Re-encoding command chạy với quyền của process MediaMTX. Chỉ sử dụng command từ nguồn tin cậy."
