## ADDED Requirements

### Requirement: Authentication configuration is loaded and saved
The dashboard SHALL provide an authentication configuration UI that reads MediaMTX authentication settings from global configuration and saves changed authentication fields through the global configuration patch flow.

#### Scenario: Authentication configuration is loaded
- **WHEN** an operator opens the authentication configuration view
- **THEN** the dashboard MUST fetch `GET /v3/config/global/get` and populate auth method, internal users, HTTP auth settings, JWT auth settings, exclude rules, and permission matrix state from the returned configuration.

#### Scenario: Authentication configuration is patched
- **WHEN** an operator changes authentication settings and confirms save
- **THEN** the dashboard MUST send `PATCH /v3/config/global/patch` with only changed authentication fields.

#### Scenario: API permission is missing
- **WHEN** the current session lacks `api` permission
- **THEN** the dashboard MUST disable authentication configuration reads, writes, HTTP auth tests, and JWKS refresh actions.

### Requirement: Authentication method selection
The dashboard SHALL allow operators to read and edit `authMethod` for internal, HTTP, and JWT authentication modes.

#### Scenario: Auth method is changed
- **WHEN** an operator selects `internal`, `http`, or `jwt` as the authentication method
- **THEN** the save payload MUST include `authMethod` with the selected value only when it differs from the loaded configuration.

#### Scenario: Mode-specific fields are shown
- **WHEN** an operator selects an authentication method
- **THEN** the dashboard MUST show the fields relevant to that method while preserving unsaved values entered in other auth method sections.

### Requirement: Internal users are managed
The dashboard SHALL allow operators to list, add, edit, and delete entries in `authInternalUsers`.

#### Scenario: Internal users are listed
- **WHEN** the loaded configuration includes `authInternalUsers`
- **THEN** the dashboard MUST render each internal user with username, password status, IP allowlist, and assigned permissions.

#### Scenario: Internal user is added
- **WHEN** an operator adds an internal user
- **THEN** the dashboard MUST append a user entry to `authInternalUsers` with username, optional password, IP allowlist, and permissions selected in the form.

#### Scenario: Internal user is edited
- **WHEN** an operator edits an existing internal user
- **THEN** the dashboard MUST update that user entry without changing the user's password unless the operator explicitly provides a replacement password value.

#### Scenario: Internal user is deleted
- **WHEN** an operator deletes an internal user and confirms the action
- **THEN** the dashboard MUST remove that user from `authInternalUsers` in the next save payload.

#### Scenario: Username wildcard is configured
- **WHEN** an operator enters `any` as the username
- **THEN** the dashboard MUST preserve `any` as the username value and treat it as the MediaMTX wildcard identity.

### Requirement: Internal user password input
The dashboard SHALL support plain password values and recognized hash-prefixed password values for internal users.

#### Scenario: Plain password is entered
- **WHEN** an operator enters a password without a recognized hash prefix
- **THEN** the dashboard MUST include the entered value as the user's `pass` value in the configuration payload.

#### Scenario: Hash-prefixed password is entered
- **WHEN** an operator enters a password value with an Argon2 or SHA256 prefix
- **THEN** the dashboard MUST preserve the exact hash-prefixed value in the user's `pass` value without rehashing or altering it.

#### Scenario: Existing password is kept
- **WHEN** an operator edits a user and leaves the password replacement field empty
- **THEN** the dashboard MUST omit password changes for that user and MUST NOT replace the password with an empty string.

### Requirement: IP allowlists are configured
The dashboard SHALL allow operators to configure IP allowlists for internal users.

#### Scenario: IP allowlist is edited
- **WHEN** an operator adds or removes IP or CIDR values for an internal user
- **THEN** the dashboard MUST serialize the values to the user's `ips` array.

#### Scenario: Empty IP allowlist is saved
- **WHEN** an operator leaves an internal user's IP allowlist empty
- **THEN** the dashboard MUST represent the user without restrictive IP entries according to the MediaMTX configuration model.

### Requirement: Permission matrix is managed
The dashboard SHALL provide a permission matrix for the actions `publish`, `read`, `playback`, `api`, `metrics`, and `pprof`.

#### Scenario: Action permissions are selected
- **WHEN** an operator toggles action permissions in the matrix
- **THEN** the dashboard MUST serialize selected actions as permission entries for the edited internal user or exclude list.

#### Scenario: Path-scoped permission is configured
- **WHEN** an operator assigns a permission to a specific path
- **THEN** the dashboard MUST serialize the permission with both `action` and `path`.

#### Scenario: Regex path permission is configured
- **WHEN** an operator marks a path permission as regex-based
- **THEN** the dashboard MUST preserve the regex path expression in the serialized permission path and visually distinguish it from exact path entries.

### Requirement: HTTP authentication is configured and tested
The dashboard SHALL allow operators to configure HTTP authentication settings and run a test against the configured HTTP auth endpoint.

#### Scenario: HTTP auth fields are edited
- **WHEN** an operator edits HTTP auth settings
- **THEN** the dashboard MUST support `authHTTPAddress`, `authHTTPFingerprint`, and `authHTTPExclude` values in the save payload.

#### Scenario: HTTP auth exclude permissions are edited
- **WHEN** an operator edits HTTP auth exclude rules
- **THEN** the dashboard MUST serialize excluded action/path permissions to `authHTTPExclude`.

#### Scenario: HTTP auth endpoint is tested
- **WHEN** an operator triggers the HTTP auth test action
- **THEN** the dashboard MUST call the MediaMTX auth test/probe operation with the entered HTTP auth settings and show success or failure without saving unrelated configuration changes.

### Requirement: JWT authentication is configured
The dashboard SHALL allow operators to configure JWT authentication settings and trigger JWKS refresh.

#### Scenario: JWT fields are edited
- **WHEN** an operator edits JWT auth settings
- **THEN** the dashboard MUST support `authJWTJWKS`, `authJWTJWKSFingerprint`, `authJWTClaimKey`, `authJWTExclude`, `authJWTIssuer`, and `authJWTAudience` values in the save payload.

#### Scenario: JWT exclude permissions are edited
- **WHEN** an operator edits JWT exclude rules
- **THEN** the dashboard MUST serialize excluded action/path permissions to `authJWTExclude`.

#### Scenario: JWKS refresh is triggered
- **WHEN** an operator triggers JWKS refresh
- **THEN** the dashboard MUST call the JWKS refresh client operation and show a success or failure notification.

### Requirement: Authentication changes provide operator feedback
The dashboard SHALL provide preview, validation, notification, and audit feedback for authentication configuration changes.

#### Scenario: Patch payload is previewed
- **WHEN** an operator prepares to save authentication changes
- **THEN** the dashboard MUST show a JSON preview of the authentication patch payload before dispatch.

#### Scenario: Save succeeds
- **WHEN** an authentication configuration patch succeeds
- **THEN** the dashboard MUST show a success notification, update its synced state, and append an audit event for the changed auth section.

#### Scenario: Save fails
- **WHEN** an authentication configuration patch fails
- **THEN** the dashboard MUST show field-level errors when available and a general non-blocking error notification otherwise.
