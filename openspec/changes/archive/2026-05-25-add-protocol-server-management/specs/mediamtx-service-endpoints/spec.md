## ADDED Requirements

### Requirement: Protocol Helper URL Generation
The system SHALL generate protocol helper URLs from configured MediaMTX service URLs, protocol addresses, and selected path names.

#### Scenario: HLS helper URL is generated
- **WHEN** the dashboard builds an HLS helper or player URL for a path
- **THEN** it MUST use the configured HLS base URL and append the path-specific HLS route.

#### Scenario: WebRTC helper URL is generated
- **WHEN** the dashboard builds a WebRTC, WHEP, or WHIP browser helper URL for a path
- **THEN** it MUST use the configured WebRTC address or browser-visible playback base URL and include the selected path.

#### Scenario: RTSP helper URL is generated
- **WHEN** the dashboard builds an RTSP or RTSPS helper URL for a path
- **THEN** it MUST use the configured RTSP or RTSPS address and include the selected path placeholder or value.

#### Scenario: RTMP helper URL is generated
- **WHEN** the dashboard builds an RTMP or RTMPS helper URL for a path
- **THEN** it MUST use the configured RTMP or RTMPS address and include the selected path placeholder or value.

#### Scenario: SRT helper URL is generated
- **WHEN** the dashboard builds an SRT helper URL for a path
- **THEN** it MUST use the configured SRT address and include stream id or path guidance compatible with MediaMTX SRT workflows.

#### Scenario: RTP MPEG-TS helper URL is generated
- **WHEN** the dashboard builds RTP or MPEG-TS helper guidance
- **THEN** it MUST include the configured relevant address or port values and clearly distinguish RTP SDP source guidance from MPEG-TS publish/read guidance.

#### Scenario: Protocol helper URL source is unavailable
- **WHEN** the dashboard cannot derive a configured address for a protocol helper URL
- **THEN** it MUST fall back to documented MediaMTX defaults or show an explicit placeholder instead of producing a malformed URL.
