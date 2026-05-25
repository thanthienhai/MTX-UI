## ADDED Requirements

### Requirement: Path Contract Coverage
The checked-in API contract tests SHALL verify the MediaMTX path fields and operations used by path management and path defaults features.

#### Scenario: Path configuration fields are checked
- **WHEN** contract verification runs
- **THEN** it MUST assert that the local OpenAPI contract contains path configuration fields used by the UI, including common source options, reader limits, publisher override, absolute timestamp usage, recording fields, and source-specific fields selected for implementation.

#### Scenario: Path defaults operations are checked
- **WHEN** contract verification runs
- **THEN** it MUST assert that `GET /v3/config/pathdefaults/get` and `PATCH /v3/config/pathdefaults/patch` exist with the expected methods.

#### Scenario: Path lifecycle operations are checked
- **WHEN** contract verification runs
- **THEN** it MUST assert that path list, get, add, patch, replace, and delete configuration endpoints exist with the expected methods.

#### Scenario: Runtime path operations are checked
- **WHEN** contract verification runs
- **THEN** it MUST assert that runtime path list and get endpoints exist with the expected methods.

### Requirement: Path URL Builder Coverage
The system SHALL verify URL builder behavior for path stream actions.

#### Scenario: Stream URL builders are checked
- **WHEN** URL utility tests run
- **THEN** they MUST cover generated RTSP, RTSPS, RTMP, HLS, WebRTC, and SRT URLs for normal path names and names that require encoding.

#### Scenario: all_others URL behavior is checked
- **WHEN** URL utility tests run for `all_others`
- **THEN** they MUST verify that generated URLs preserve the path name consistently with other path names.
