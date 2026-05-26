## ADDED Requirements

### Requirement: On-demand publishing UI is exposed

The dashboard SHALL provide a collapsible "On-Demand Publishing" section in the path add/edit form for configuring `runOnDemand`, `runOnDemandRestart`, and `runOnUnDemand`.

#### Scenario: On-demand publishing section is visible

- **WHEN** an operator scrolls to the On-Demand Publishing section in the path form
- **THEN** the dashboard MUST show an expandable section labeled "On-Demand Publishing"
- **AND** the section MUST contain fields for `runOnDemand`, `runOnDemandRestart`, and `runOnUnDemand`

#### Scenario: runOnDemand command is configured

- **WHEN** an operator enters a command in the `runOnDemand` field and saves
- **THEN** the dashboard MUST include `runOnDemand` in the path payload

#### Scenario: runOnDemand restart is enabled

- **WHEN** an operator toggles `runOnDemandRestart` on
- **THEN** the dashboard MUST set `runOnDemandRestart: true` in the path payload

#### Scenario: runOnUnDemand command is configured

- **WHEN** an operator enters a command in the `runOnUnDemand` field and saves
- **THEN** the dashboard MUST include `runOnUnDemand` in the path payload

### Requirement: On-demand timeout fields are configurable

The dashboard SHALL expose `runOnDemandStartTimeout` and `runOnDemandCloseAfter` fields when on-demand publishing is enabled.

#### Scenario: Timeout fields are shown

- **WHEN** on-demand publishing is enabled (has a non-empty `runOnDemand` command)
- **THEN** the dashboard MUST show `runOnDemandStartTimeout` and `runOnDemandCloseAfter` duration inputs

#### Scenario: Timeout values are saved

- **WHEN** an operator enters duration values for timeout fields and saves
- **THEN** the dashboard MUST include `runOnDemandStartTimeout` and `runOnDemandCloseAfter` in the path payload

### Requirement: Command templates accelerate configuration

The dashboard SHALL provide command template presets for common on-demand publishing scenarios.

#### Scenario: MP4 loop template is selected

- **WHEN** an operator selects "Loop MP4 File" from the command template selector
- **THEN** the dashboard MUST show a file path input
- **AND** generate a command: `ffmpeg -re -stream_loop -1 -i "${filePath}" -c copy -f rtsp rtsp://localhost:${RTSP_PORT}/${MTX_PATH}`

#### Scenario: Camera process template is selected

- **WHEN** an operator selects "Start Camera Process" from the command template selector
- **THEN** the dashboard MUST show a camera device input (default: `/dev/video0`)
- **AND** generate a command: `ffmpeg -f v4l2 -i "${device}" -c:v libx264 -f rtsp rtsp://localhost:${RTSP_PORT}/${MTX_PATH}`

#### Scenario: External stream pull template is selected

- **WHEN** an operator selects "Pull External Stream" from the command template selector
- **THEN** the dashboard MUST show an upstream URL input
- **AND** generate a command: `ffmpeg -i "${upstreamUrl}" -c copy -f rtsp rtsp://localhost:${RTSP_PORT}/${MTX_PATH}`

#### Scenario: Custom command is entered manually

- **WHEN** an operator switches to manual command editing
- **THEN** the dashboard MUST show a resizable textarea with the current command
- **AND** the dashboard MUST display available environment variables: `MTX_PATH`, `MTX_QUERY`, `RTSP_PORT`, `G1`, `G2`, `G3`...

### Requirement: Security warning is displayed

The dashboard SHALL display a security warning when on-demand publishing commands are configured.

#### Scenario: Security banner is shown

- **WHEN** the on-demand publishing section is expanded with a non-empty command
- **THEN** the dashboard MUST show a warning banner: "Các lệnh này chạy trên máy chủ MediaMTX. Chỉ cấu hình nếu bạn tin tưởng lệnh này."
