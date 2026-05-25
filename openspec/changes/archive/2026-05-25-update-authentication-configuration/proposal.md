## Why

MediaMTX authentication settings are currently not manageable from the dashboard, forcing operators to edit configuration manually for internal users, external auth services, and JWT/JWKS setups. Adding a dedicated authentication configuration surface lets administrators safely view, edit, validate, and apply auth policy from the same UI used for global server configuration.

## What Changes

- Add an authentication configuration UI for reading and patching `authMethod` and all related MediaMTX auth settings.
- Support Internal auth management for `authInternalUsers`, including list, add, edit, and delete flows.
- Support username wildcard `any`, plain password entry, and hash entry with Argon2/SHA256 prefixes.
- Add IP allowlist editing and permission management by action and by path, including regex path permissions.
- Support HTTP auth configuration through `authHTTPAddress`, `authHTTPFingerprint`, `authHTTPExclude`, and a test auth endpoint action.
- Support JWT auth configuration through `authJWTJWKS`, `authJWTJWKSFingerprint`, `authJWTClaimKey`, `authJWTExclude`, `authJWTIssuer`, `authJWTAudience`, and a JWKS refresh action.
- Add a permission matrix covering `publish`, `read`, `playback`, `api`, `metrics`, and `pprof`.
- Preserve existing permission-aware dashboard behavior so only users with `api` permission can load or mutate authentication configuration.

## Capabilities

### New Capabilities
- `authentication-configuration-ui`: Dashboard UI and behavior for managing MediaMTX authentication mode, internal users, external auth settings, JWT settings, and permission matrices.

### Modified Capabilities
- `mediamtx-control-api-client`: Extend typed client coverage where needed for auth validation and JWKS refresh actions used by the authentication configuration UI.

## Impact

- Affected UI areas: global/admin configuration views, form state management, validation, notifications, audit events, and permission-aware controls.
- Affected client/API areas: typed MediaMTX global config read/patch payloads and auth helper endpoints such as JWKS refresh and HTTP auth test/probe.
- Affected tests: dashboard configuration tests, MediaMTX API client tests, permission matrix behavior, and form validation for internal, HTTP, and JWT auth modes.
