## 1. Client and Contract Support

- [x] 1.1 Extend `GlobalConf` and related auth types with `authMethod`, HTTP auth fields, JWT issuer/audience fields, exclude permission arrays, and internal user permission arrays.
- [x] 1.2 Add or update typed client helpers for authentication configuration patching, JWKS refresh, and HTTP auth test/probe behavior.
- [x] 1.3 Update local OpenAPI contract data or contract assertions for auth fields and auth helper endpoints required by the target MediaMTX version.
- [x] 1.4 Add client tests covering auth config typing, changed auth field patch payloads, JWKS refresh, and HTTP auth test/probe failure handling.

## 2. Auth Configuration State Model

- [x] 2.1 Create auth configuration form mapping utilities to convert `GlobalConf` into editable auth method, internal user, HTTP, JWT, and permission matrix state.
- [x] 2.2 Create serialization utilities that produce a minimal `Partial<GlobalConf>` patch containing only changed authentication fields.
- [x] 2.3 Implement password replacement handling so blank edit fields keep existing passwords and explicit plain or Argon2/SHA256-prefixed values are preserved.
- [x] 2.4 Implement permission row helpers for action-only, path-scoped, and regex path permissions across internal users and exclude lists.

## 3. Authentication Configuration UI

- [x] 3.1 Replace the static auth tab content with a live authentication configuration component loaded from `getGlobalConfig()`.
- [x] 3.2 Add auth method controls for `internal`, `http`, and `jwt` that show mode-specific fields while preserving unsaved values across modes.
- [x] 3.3 Implement internal user list, add, edit, delete, username `any`, password replacement, and IP allowlist controls.
- [x] 3.4 Implement the permission matrix for `publish`, `read`, `playback`, `api`, `metrics`, and `pprof` with action, path, and regex path editing.
- [x] 3.5 Implement HTTP auth fields for `authHTTPAddress`, `authHTTPFingerprint`, `authHTTPExclude`, and the HTTP auth test/probe action.
- [x] 3.6 Implement JWT fields for `authJWTJWKS`, `authJWTJWKSFingerprint`, `authJWTClaimKey`, `authJWTExclude`, `authJWTIssuer`, `authJWTAudience`, and JWKS refresh.

## 4. Permissions, Feedback, and Safety

- [x] 4.1 Enforce existing `api` permission checks for loading, saving, HTTP auth testing, and JWKS refresh actions.
- [x] 4.2 Add authentication patch payload preview before save and keep saves explicit.
- [x] 4.3 Add field-level validation and error display for usernames, password replacement, IP allowlists, permission rows, HTTP settings, and JWT settings.
- [x] 4.4 Add success/error notifications and audit events for auth configuration saves, HTTP auth tests, and JWKS refresh.
- [x] 4.5 Ensure failed auth configuration patches preserve the operator's unsaved form state.

## 5. Verification

- [x] 5.1 Add unit tests for auth form mapping, minimal patch serialization, password preservation, and permission matrix serialization.
- [x] 5.2 Add dashboard interaction tests for loading auth configuration, editing internal users, switching auth methods, saving patches, and permission-disabled states.
- [x] 5.3 Add tests for HTTP auth test/probe and JWKS refresh success and failure notifications.
- [x] 5.4 Run the existing MediaMTX API, dashboard experience, and auth session test scripts and fix regressions.
- [x] 5.5 Run OpenSpec validation for `update-authentication-configuration` after implementation artifacts are complete.
