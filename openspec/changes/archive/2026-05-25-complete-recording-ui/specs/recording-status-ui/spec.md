## ADDED Requirements

### Requirement: Recording status shows per-path recording state
The dashboard SHALL display recording status (đang ghi / idle) for each path that has recording enabled, determined by combining runtime path state and recordings list.

#### Scenario: Path is currently recording
- **WHEN** a path has `record=true` and has an active publisher (runtime path has source)
- **THEN** the dashboard MUST show a "Đang ghi" badge for that path.

#### Scenario: Path is idle
- **WHEN** a path has `record=true` but has no active publisher
- **THEN** the dashboard MUST show an "Idle" badge for that path.

#### Scenario: Path has recording disabled
- **WHEN** a path has `record=false` or not set
- **THEN** the dashboard MUST NOT show recording status for that path.

### Requirement: Latest segment is displayed
The dashboard SHALL show the most recent segment information for each recording path.

#### Scenario: Latest segment shown
- **WHEN** a recording path has segments
- **THEN** the dashboard MUST display the start time and duration of the most recent segment.

#### Scenario: No segments exist
- **WHEN** a recording path has no segments yet
- **THEN** the dashboard MUST show "Chưa có segment" for that path.

### Requirement: Estimated storage usage is calculated
The dashboard SHALL estimate and display the total storage used by each recording path.

#### Scenario: Estimated size is displayed
- **WHEN** a recording has segments with known durations
- **THEN** the dashboard MUST calculate and show an estimated size using `sum(duration) * estimated_bitrate`, with a label "Dung lượng ước tính" and a disclaimer that the value is approximate.

### Requirement: Retention status is shown
The dashboard SHALL display retention information based on `recordDeleteAfter` and segment timestamps.

#### Scenario: Segments are within retention period
- **WHEN** all segments are newer than `recordDeleteAfter`
- **THEN** the dashboard MUST show "Còn <time> trước khi xóa" or similar retention info.

#### Scenario: Segments are past retention period
- **WHEN** some segments exceed `recordDeleteAfter` threshold
- **THEN** the dashboard MUST show a warning that segments are past retention and will be auto-deleted.

### Requirement: Recording status auto-refreshes
The dashboard SHALL poll recording status at a configurable interval.

#### Scenario: Status refreshes on interval
- **WHEN** the Recording tab is active
- **THEN** the dashboard MUST refresh recording status data every 10 seconds using the existing polling mechanism.

### Requirement: Segments can be deleted from status view
The dashboard SHALL allow operators to delete individual segments from the recording status view.

#### Scenario: Segment is deleted
- **WHEN** an operator clicks "Xóa segment" on a segment
- **THEN** the dashboard MUST show a confirmation dialog, then call `DELETE /v3/recordings/deletesegment`, refresh the segment list, and append an audit event.

#### Scenario: Segment delete fails
- **WHEN** segment deletion returns an error
- **THEN** the dashboard MUST show an error notification and keep the segment list unchanged.
