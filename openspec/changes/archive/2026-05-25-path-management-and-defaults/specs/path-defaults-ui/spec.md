## ADDED Requirements

### Requirement: Path defaults are loaded and edited
The dashboard SHALL provide a dedicated screen for viewing and editing MediaMTX `pathDefaults`.

#### Scenario: Path defaults are loaded
- **WHEN** an operator opens the path defaults screen
- **THEN** the dashboard MUST call `/v3/config/pathdefaults/get` and populate editable default fields.

#### Scenario: Path defaults are saved
- **WHEN** an operator saves changed path defaults
- **THEN** the dashboard MUST call `/v3/config/pathdefaults/patch` with only changed default fields.

#### Scenario: Path defaults save fails
- **WHEN** MediaMTX rejects a path defaults patch
- **THEN** the dashboard MUST preserve unsaved changes and show field-level or general error feedback.

### Requirement: Defaults can be applied to paths
The dashboard SHALL allow operators to apply selected defaults to configured paths.

#### Scenario: Defaults are applied to all paths
- **WHEN** an operator confirms applying defaults to all configured paths
- **THEN** the dashboard MUST update each configured path with the selected default values through path patch operations.

#### Scenario: Defaults apply is previewed
- **WHEN** an operator prepares to apply defaults to paths
- **THEN** the dashboard MUST show a preview of affected paths and fields before dispatching mutations.

#### Scenario: Defaults apply is partially unsuccessful
- **WHEN** one or more path updates fail during apply-to-all
- **THEN** the dashboard MUST report successful and failed paths separately and keep enough detail for retry.

### Requirement: Path overrides are compared with defaults
The dashboard SHALL show how each path differs from `pathDefaults`.

#### Scenario: Path matches default
- **WHEN** a path field value equals the corresponding default value
- **THEN** the dashboard MUST mark that field as using the default.

#### Scenario: Path overrides default
- **WHEN** a path field value differs from the corresponding default value
- **THEN** the dashboard MUST show the path value, default value, and override status.

### Requirement: Path fields can be reset to default
The dashboard SHALL allow resetting individual path fields back to `pathDefaults`.

#### Scenario: Single path field is reset
- **WHEN** an operator resets one path field to its default value
- **THEN** the dashboard MUST patch that path field with the current default value.

#### Scenario: Reset is unavailable
- **WHEN** no default value exists for a selected field
- **THEN** the dashboard MUST disable reset for that field and explain that no default is available.

### Requirement: Path defaults can be imported and exported
The dashboard SHALL support importing and exporting `pathDefaults` as JSON and YAML.

#### Scenario: Defaults are exported as JSON
- **WHEN** an operator exports path defaults as JSON
- **THEN** the dashboard MUST download or copy a JSON representation of the current `pathDefaults`.

#### Scenario: Defaults are exported as YAML
- **WHEN** an operator exports path defaults as YAML
- **THEN** the dashboard MUST download or copy a YAML representation of the current `pathDefaults`.

#### Scenario: Defaults are imported
- **WHEN** an operator imports valid JSON or YAML path defaults
- **THEN** the dashboard MUST parse, validate, preview, and apply the imported defaults through the path defaults patch flow.

#### Scenario: Defaults import is invalid
- **WHEN** imported JSON or YAML cannot be parsed or contains invalid path default fields
- **THEN** the dashboard MUST show validation errors and MUST NOT patch MediaMTX.

### Requirement: Path defaults feedback and guards are enforced
The dashboard SHALL enforce permissions and provide operator feedback for path defaults actions.

#### Scenario: API permission is missing
- **WHEN** the current session lacks `api` permission
- **THEN** path defaults edit, save, import, and apply-to-all actions MUST be disabled and action handlers MUST reject direct execution.

#### Scenario: Defaults mutation succeeds
- **WHEN** a path defaults save, import, reset, or apply-to-all action succeeds
- **THEN** the dashboard MUST show a success notification and append an audit entry.

#### Scenario: Defaults mutation fails
- **WHEN** a path defaults save, import, reset, or apply-to-all action fails
- **THEN** the dashboard MUST preserve unsaved state, show a user-safe error notification, and append a failure audit entry.
