## ADDED Requirements

### Requirement: OpenAPI-Aligned TypeScript Schemas
The system SHALL expose TypeScript schemas or types that match the MediaMTX OpenAPI component and operation contracts used by the dashboard.

#### Scenario: Configuration schemas are consumed
- **WHEN** dashboard code reads or writes MediaMTX global, path default, or path configuration data
- **THEN** it MUST use normalized TypeScript types derived from `GlobalConf`, `PathConf`, `PathConfList`, and related OpenAPI schemas.

#### Scenario: Runtime schemas are consumed
- **WHEN** dashboard code reads runtime paths, muxers, connections, sessions, or recordings
- **THEN** it MUST use normalized TypeScript types derived from the corresponding OpenAPI schemas for those resources.

#### Scenario: Schema drift is detected during development
- **WHEN** OpenAPI-derived type generation or validation is run
- **THEN** mismatches between the checked-in schemas and `openapi.yaml` MUST fail the developer command or test that verifies API contract freshness.

### Requirement: Unified API Error Wrapper
The system SHALL represent API failures with a consistent error object across all MediaMTX client operations.

#### Scenario: Non-success response is received
- **WHEN** MediaMTX or the dashboard proxy returns a non-2xx response
- **THEN** the client MUST throw or return a `MediaMtxApiError` containing method, endpoint, status, status text, parsed error body when available, and a user-safe message.

#### Scenario: Response body is empty
- **WHEN** a successful MediaMTX response has no body
- **THEN** the client MUST return `null` or the operation-specific success type without raising a JSON parsing error.

#### Scenario: Response body is malformed
- **WHEN** a response declares JSON but cannot be parsed
- **THEN** the client MUST raise a `MediaMtxApiError` that identifies the parse failure and the affected endpoint.

#### Scenario: Network or proxy failure occurs
- **WHEN** the browser, Next.js proxy, or upstream server fails before a valid MediaMTX response is available
- **THEN** the client MUST expose the failure through the same error wrapper shape with the best available diagnostic context.

### Requirement: Request Construction Consistency
The system SHALL construct Control API requests consistently for methods, payloads, path parameters, query parameters, headers, and cache behavior.

#### Scenario: Path and id parameters contain special characters
- **WHEN** a path name, connection id, session id, or recording name is included in a URL
- **THEN** the client MUST encode the parameter exactly once before sending the request.

#### Scenario: Authenticated request is sent
- **WHEN** an auth header is available in the dashboard session
- **THEN** every Control API request MUST include it unless the operation is explicitly configured as unauthenticated.

#### Scenario: Mutating request is sent
- **WHEN** the client sends a POST, PATCH, PUT, or DELETE request with a body
- **THEN** it MUST serialize the body as JSON and include `Content-Type: application/json`.
