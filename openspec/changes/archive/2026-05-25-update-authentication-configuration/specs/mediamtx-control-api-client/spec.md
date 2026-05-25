## ADDED Requirements

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
