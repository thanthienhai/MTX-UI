## ADDED Requirements

### Requirement: Independent Service Base URLs
The system SHALL support independent base URL configuration for the MediaMTX Control API, HLS server, playback server, metrics server, and pprof server.

#### Scenario: Control API base URL is configured
- **WHEN** the dashboard builds a Control API request
- **THEN** it MUST use the configured Control API base URL or the existing `/api/mediamtx` proxy default.

#### Scenario: HLS base URL is configured
- **WHEN** the stream player builds an HLS playback URL
- **THEN** it MUST use the configured HLS base URL and produce a valid path-specific HLS URL.

#### Scenario: Playback base URL is configured
- **WHEN** the dashboard builds a non-HLS playback URL
- **THEN** it MUST use the configured playback base URL independently from the HLS and Control API URLs.

#### Scenario: Metrics base URL is configured
- **WHEN** the dashboard links to or fetches metrics
- **THEN** it MUST use the configured metrics base URL independently from the Control API URL.

#### Scenario: pprof base URL is configured
- **WHEN** the dashboard links to or fetches pprof data
- **THEN** it MUST use the configured pprof base URL independently from the Control API URL.

### Requirement: URL Normalization
The system SHALL normalize configured MediaMTX service URLs before use.

#### Scenario: Base URL has trailing slashes
- **WHEN** a configured service base URL ends with one or more slashes
- **THEN** the URL helper MUST remove trailing slashes before appending endpoint or path segments.

#### Scenario: Control API URL includes version suffix
- **WHEN** a configured Control API URL ends with `/v3` or `/v3/config`
- **THEN** the Control API helper MUST normalize it to the API root before appending requested endpoints.

#### Scenario: No base URL is configured
- **WHEN** a service base URL is missing
- **THEN** the helper MUST use the documented default for that service.

### Requirement: Server Proxy Upstream Configuration
The system SHALL keep server-side Control API proxy upstream resolution separate from browser-visible service URLs.

#### Scenario: Proxy receives Control API request
- **WHEN** the Next.js proxy route forwards a browser Control API request
- **THEN** it MUST use the server-side upstream Control API URL configuration and preserve query strings, allowed headers, method, and request body.

#### Scenario: Browser-visible URL changes
- **WHEN** browser-visible HLS, playback, metrics, or pprof URLs are changed
- **THEN** the proxy upstream Control API URL MUST remain unchanged unless its own server-side setting is changed.
