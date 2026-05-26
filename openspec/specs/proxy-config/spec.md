## ADDED Requirements

### Requirement: Proxy tab in dashboard navigation

The system SHALL provide a dedicated Proxy tab in the main dashboard navigation.

#### Scenario: Proxy tab visible
- **GIVEN** the user is on the dashboard with `read` permission
- **WHEN** the dashboard renders
- **THEN** there SHALL be a `TabsTrigger` with value "proxy" in the TabsList
- **THEN** the `lg:grid-cols-9` class SHALL be updated to `lg:grid-cols-10` to accommodate the new tab
- **THEN** clicking the Proxy tab SHALL navigate to the proxy content panel

#### Scenario: Proxy tab hidden without permission
- **GIVEN** the user does NOT have `read` or `api` permission
- **WHEN** the dashboard renders
- **THEN** the Proxy tab MAY be hidden or disabled

### Requirement: Proxy path list view

The system SHALL display a list of all proxy-configured paths in the Proxy tab.

#### Scenario: Show proxy paths
- **GIVEN** there are configured paths with upstream source URLs
- **WHEN** the Proxy tab is active
- **THEN** a list SHALL show each proxy path with:
  - Path name
  - Upstream source URL (masked credentials)
  - Source protocol (RTSP, RTMP, HLS, SRT)
  - `sourceOnDemand` status
  - Runtime status (live/idle/error) from `livePaths`
  - Number of current readers

#### Scenario: Empty proxy list
- **GIVEN** there are no paths configured with upstream source URLs
- **WHEN** the Proxy tab is active
- **THEN** an empty state SHALL be displayed: "Chưa có proxy path nào"
- **THEN** an "Add Proxy Path" button SHALL be shown

### Requirement: Proxy add/edit dialog

The system SHALL provide an Add/Edit dialog for creating and modifying proxy paths.

#### Scenario: Open add proxy dialog
- **WHEN** user clicks "Add Proxy Path" button
- **THEN** a dialog SHALL open with the proxy configuration form
- **THEN** the dialog title SHALL be "Thêm proxy path mới"

#### Scenario: Open edit proxy dialog
- **WHEN** user clicks Edit on an existing proxy path
- **THEN** a dialog SHALL open pre-populated with the existing proxy configuration
- **THEN** the dialog title SHALL be "Sửa proxy path: {name}"

### Requirement: Proxy template selector

The system SHALL provide protocol templates for common upstream types.

#### Scenario: Select RTSP Camera/Server template
- **WHEN** user selects "RTSP Camera/Server" as the proxy template
- **THEN** form fields SHALL appear for: host, port (default 554), username, password, stream path
- **THEN** the generated source URL SHALL follow: `rtsp://{username}:{password}@{host}:{port}/{streamPath}`
- **THEN** the description SHALL read: "Kết nối tới camera hoặc server RTSP"

#### Scenario: Select RTSPS Camera/Server template
- **WHEN** user selects "RTSPS Camera/Server (TLS)" as the proxy template
- **THEN** form fields SHALL appear for: host, port (default 8322), username, password, stream path, fingerprint (optional)
- **THEN** the generated source URL SHALL follow: `rtsps://{username}:{password}@{host}:{port}/{streamPath}`
- **THEN** the `sourceFingerprint` field SHALL be shown when fingerprint is provided

#### Scenario: Select HLS Upstream template
- **WHEN** user selects "HLS Upstream" as the proxy template
- **THEN** form fields SHALL appear for: host, port (default 8888), stream path
- **THEN** the generated source URL SHALL follow: `http://{host}:{port}/{streamPath}/stream.m3u8`
- **THEN** the description SHALL read: "Kéo HLS từ server upstream"

#### Scenario: Select RTMP Upstream template
- **WHEN** user selects "RTMP Upstream" as the proxy template
- **THEN** form fields SHALL appear for: host, stream path
- **THEN** the generated source URL SHALL follow: `rtmp://{host}/live/{streamPath}`
- **THEN** the description SHALL read: "Kết nối tới RTMP server upstream"

#### Scenario: Select SRT Upstream template
- **WHEN** user selects "SRT Upstream" as the proxy template
- **THEN** form fields SHALL appear for: host, port (default 9000), stream ID
- **THEN** the generated source URL SHALL follow: `srt://{host}:{port}?streamid={streamId}`
- **THEN** the description SHALL read: "Kết nối tới SRT server upstream"

### Requirement: Regex path with capture groups

The system SHALL support regex path names with `$G1`, `$G2` capture groups in source URLs.

#### Scenario: Select regex path mode
- **WHEN** user selects "Regex (~)" as the path name mode
- **THEN** the path name input SHALL accept a regex pattern (e.g., `~^cam(\d+)$`)
- **THEN** a capture group helper SHALL appear showing available `$G1`, `$G2` variables
- **THEN** user SHALL be able to click a capture group button to insert it at cursor in the source URL

