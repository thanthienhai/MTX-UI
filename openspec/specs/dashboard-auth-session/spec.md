## ADDED Requirements

### Requirement: Multi-mode MediaMTX login
The dashboard SHALL allow users to authenticate with either Basic Auth username/password credentials or a bearer token/JWT credential.

#### Scenario: Basic Auth login succeeds
- **WHEN** a user submits a username and password that can access the MediaMTX Control API
- **THEN** the dashboard stores a structured authenticated session and routes the user to the protected dashboard

#### Scenario: Token login succeeds
- **WHEN** a user submits a bearer token or JWT that can access the MediaMTX Control API
- **THEN** the dashboard stores a structured authenticated session using token credential mode and routes the user to the protected dashboard

### Requirement: Login validates API permission
The dashboard MUST validate Control API access after login and MUST prevent dashboard entry when the authenticated identity lacks `api` permission.

#### Scenario: Missing API permission
- **WHEN** submitted credentials are valid but the MediaMTX Control API rejects an API probe because `api` permission is missing
- **THEN** the login screen shows a permission-specific error and does not create an authenticated dashboard session

#### Scenario: API probe succeeds
- **WHEN** submitted credentials successfully complete the MediaMTX Control API probe
- **THEN** the session records that the current user has `api` access

### Requirement: Clear MediaMTX connection errors
The dashboard SHALL classify and display MediaMTX login failures as connection failures, invalid credentials, missing permission, or unexpected server failures.

#### Scenario: MediaMTX unreachable during login
- **WHEN** the login API probe cannot connect to MediaMTX or the dashboard proxy
- **THEN** the login screen shows a connection error with enough context for the operator to distinguish it from bad credentials

#### Scenario: MediaMTX rejects credentials
- **WHEN** MediaMTX returns an authentication failure for submitted credentials
- **THEN** the login screen shows an invalid credential error and keeps the user on the login screen

### Requirement: Dashboard session lifecycle
The dashboard SHALL manage authenticated sessions with logout, automatic expiration, and route protection.

#### Scenario: User logs out
- **WHEN** the user activates logout
- **THEN** the dashboard clears the authenticated session and routes the user to the login screen

#### Scenario: Session expires
- **WHEN** the stored session is past its expiry time
- **THEN** protected routes clear the session and route the user to the login screen before making protected MediaMTX requests

### Requirement: Safer credential storage abstraction
The dashboard MUST isolate credential persistence behind a session storage adapter and MUST NOT require UI components to read or write raw credential values directly through `sessionStorage`.

#### Scenario: UI needs auth header
- **WHEN** a dashboard API call needs credentials
- **THEN** it receives the appropriate Authorization header from the auth/session utility without reading browser storage directly

#### Scenario: Production storage strategy changes
- **WHEN** production deployment replaces browser storage with a server-managed or cookie-backed session mechanism
- **THEN** dashboard UI components continue to use the same session API without code changes

### Requirement: Current permission display
The dashboard SHALL display the current user's effective MediaMTX permissions for `api`, `metrics`, `pprof`, `publish`, `read`, and `playback`.

#### Scenario: Permissions are available
- **WHEN** an authenticated session includes resolved permissions
- **THEN** the dashboard displays each supported permission and whether it is granted or unavailable

### Requirement: Permission-aware UI controls
The dashboard MUST hide or disable functions when the current user lacks the permission required for that function.

#### Scenario: Metrics permission disabled
- **WHEN** the current user lacks `metrics` permission
- **THEN** metrics links and metrics quick actions are disabled or hidden and cannot be executed

#### Scenario: Protected action handler invoked with stale state
- **WHEN** a restricted action handler runs after permissions have changed or expired
- **THEN** the handler re-checks permission and blocks the action before calling MediaMTX
