## ADDED Requirements

### Requirement: Extended Path Configuration Client Types
The system SHALL provide typed client coverage for all path configuration fields used by the path management and path defaults UI.

#### Scenario: Common path fields are typed
- **WHEN** dashboard code reads, patches, replaces, imports, or exports path configuration
- **THEN** the client types MUST include `source`, `sourceFingerprint`, `sourceOnDemand`, `sourceOnDemandStartTimeout`, `sourceOnDemandCloseAfter`, `maxReaders`, `overridePublisher`, and `useAbsoluteTimestamp`.

#### Scenario: Source-specific fields are preserved
- **WHEN** dashboard code edits RTSP, RTSPS, RTMP, RTMPS, HLS, SRT, WHEP, RTP, redirect, or Raspberry Pi Camera source configuration
- **THEN** the client types MUST preserve source-specific fields used by MediaMTX without dropping unknown but valid path configuration keys.

#### Scenario: Path runtime reader fields are typed
- **WHEN** dashboard code displays runtime path readers
- **THEN** the client types MUST represent reader type, id, and available traffic details returned by MediaMTX.

### Requirement: Path Lifecycle Client Operations
The system SHALL expose typed client methods for path add, patch, replace, delete, list, get, runtime list, runtime get, and path defaults patch flows used by the UI.

#### Scenario: Path name contains special characters
- **WHEN** a path lifecycle operation sends a path name in the URL
- **THEN** the client MUST encode the path name exactly once.

#### Scenario: Path is replaced
- **WHEN** the dashboard replaces a path configuration
- **THEN** the client MUST send `POST /v3/config/paths/replace/{name}` with the full typed path configuration payload.

#### Scenario: Path defaults are patched
- **WHEN** the dashboard saves path defaults
- **THEN** the client MUST send `PATCH /v3/config/pathdefaults/patch` with a typed partial path configuration payload.

#### Scenario: Runtime path is read
- **WHEN** the dashboard needs details for one runtime path
- **THEN** the client MUST send `GET /v3/paths/get/{name}` and return the typed runtime path response.

### Requirement: Runtime Kick Client Resolution
The system SHALL provide a way for the dashboard to kick supported active readers or sessions from path runtime data.

#### Scenario: Supported reader is kicked
- **WHEN** the dashboard resolves a runtime reader or session to a supported protocol kick endpoint
- **THEN** the client MUST call the corresponding kick operation with the encoded id.

#### Scenario: Unsupported reader cannot be kicked
- **WHEN** the dashboard cannot resolve a reader to a supported kick endpoint
- **THEN** the client or UI MUST return a structured unsupported-action result instead of calling an arbitrary endpoint.
