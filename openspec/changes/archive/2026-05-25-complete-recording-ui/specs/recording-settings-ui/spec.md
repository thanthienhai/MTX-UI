## ADDED Requirements

### Requirement: Recording settings are loaded from path defaults
The dashboard SHALL load recording-specific settings from `pathDefaults` via `GET /v3/config/pathdefaults/get` and populate the recording settings form.

#### Scenario: Recording settings loaded on tab switch
- **WHEN** an operator switches to the Recording tab
- **THEN** the dashboard MUST fetch current path defaults and extract recording fields (`record`, `recordPath`, `recordFormat`, `recordPartDuration`, `recordSegmentDuration`, `recordMaxPartSize`, `recordDeleteAfter`) into editable form fields.

#### Scenario: Recording settings load fails
- **WHEN** MediaMTX is unreachable or returns an error during path defaults fetch
- **THEN** the dashboard MUST show an error state with a retry button and MUST NOT show stale data.

### Requirement: Recording settings are saved via path defaults patch
The dashboard SHALL save recording settings by sending a partial PATCH to `/v3/config/pathdefaults/patch` with only the changed recording fields.

#### Scenario: Recording settings are saved
- **WHEN** an operator modifies recording settings and clicks "Lưu"
- **THEN** the dashboard MUST compute a diff of changed recording fields, show a preview of the patch payload, and upon confirmation call `PATCH /v3/config/pathdefaults/patch`.

#### Scenario: Recording settings save succeeds
- **WHEN** the patch succeeds
- **THEN** the dashboard MUST show a success notification ("Đã lưu cài đặt ghi hình"), update local state, append audit event.

#### Scenario: Recording settings save fails
- **WHEN** the patch is rejected by MediaMTX
- **THEN** the dashboard MUST preserve unsaved changes, show field-level or general error feedback, append failure audit event.

### Requirement: Record toggle enables/disables dependent fields
The dashboard SHALL disable recording-specific fields (`recordPath`, `recordFormat`, etc.) when recording is toggled off.

#### Scenario: Recording disabled
- **WHEN** an operator sets `record` to `false`
- **THEN** all dependent recording fields MUST be visually disabled and excluded from the patch payload.

#### Scenario: Recording enabled
- **WHEN** an operator sets `record` to `true`
- **THEN** all dependent recording fields MUST be editable and included in the patch payload.

### Requirement: recordMaxPartSize field supports size value
The dashboard SHALL provide an input for `recordMaxPartSize` that accepts size values with units (e.g., `50M`, `100M`, `1G`).

#### Scenario: recordMaxPartSize is editable
- **WHEN** an operator edits `recordMaxPartSize`
- **THEN** the dashboard MUST accept values with suffix `M` (megabytes) or `G` (gigabytes) and validate the format before patch.

#### Scenario: recordMaxPartSize validation fails
- **WHEN** an operator enters an invalid size value
- **THEN** the dashboard MUST show a validation error and prevent patch submission.
