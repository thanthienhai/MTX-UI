## ADDED Requirements

### Requirement: Gallery fetches snapshots from API
The SnapshotGallery component SHALL fetch snapshot data from the snapshot API on open and refresh.

#### Scenario: Gallery loads snapshots on open
- **WHEN** user opens the snapshot gallery dialog for a path
- **THEN** the component SHALL call `GET /api/snapshots/list?path=<pathName>`
- **THEN** the component SHALL display the returned snapshots in a grid layout
- **THEN** a loading state SHALL be shown while fetching

#### Scenario: Gallery auto-refresh
- **WHEN** the gallery dialog is open
- **THEN** the component SHALL refresh the snapshot list every 10 seconds
- **THEN** new snapshots SHALL appear automatically in the grid

#### Scenario: Manual refresh button
- **WHEN** user clicks a "Refresh" button in the gallery
- **THEN** the component SHALL re-fetch the snapshot list immediately

### Requirement: Delete snapshot via API
The gallery SHALL call the delete API when user confirms deletion.

#### Scenario: Delete with confirmation
- **WHEN** user clicks delete on a snapshot
- **THEN** a confirmation dialog SHALL appear asking for confirmation
- **WHEN** user confirms deletion
- **THEN** the component SHALL call `POST /api/snapshots/delete` with path and filename
- **THEN** on success, the snapshot SHALL be removed from the gallery grid
- **THEN** on failure, an error toast SHALL be shown

### Requirement: Download snapshot
The gallery SHALL support downloading individual snapshot files.

#### Scenario: Download snapshot
- **WHEN** user clicks download on a snapshot
- **THEN** the component SHALL initiate a browser download of the snapshot image
- **THEN** the downloaded filename SHALL be the original snapshot filename

### Requirement: Thumbnail in path list
The path list SHALL display a small thumbnail of the latest snapshot for each path.

#### Scenario: Latest thumbnail display
- **WHEN** a path has snapshots available
- **THEN** a small thumbnail (e.g., 40x23) SHALL be displayed next to the path name in the stream row
- **THEN** clicking the thumbnail SHALL open the snapshot gallery

#### Scenario: No thumbnail when no snapshots
- **WHEN** a path has no snapshots
- **THEN** no thumbnail SHALL be shown (placeholder or empty state)

#### Scenario: Lazy-loaded thumbnail
- **WHEN** the path list renders
- **THEN** the thumbnail SHALL be lazy-loaded via `GET /api/snapshots/latest?path=<pathName>&redirect=true`
- **THEN** a loading placeholder SHALL be shown while the thumbnail loads
