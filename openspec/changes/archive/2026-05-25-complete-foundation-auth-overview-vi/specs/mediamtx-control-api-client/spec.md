## ADDED Requirements

### Requirement: Foundational Control API Coverage Verification
The system SHALL verify that the MediaMTX API client exposes all foundational Control API operations required by `todo.md` section 0.

#### Scenario: Configuration endpoints are covered
- **WHEN** client coverage tests run
- **THEN** they MUST verify typed methods for global config get/patch, path defaults get/patch, and path config list/get/add/patch/replace/delete.

#### Scenario: Runtime and protocol endpoints are covered
- **WHEN** client coverage tests run
- **THEN** they MUST verify typed methods for runtime paths list/get, HLS muxers list/get, RTSP and RTSPS connections/sessions list/get/kick where supported, RTMP and RTMPS connections list/get/kick, SRT connections list/get/kick, and WebRTC sessions list/get/kick.

#### Scenario: Recording and JWKS endpoints are covered
- **WHEN** client coverage tests run
- **THEN** they MUST verify typed methods for recordings list/get/delete segment and JWT JWKS refresh.

### Requirement: Client Errors Remain User-Safe
The MediaMTX API client SHALL continue to wrap failed foundational endpoint calls in the dashboard's unified API error type.

#### Scenario: Foundational endpoint fails
- **WHEN** a foundational Control API request fails because of network, authentication, permission, validation, or server errors
- **THEN** the client MUST expose a normalized error with status, operation context when available, and a user-safe Vietnamese-ready message.