#### Scenario: Source URL with capture groups
- **GIVEN** a regex path `~^cam(\d+)$` with source URL `rtsp://192.168.1.${G1}:554/stream`
- **WHEN** a client connects to `cam42`
- **THEN** MediaMTX SHALL resolve `$G1` to `42` and connect to `rtsp://192.168.1.42:554/stream`

#### Scenario: Preview resolved URL
- **GIVEN** a regex path with capture groups in the source URL
- **WHEN** user enters example values for capture groups
- **THEN** a preview SHALL show the resolved source URL with the example values substituted

### Requirement: sourceOnDemand for proxy paths

The system SHALL provide `sourceOnDemand` configuration for proxy paths.

#### Scenario: Enable sourceOnDemand
- **WHEN** creating or editing a proxy path
- **THEN** a switch SHALL be present labeled "Nguồn theo nhu cầu (On-demand)"
- **THEN** the default SHALL be enabled (true)
- **THEN** when enabled, the upstream source SHALL only connect when a client requests the path

#### Scenario: On-demand timing configuration
- **GIVEN** `sourceOnDemand` is enabled
- **WHEN** user expands on-demand settings
- **THEN** fields SHALL appear for:
  - `sourceOnDemandStartTimeout`: "Thời gian chờ kết nối" (default: "10s")
  - `sourceOnDemandCloseAfter`: "Đóng sau khi không có reader" (default: "10s")

#### Scenario: Disable sourceOnDemand (always pull)
- **WHEN** user disables `sourceOnDemand`
- **THEN** the source SHALL remain connected continuously
- **THEN** a hint SHALL read: "Nguồn luôn kết nối dù không có reader. Tốn băng thông nhưng giảm độ trễ."

### Requirement: Test upstream source

The system SHALL provide a way to test upstream source reachability.

#### Scenario: Validate source URL format
- **WHEN** user fills in the source URL fields
- **THEN** the system SHALL validate the URL format matches the selected protocol
- **THEN** an invalid URL SHALL show an error: "URL không hợp lệ cho giao thức đã chọn"

#### Scenario: Test HTTP/HLS upstream
- **WHEN** user clicks "Kiểm tra kết nối" for an HTTP/HLS source
- **THEN** the system SHALL attempt a `fetch` to the source URL
- **THEN** on success: display "Kết nối thành công" with response status
- **THEN** on failure: display "Không thể kết nối: {error}"

#### Scenario: Test RTSP/RTMP/SRT upstream
- **WHEN** user clicks "Kiểm tra kết nối" for a non-HTTP source
- **THEN** the system SHALL validate the URL format and display "URL hợp lệ"
- **THEN** a hint SHALL suggest: "Dùng ffprobe trên server MediaMTX để kiểm tra: ffprobe {sourceUrl}"

### Requirement: Source URL preview

The system SHALL show a live preview of the generated source URL.

#### Scenario: URL updates live
- **WHEN** user changes any field in the proxy template (host, port, path, etc.)
- **THEN** the source URL preview SHALL update in real-time
- **THEN** the preview SHALL show the full URL in a read-only input or code display

#### Scenario: Manual URL override
- **WHEN** user clicks "Chỉnh sửa URL thủ công"
- **THEN** the source URL SHALL become editable as a text input
- **THEN** changes to template fields SHALL NOT overwrite manual edits
- **THEN** toggling back to "Tự động" mode SHALL discard manual edits and regenerate from template

### Requirement: Integration with path save

The system SHALL include proxy fields in the path PATCH/POST payload.

#### Scenario: Save proxy path
- **WHEN** user saves a proxy path
- **THEN** the payload SHALL include:
  - `name`: path name
  - `source`: the source URL
  - `sourceOnDemand`: boolean (default true)
  - `sourceOnDemandStartTimeout`: string (if on-demand enabled)
  - `sourceOnDemandCloseAfter`: string (if on-demand enabled)
  - `sourceFingerprint`: string (if provided for RTSPS)
- **THEN** the API call SHALL use `addPath()` for new paths, `updatePath()` for edits

### Requirement: ProxyConfig in Path Form

The system SHALL provide `ProxyConfig` as a reusable section in Path Add/Edit dialog.

#### Scenario: ProxyConfig section in Path Form
- **WHEN** user opens the Path Add/Edit dialog
- **THEN** there SHALL be a collapsible "Proxy" section in the source configuration area
- **THEN** the section SHALL use the same `ProxyConfig` component as the dedicated Proxy tab
- **THEN** when proxy config is active, the source URL field SHALL be populated from the template

#### Scenario: ProxyConfig internal state sync
- **WHEN** user changes proxy template fields
- **THEN** the generated source URL SHALL be synced to the form's `source` field
- **THEN** the `sourceOnDemand` state SHALL be synced to the form's `sourceOnDemand` field
