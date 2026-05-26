## MODIFIED Requirements

### Requirement: Editable FFmpeg command preview

**FROM**: The system SHALL provide an editable textarea showing the full FFmpeg command.

**TO**: The system SHALL provide an editable textarea showing the full FFmpeg command using the reusable `HookCommandEditor` component.

#### Scenario: View generated command

- **WHEN** user configures forwarding settings
- **THEN** the `HookCommandEditor` SHALL display the generated FFmpeg command
- **AND** the user SHALL be able to edit the command directly
- **AND** the preset inputs (target type, URL) SHALL NOT overwrite manual edits

#### Scenario: Manual command edit preserved

- **WHEN** user manually edits the command textarea
- **THEN** the edited command SHALL be saved as-is when the form is submitted
- **THEN** subsequent changes to preset inputs SHALL update the textarea (overwriting manual edits)
