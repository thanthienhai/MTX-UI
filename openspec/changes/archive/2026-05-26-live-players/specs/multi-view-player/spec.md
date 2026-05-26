## ADDED Requirements

### Requirement: Multi-View Player renders multiple streams in a grid
The system SHALL provide a multi-view container component that displays multiple live streams simultaneously in a configurable grid layout.

#### Scenario: Grid renders configured number of streams
- **WHEN** the user selects a grid size (2×2 or 3×3)
- **THEN** the grid SHALL render that many stream cells (4 for 2×2, 9 for 3×3)
- **THEN** each cell SHALL display a live stream using the appropriate player (HLS or WebRTC)
- **THEN** empty cells SHALL show an "Add stream" placeholder

#### Scenario: Grid layout uses CSS grid
- **WHEN** the grid is rendered
- **THEN** 2×2 mode SHALL use `grid-cols-2` CSS class
- **THEN** 3×3 mode SHALL use `grid-cols-3` CSS class
- **THEN** each cell SHALL maintain 16:9 aspect ratio

### Requirement: Stream selection and auto-assignment
The multi-view SHALL allow users to assign live paths to grid cells.

#### Scenario: Auto-load live paths
- **WHEN** the multi-view component mounts
- **THEN** it SHALL fetch all live paths from the dashboard state
- **THEN** it SHALL populate grid cells with available live paths
- **THEN** users SHALL be able to change which path occupies each cell

#### Scenario: Protocol auto-selection per cell
- **WHEN** a path is assigned to a cell
- **THEN** the system SHALL prefer WebRTC player if the path is live and WebRTC is enabled
- **THEN** the system SHALL fall back to HLS player if WebRTC is unavailable

### Requirement: Pin stream
Users SHALL be able to pin a stream to give it prominence in the grid.

#### Scenario: Pin toggles layout
- **WHEN** user clicks the pin button on a cell
- **THEN** the pinned cell SHALL expand to `col-span-2 row-span-2`
- **THEN** remaining cells SHALL rearrange below and beside the pinned cell
- **THEN** clicking pin again SHALL return to normal grid layout

#### Scenario: Only one pinned stream at a time
- **WHEN** user pins a different stream while another is already pinned
- **THEN** the previously pinned stream SHALL unpin
- **THEN** the newly selected stream SHALL become pinned

### Requirement: Mute/unmute per stream
Users SHALL be able to mute individual streams in the multi-view grid.

#### Scenario: Individual mute toggle
- **WHEN** user clicks the mute button on a cell
- **THEN** that cell's audio SHALL be muted
- **THEN** the mute icon SHALL update to reflect the state
- **THEN** clicking again SHALL unmute

#### Scenario: Mute all
- **WHEN** user clicks "Mute All" in grid controls
- **THEN** all cells SHALL be muted simultaneously
- **THEN** the button text SHALL change to "Unmute All"
- **THEN** clicking "Unmute All" SHALL restore previous per-cell mute states

### Requirement: Fullscreen
Users SHALL be able to view any stream in fullscreen mode.

#### Scenario: Fullscreen single stream
- **WHEN** user clicks the fullscreen button on a cell
- **THEN** that cell SHALL enter fullscreen using the Fullscreen API (`element.requestFullscreen()`)
- **THEN** the fullscreen view SHALL show the player at maximum screen size

### Requirement: Dedicated tab in dashboard
The multi-view player SHALL have its own tab in the dashboard navigation.

#### Scenario: Live Players tab exists
- **WHEN** the dashboard renders
- **THEN** there SHALL be a "Live Players" tab in the TabsList
- **THEN** the tab SHALL have a `Video` icon
- **THEN** clicking the tab SHALL show the multi-view player component
