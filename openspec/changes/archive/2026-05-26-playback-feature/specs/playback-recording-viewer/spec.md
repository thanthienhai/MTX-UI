## ADDED Requirements

### Requirement: User can select a path to browse recordings
The system SHALL provide a dropdown selector listing all paths that have recording enabled (`record: true`).

#### Scenario: Load path list
- **WHEN** the PlaybackBrowser component loads
- **THEN** the system SHALL fetch paths via `GET /v3/config/paths/list` and filter to those with `record === true`

#### Scenario: Select a path
- **WHEN** the user selects a path from the dropdown
- **THEN** the system SHALL fetch recordings for that path from the Playback Server via `/api/playback/list?path={path}`

### Requirement: User can filter recordings by date range
The system SHALL provide start/end date inputs to filter the displayed recording segments.

#### Scenario: Apply date filter
- **WHEN** the user sets a start and/or end date and clicks "Lọc" or the list auto-refreshes
- **THEN** the system SHALL pass `start` and `end` query params to `/api/playback/list?path={path}&start={start}&end={end}`

#### Scenario: Clear date filter
- **WHEN** the user clears the date inputs
- **THEN** the system SHALL fetch all available segments for the selected path

### Requirement: User can view a timeline of recorded segments
The system SHALL display recorded segments as a horizontal timeline visualization.

#### Scenario: Display segments
- **WHEN** the system receives a list of segments from the API
- **THEN** the system SHALL render each segment as a horizontal bar proportional to its duration along a continuous time axis

#### Scenario: No segments found
- **WHEN** there are no segments for the selected path and date range
- **THEN** the system SHALL display an empty state message "Không có bản ghi nào"

#### Scenario: Timeline loading
- **WHEN** the segment list is loading
- **THEN** the system SHALL display a loading indicator

#### Scenario: Timeline error
- **WHEN** the segment list API call fails
- **THEN** the system SHALL display an error message with a retry button

### Requirement: User can play a recording segment
The system SHALL provide an HTML5 video player to play selected recording segments.

#### Scenario: Select segment for playback
- **WHEN** the user clicks on a segment in the timeline
- **THEN** the system SHALL set the video player's source to `/api/playback/get?path={path}&start={segment.start}&format=fmp4`

#### Scenario: Video player loading
- **WHEN** the video source is loading
- **THEN** the system SHALL display a loading overlay on the video player

#### Scenario: Video player error
- **WHEN** the video fails to load or play
- **THEN** the system SHALL display an error message on the video player

### Requirement: User can download recording as fMP4
The system SHALL provide a download button that downloads the selected segment in fMP4 format.

#### Scenario: Download fMP4
- **WHEN** the user clicks the "Download fMP4" button
- **THEN** the system SHALL trigger a download of `/api/playback/get?path={path}&start={segment.start}&format=fmp4`

### Requirement: User can download recording as MP4
The system SHALL provide a download button that downloads the selected segment in MP4 format.

#### Scenario: Download MP4
- **WHEN** the user clicks the "Download MP4" button
- **THEN** the system SHALL trigger a download of `/api/playback/get?path={path}&start={segment.start}&format=mp4`

### Requirement: User can copy playback URL
The system SHALL provide a button to copy the direct playback URL to the clipboard.

#### Scenario: Copy URL
- **WHEN** the user clicks the "Copy playback URL" button
- **THEN** the system SHALL copy the playback URL to the clipboard and show a success notification
