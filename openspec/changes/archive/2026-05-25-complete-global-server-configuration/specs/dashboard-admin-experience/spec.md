## ADDED Requirements

### Requirement: Localized Global Config Admin States
The dashboard admin experience SHALL provide Vietnamese loading, empty, error, notification, and permission messages for global server configuration.

#### Scenario: Global config module state renders
- **WHEN** the global server configuration module is loading, empty, unavailable, or failed
- **THEN** the state title, description, retry action, and secondary actions MUST be shown in Vietnamese.

#### Scenario: Global config permission is missing
- **WHEN** a user lacks `api` permission in the global server configuration module
- **THEN** disabled controls or guard feedback MUST explain in Vietnamese that `api` permission is required.

#### Scenario: Global config notification renders
- **WHEN** a global configuration read or patch operation succeeds or fails
- **THEN** the dashboard MUST show Vietnamese non-blocking feedback and MUST NOT use browser `alert()`.
