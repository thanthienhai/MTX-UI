## ADDED Requirements

### Requirement: List snapshot files
The system SHALL provide an API endpoint to list snapshot files for a given path.

#### Scenario: List snapshots returns files
- **WHEN** client sends `GET /api/snapshots/list?path=camera1`
- **THEN** the system SHALL scan the snapshot directory for files matching the given path
- **THEN** the response SHALL contain an array of snapshot objects with `filename`, `timestamp`, and `url`
- **THEN** the snapshots SHALL be sorted by timestamp descending (newest first)

#### Scenario: Empty path returns 400
- **WHEN** client sends `GET /api/snapshots/list` without a `path` query parameter
- **THEN** the system SHALL return HTTP 400 with an error message

#### Scenario: No snapshots returns empty array
- **WHEN** client sends `GET /api/snapshots/list?path=camera1` and no snapshot files exist
- **THEN** the system SHALL return HTTP 200 with an empty array

### Requirement: Serve snapshot file
The system SHALL provide an API endpoint to serve individual snapshot image files.

#### Scenario: Serve existing file
- **WHEN** client sends `GET /api/snapshots/file?path=camera1&name=0001.jpg`
- **THEN** the system SHALL return the file with appropriate `Content-Type` header
- **THEN** the response SHALL support caching via `Cache-Control` header

#### Scenario: Missing file returns 404
- **WHEN** client requests a non-existent snapshot file
- **THEN** the system SHALL return HTTP 404

### Requirement: Delete snapshot file
The system SHALL provide an API endpoint to delete individual snapshot files.

#### Scenario: Delete existing file
- **WHEN** client sends `POST /api/snapshots/delete` with body `{ "path": "camera1", "name": "0001.jpg" }`
- **THEN** the system SHALL delete the specified file from the snapshot directory
- **THEN** the system SHALL return HTTP 200 with success message

#### Scenario: Delete non-existent file returns 404
- **WHEN** client sends `POST /api/snapshots/delete` for a non-existent file
- **THEN** the system SHALL return HTTP 404

#### Scenario: Missing parameters returns 400
- **WHEN** client sends `POST /api/snapshots/delete` without required parameters
- **THEN** the system SHALL return HTTP 400

### Requirement: Latest snapshot thumbnail
The system SHALL provide an API endpoint to get the latest snapshot thumbnail for a path.

#### Scenario: Get latest snapshot
- **WHEN** client sends `GET /api/snapshots/latest?path=camera1`
- **THEN** the system SHALL find the most recent snapshot file for that path
- **THEN** the response SHALL contain the `filename` and `url` for that snapshot
- **THEN** if no snapshots exist, the response SHALL return `null`

#### Scenario: Latest snapshot redirect
- **WHEN** client sends `GET /api/snapshots/latest?path=camera1&redirect=true`
- **THEN** the system SHALL redirect (302) directly to the latest snapshot file
- **THEN** if no snapshots exist, the system SHALL return HTTP 404

### Requirement: Configurable snapshot base directory
The system SHALL allow configuration of the snapshot base directory via environment variable.

#### Scenario: Environment variable override
- **WHEN** `SNAPSHOT_BASE_DIR` environment variable is set
- **THEN** all snapshot API routes SHALL use that directory as the root
- **WHEN** `SNAPSHOT_BASE_DIR` is not set
- **THEN** the default directory SHALL be `./snapshots/` relative to the project root

### Requirement: Security for snapshot APIs
The system SHALL ensure snapshot API routes respect authentication and path safety.

#### Scenario: Authentication required
- **WHEN** an unauthenticated request hits any snapshot API route
- **THEN** the system SHALL return HTTP 401 or use the existing Next.js API auth middleware

#### Scenario: Path traversal prevented
- **WHEN** client sends a path name containing `../` or other traversal sequences
- **THEN** the system SHALL sanitize the path and reject traversal attempts with HTTP 400
