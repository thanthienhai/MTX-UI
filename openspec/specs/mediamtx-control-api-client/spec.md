## ADDED Requirements

### Requirement: Global and Path Configuration Client
The system SHALL provide typed client methods for MediaMTX global configuration, path defaults, and path configuration management.

#### Scenario: Global configuration is read
- **WHEN** the dashboard requests the global MediaMTX configuration
- **THEN** the client MUST send `GET /v3/config/global/get` and return the typed global configuration response.

#### Scenario: Global configuration is patched
- **WHEN** the dashboard submits a partial global configuration update
- **THEN** the client MUST send `PATCH /v3/config/global/patch` with the typed patch payload.

#### Scenario: Path defaults are managed
- **WHEN** the dashboard reads or updates default path configuration
- **THEN** the client MUST use `GET /v3/config/pathdefaults/get` and `PATCH /v3/config/pathdefaults/patch`.

#### Scenario: Path configuration lifecycle is managed
- **WHEN** the dashboard lists, reads, adds, patches, replaces, or deletes a path configuration
- **THEN** the client MUST use the corresponding `/v3/config/paths/list`, `/v3/config/paths/get/{name}`, `/v3/config/paths/add/{name}`, `/v3/config/paths/patch/{name}`, `/v3/config/paths/replace/{name}`, and `/v3/config/paths/delete/{name}` endpoints with encoded path names.

### Requirement: Runtime Resource Client
The system SHALL provide typed read methods for MediaMTX runtime paths and HLS muxers.

#### Scenario: Runtime paths are listed or read
- **WHEN** the dashboard requests runtime path information
- **THEN** the client MUST use `GET /v3/paths/list` and `GET /v3/paths/get/{name}` with typed list and item responses.

#### Scenario: HLS muxers are listed or read
- **WHEN** the dashboard requests HLS muxer information
- **THEN** the client MUST use `GET /v3/hlsmuxers/list` and `GET /v3/hlsmuxers/get/{name}` with typed list and item responses.

### Requirement: Protocol Connection and Session Client
The system SHALL provide typed list, get, and kick operations for protocol resources that support those operations.

#### Scenario: RTSP and RTSPS resources are managed
- **WHEN** the dashboard lists, reads, or kicks RTSP or RTSPS sessions and connections
- **THEN** the client MUST cover RTSP connections list/get, RTSP sessions list/get/kick, RTSPS connections list/get, and RTSPS sessions list/get/kick.

#### Scenario: RTMP and RTMPS connections are managed
- **WHEN** the dashboard lists, reads, or kicks RTMP or RTMPS connections
- **THEN** the client MUST cover RTMP connections list/get/kick and RTMPS connections list/get/kick.

#### Scenario: SRT connections are managed
- **WHEN** the dashboard lists, reads, or kicks SRT connections
- **THEN** the client MUST cover `GET /v3/srtconns/list`, `GET /v3/srtconns/get/{id}`, and `POST /v3/srtconns/kick/{id}`.

#### Scenario: WebRTC sessions are managed
- **WHEN** the dashboard lists, reads, or kicks WebRTC sessions
- **THEN** the client MUST cover `GET /v3/webrtcsessions/list`, `GET /v3/webrtcsessions/get/{id}`, and `POST /v3/webrtcsessions/kick/{id}`.

### Requirement: Authentication Configuration Client
The system SHALL provide typed MediaMTX client support for authentication configuration fields and auth helper operations used by the dashboard.

#### Scenario: Authentication global config fields are typed
- **WHEN** the dashboard reads or patches global configuration
- **THEN** the client types MUST include `authMethod`, `authInternalUsers`, `authHTTPAddress`, `authHTTPFingerprint`, `authHTTPExclude`, `authJWTJWKS`, `authJWTJWKSFingerprint`, `authJWTClaimKey`, `authJWTExclude`, `authJWTIssuer`, and `authJWTAudience`.

#### Scenario: Internal user permission fields are typed
- **WHEN** the dashboard manages an internal user's permissions
- **THEN** the client types MUST represent each permission with an `action` value and optional `path` value.

#### Scenario: JWKS refresh is executed
- **WHEN** the dashboard triggers JWT JWKS refresh
- **THEN** the client MUST send `POST /v3/auth/jwks/refresh` and treat an empty success response as a successful operation.

#### Scenario: HTTP auth endpoint is tested
- **WHEN** the dashboard tests HTTP authentication settings
- **THEN** the client MUST expose a typed operation for the MediaMTX auth test/probe endpoint and return success or structured failure details to the UI.

### Requirement: Recordings and JWKS Client
The system SHALL provide typed methods for recordings and JWT JWKS refresh operations.

#### Scenario: Recordings are listed and read
- **WHEN** the dashboard requests recording information
- **THEN** the client MUST use `GET /v3/recordings/list` and `GET /v3/recordings/get/{name}` with typed responses.

#### Scenario: Recording segments are deleted
- **WHEN** the dashboard deletes a recording segment
- **THEN** the client MUST send `DELETE /v3/recordings/deletesegment` with the typed segment deletion query or payload required by the OpenAPI contract.

#### Scenario: JWT JWKS is refreshed
- **WHEN** an authorized administrator triggers a JWKS refresh
- **THEN** the client MUST send `POST /v3/auth/jwks/refresh` and treat an empty success response as a successful operation.

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
