## ADDED Requirements

### Requirement: Global Config Patch Client Suitability
The MediaMTX Control API client SHALL support field-scoped global configuration patching for dashboard forms.

#### Scenario: Partial global config patch is sent
- **WHEN** the dashboard submits a field-scoped global configuration patch
- **THEN** the client MUST send `PATCH /v3/config/global/patch` with the provided partial `GlobalConf` payload without adding unchanged fields.

#### Scenario: Global config patch fails
- **WHEN** MediaMTX rejects a global config patch
- **THEN** the client MUST expose the response status, operation endpoint, response body, and a user-safe message through the unified API error wrapper.
