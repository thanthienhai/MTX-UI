## ADDED Requirements

### Requirement: Vietnamese Authentication Interface
The dashboard SHALL present login, logout, session expiry, permission, and authentication error UI in Vietnamese.

#### Scenario: Login form renders
- **WHEN** an unauthenticated user opens the login page
- **THEN** the form MUST show Vietnamese labels and actions for Basic Auth, bearer/JWT token login, username, password, token, server connection, and sign-in.

#### Scenario: Login fails
- **WHEN** MediaMTX is unreachable, credentials are rejected, API permission is missing, or the server returns an unexpected failure
- **THEN** the login page MUST show a Vietnamese error message that distinguishes the failure class.

#### Scenario: Session ends
- **WHEN** a user logs out or the session expires
- **THEN** the dashboard MUST clear the session and show Vietnamese navigation or notification text explaining that login is required again.

### Requirement: Auth Mode Request Headers
The dashboard SHALL derive request authorization headers from the active authentication mode.

#### Scenario: Basic Auth request is made
- **WHEN** the active session uses Basic Auth
- **THEN** MediaMTX API requests MUST include a Basic authorization header derived from the stored username and password through the session utility.

#### Scenario: Token request is made
- **WHEN** the active session uses bearer/JWT token authentication
- **THEN** MediaMTX API requests MUST include a Bearer authorization header derived from the stored token through the session utility.

### Requirement: Vietnamese Permission Display
The dashboard SHALL display the current user's effective MediaMTX permissions in Vietnamese while preserving the action keys `api`, `metrics`, `pprof`, `publish`, `read`, and `playback`.

#### Scenario: Permissions are displayed
- **WHEN** a valid session includes permission state
- **THEN** the dashboard MUST display granted, unavailable, or unknown state for each supported MediaMTX action with Vietnamese labels.

#### Scenario: Restricted control is unavailable
- **WHEN** the user lacks permission for a visible action
- **THEN** the disabled or hidden control MUST use Vietnamese explanatory text where a reason is shown.
