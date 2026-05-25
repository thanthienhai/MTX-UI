## ADDED Requirements

### Requirement: Vietnamese Overview Interface
The dashboard overview SHALL present service status, stream summary, traffic, health, sync warnings, and quick actions in Vietnamese.

#### Scenario: Overview content renders
- **WHEN** an authenticated user opens the overview
- **THEN** headings, labels, status values, timestamps, units, empty states, error states, and quick action text MUST be shown in Vietnamese while preserving protocol names and technical identifiers.

#### Scenario: Overview status is unknown
- **WHEN** a service, protocol, metric, or runtime value cannot be determined
- **THEN** the overview MUST show a Vietnamese unknown or degraded state without hiding the rest of the overview.

### Requirement: Protocol Reader and Resource Aggregation
The dashboard overview SHALL aggregate reader or resource counts from runtime paths and protocol-specific MediaMTX resources.

#### Scenario: Protocol resources are present
- **WHEN** RTSP, RTMP, HLS, WebRTC, or SRT resource lists return active items
- **THEN** the overview MUST count the active readers, sessions, connections, or muxers under the corresponding protocol summary.

#### Scenario: Protocol resource endpoint fails
- **WHEN** one protocol resource list fails during overview refresh
- **THEN** the corresponding protocol count MUST be marked unavailable while other protocol counts remain visible.

### Requirement: Endpoint-Aware Quick Actions
The dashboard overview SHALL build quick actions from configured endpoint URLs and current permissions.

#### Scenario: Playback quick action is available
- **WHEN** playback permission is granted and a playback base URL can be built
- **THEN** the overview MUST open or navigate to the configured playback URL for the selected or default path.

#### Scenario: Metrics quick action is available
- **WHEN** metrics permission is granted and a metrics base URL can be built
- **THEN** the overview MUST open or navigate to the configured metrics endpoint.

#### Scenario: Quick action is blocked
- **WHEN** required permission is missing or the required endpoint is disabled
- **THEN** the overview MUST disable or hide the action and present a Vietnamese reason when visible.

### Requirement: Config Synchronization Warning
The dashboard overview SHALL warn in Vietnamese when local dashboard configuration state is stale compared with the latest MediaMTX backend configuration.

#### Scenario: Config mismatch is detected
- **WHEN** the dashboard has unsynchronized local config state or a newer backend config sample than the UI state
- **THEN** the overview MUST show a Vietnamese warning that configuration in the UI is not synchronized with the backend.
