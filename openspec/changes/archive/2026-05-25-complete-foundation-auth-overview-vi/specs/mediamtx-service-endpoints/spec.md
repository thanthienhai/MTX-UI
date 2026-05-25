## ADDED Requirements

### Requirement: Vietnamese Service Endpoint Configuration UI
The dashboard SHALL present service endpoint configuration for the Control API, HLS, playback, metrics, and pprof servers with Vietnamese labels, helper text, validation messages, and save/reset actions.

#### Scenario: Endpoint settings are shown
- **WHEN** a user opens service endpoint configuration
- **THEN** the dashboard MUST display Vietnamese labels for Control API, HLS, playback, metrics, and pprof base URL fields while preserving the technical service names.

#### Scenario: Endpoint validation fails
- **WHEN** a configured service URL is empty where required or has an invalid URL format
- **THEN** the dashboard MUST show a Vietnamese validation message and MUST NOT save the invalid setting.

#### Scenario: Endpoint settings are saved
- **WHEN** the user saves valid service endpoint settings
- **THEN** subsequent Control API requests, HLS URLs, playback URLs, metrics links or fetches, and pprof links MUST use the saved independent base URLs.

### Requirement: Browser and Proxy URL Separation Is Visible
The dashboard SHALL distinguish browser-visible service URLs from the server-side Control API proxy upstream in Vietnamese configuration copy.

#### Scenario: User edits browser-visible URLs
- **WHEN** a user changes HLS, playback, metrics, or pprof browser-visible URLs
- **THEN** the UI MUST explain in Vietnamese that these settings affect browser links and players, not the server-side Control API proxy upstream.

#### Scenario: User edits Control API base URL
- **WHEN** a user changes the Control API browser base URL
- **THEN** the dashboard MUST continue to normalize and route Control API browser requests independently from the server-side proxy upstream configuration.
