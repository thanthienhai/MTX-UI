## MODIFIED Requirements

### Requirement: On-demand publishing UI is exposed

**FROM**: The dashboard SHALL provide a collapsible "On-Demand Publishing" section in the path add/edit form for configuring `runOnDemand`, `runOnDemandRestart`, and `runOnUnDemand`.

**TO**: The dashboard SHALL provide a collapsible "On-Demand Publishing" section in the path add/edit form for configuring `runOnDemand`, `runOnDemandRestart`, and `runOnUnDemand`. The section SHALL use the reusable `HookCommandEditor` component for its command textarea while retaining its specialized template selector.

#### Scenario: On-demand publishing section is visible

- **WHEN** an operator scrolls to the On-Demand Publishing section in the path form
- **THEN** the dashboard MUST show an expandable section labeled "On-Demand Publishing"
- **AND** the section MUST contain fields for `runOnDemand`, `runOnDemandRestart`, and `runOnUnDemand`
- **AND** the `runOnDemand` field SHALL use the `HookCommandEditor` component

#### Scenario: runOnDemand command is configured

- **WHEN** an operator enters a command in the `runOnDemand` field and saves
- **THEN** the dashboard MUST include `runOnDemand` in the path payload

#### Scenario: runOnDemand restart is enabled

- **WHEN** an operator toggles `runOnDemandRestart` on
- **THEN** the dashboard MUST set `runOnDemandRestart: true` in the path payload

#### Scenario: runOnUnDemand command is configured

- **WHEN** an operator enters a command in the `runOnUnDemand` field and saves
- **THEN** the dashboard MUST include `runOnUnDemand` in the path payload

## ADDED Requirements

### Requirement: Raw command editing via HookCommandEditor

The on-demand publishing section SHALL use the reusable `HookCommandEditor` which provides multiline editing, env var helper, and security warning.

#### Scenario: Env vars are displayed for runOnDemand

- **WHEN** the on-demand publishing section is expanded with the `HookCommandEditor` active
- **THEN** the env var helper SHALL show: `MTX_PATH`, `MTX_QUERY`, `RTSP_PORT`, `G1`, `G2`, `G3`...
