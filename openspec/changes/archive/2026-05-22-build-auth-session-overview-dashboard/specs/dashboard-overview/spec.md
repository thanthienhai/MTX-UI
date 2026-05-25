## ADDED Requirements

### Requirement: Real service status overview
The dashboard overview SHALL display live service status derived from MediaMTX configuration, runtime data, configured service URLs, and permission availability.

#### Scenario: Service status loads
- **WHEN** the dashboard successfully loads MediaMTX global configuration and service endpoint configuration
- **THEN** the overview displays enabled or disabled status for API, metrics, pprof, playback, RTSP, RTMP, HLS, WebRTC, and SRT

#### Scenario: Service status unavailable
- **WHEN** a service status cannot be determined because its data source fails
- **THEN** the overview displays the affected service as unknown without hiding the rest of the overview

### Requirement: Stream summary counts
The dashboard overview SHALL show configured path count, ready/live path count, and reader counts grouped by protocol.

#### Scenario: Runtime paths loaded
- **WHEN** configured paths and runtime paths are loaded from MediaMTX
- **THEN** the overview shows the number of configured paths excluding internal fallback entries and the number of ready/live paths

#### Scenario: Protocol resources loaded
- **WHEN** protocol connection, session, or muxer lists are loaded
- **THEN** the overview groups current readers or resources by RTSP, RTMP, HLS, WebRTC, and SRT where data is available

### Requirement: Traffic totals and bitrate
The dashboard overview SHALL display total inbound bytes, total outbound bytes, and inbound/outbound bitrate calculated from byte deltas between refresh samples.

#### Scenario: Byte counters update
- **WHEN** two refresh samples include cumulative inbound and outbound byte totals with positive elapsed time
- **THEN** the overview calculates bitrate as byte delta multiplied by eight divided by elapsed seconds

#### Scenario: First byte sample
- **WHEN** only one byte sample is available
- **THEN** the overview displays total byte counters and shows bitrate as unavailable or zero without fabricating a delta

#### Scenario: Byte counter reset
- **WHEN** a later byte sample is lower than the previous sample
- **THEN** the overview treats the bitrate for that interval as unavailable or zero and uses the new sample as the baseline for future intervals

### Requirement: Health cards
The dashboard overview SHALL display health cards for API latency, metrics scrape status, last config update, and dashboard/backend configuration sync.

#### Scenario: API latency measured
- **WHEN** the dashboard refreshes overview data through the MediaMTX Control API
- **THEN** the overview records and displays the API request latency for the refresh

#### Scenario: Metrics scrape succeeds
- **WHEN** metrics permission is available and the configured metrics endpoint responds successfully
- **THEN** the overview displays metrics scrape status as healthy with the latest scrape time or latency

#### Scenario: Metrics scrape fails
- **WHEN** metrics permission is available but the configured metrics endpoint fails
- **THEN** the overview displays metrics scrape status as degraded without blocking Control API data

#### Scenario: Config mismatch detected
- **WHEN** dashboard local configuration state differs from the latest backend configuration loaded from MediaMTX
- **THEN** the overview shows a warning that the config UI is not synchronized with the backend

### Requirement: Overview quick actions
The dashboard overview SHALL provide quick actions to add a path, open playback, open metrics, and refresh or restart dashboard data.

#### Scenario: Add path quick action
- **WHEN** the user has `api` permission and activates the add path quick action
- **THEN** the dashboard opens the path creation workflow or navigates to the path management view

#### Scenario: Open playback quick action
- **WHEN** the user has `playback` permission and a playback URL can be built
- **THEN** the dashboard opens playback for the selected or default path

#### Scenario: Open metrics quick action disabled
- **WHEN** the user lacks `metrics` permission or metrics is disabled
- **THEN** the open metrics quick action is disabled or hidden

#### Scenario: Refresh overview data
- **WHEN** the user activates refresh or restart data
- **THEN** the dashboard reloads overview data, updates health cards, and recalculates bitrate from the newest sample

### Requirement: Overview failure states
The dashboard overview MUST show loading, empty, and error states for API-backed data without using blocking browser alerts.

#### Scenario: Overview loading
- **WHEN** overview data is being fetched
- **THEN** the dashboard displays a loading state for the affected overview regions

#### Scenario: Overview fetch failure
- **WHEN** a MediaMTX API request fails during overview refresh
- **THEN** the dashboard displays a non-blocking error state or notification with a user-safe error message
