## ADDED Requirements

### Requirement: Vietnamese Common Dashboard States
The dashboard SHALL render common loading, empty, error, refresh, notification, audit, and permission guard messages in Vietnamese for the foundation, auth/session, and overview workflows.

#### Scenario: Module state renders
- **WHEN** an affected module is loading, empty, or failed
- **THEN** the state title, description, retry action, and secondary actions MUST be shown in Vietnamese.

#### Scenario: Notification renders
- **WHEN** an affected administrative action succeeds or fails
- **THEN** the toast or notification title and message MUST be shown in Vietnamese and MUST NOT use a blocking browser alert.

#### Scenario: Audit entry renders
- **WHEN** an affected administrative operation is recorded in the dashboard audit log
- **THEN** the visible action label, result label, and error summary MUST be understandable to Vietnamese users while preserving technical target identifiers.

### Requirement: Vietnamese Refresh and Polling Controls
The dashboard SHALL present refresh and polling configuration for affected modules in Vietnamese.

#### Scenario: Manual refresh is available
- **WHEN** a user can refresh overview or foundational module data
- **THEN** the dashboard MUST label the refresh action and latest refresh status in Vietnamese.

#### Scenario: Polling can be configured
- **WHEN** polling is enabled, disabled, or its interval is changed for an affected module
- **THEN** the controls and feedback MUST use Vietnamese text and MUST continue to prevent timer leaks.
