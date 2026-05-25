## ADDED Requirements

### Requirement: Protocol Server Configuration
The dashboard SHALL allow authorized operators to view and patch MediaMTX protocol server configuration for RTSP/RTSPS, RTMP/RTMPS, HLS, WebRTC/WHEP/WHIP, SRT, and RTP/MPEG-TS.

#### Scenario: Protocol enable flags are edited
- **WHEN** an authorized operator enables or disables `rtsp`, `rtmp`, `hls`, `webrtc`, or `srt`
- **THEN** the dashboard MUST submit a field-scoped global configuration patch and preserve unrelated configuration values.

#### Scenario: Protocol addresses are edited
- **WHEN** an authorized operator changes protocol bind addresses such as `rtspAddress`, `rtspsAddress`, `rtmpAddress`, `rtmpsAddress`, `hlsAddress`, `webrtcAddress`, or `srtAddress`
- **THEN** the dashboard MUST validate the address format enough to prevent empty accidental submissions and send only changed supported fields.

#### Scenario: RTSP transport and encryption settings are edited
- **WHEN** an authorized operator configures `rtspTransports`, `rtspEncryption`, or `rtspAuthMethods`
- **THEN** the dashboard MUST restrict selections to supported values including `udp`, `multicast`, `tcp`, `no`, `strict`, `optional`, `basic`, and `digest` as applicable.

#### Scenario: RTP and multicast settings are edited
- **WHEN** an authorized operator configures RTP, RTCP, SRTP, SRTCP, multicast IP, or multicast port settings
- **THEN** the dashboard MUST include the corresponding MediaMTX global configuration fields in the patch only when those fields are supported by the loaded configuration or app schema.

#### Scenario: TLS settings are edited
- **WHEN** an authorized operator edits RTSP, RTMP, HLS, or WebRTC TLS key and certificate settings
- **THEN** the dashboard MUST provide explicit editable fields and MUST avoid exposing full secret material in audit summaries.

#### Scenario: HLS advanced settings are edited
- **WHEN** an authorized operator configures HLS HTTPS/TLS, always remux, variant, segment count, segment duration, part duration, CORS, or trusted proxy settings
- **THEN** the dashboard MUST patch the supported MediaMTX fields without introducing defaults for unavailable version-dependent fields.

#### Scenario: WebRTC advanced settings are edited
- **WHEN** an authorized operator configures WebRTC HTTPS/TLS, local UDP/TCP addresses, ICE servers, CORS, or trusted proxy settings
- **THEN** the dashboard MUST preserve structured ICE server data and patch only changed supported fields.

#### Scenario: RTP MPEG-TS settings are edited
- **WHEN** an authorized operator configures `rtspDemuxMpegts` or path-level RTP/MPEG-TS guidance fields such as `rtpSDP`
- **THEN** the dashboard MUST show the relevant setting in the protocol workflow and identify whether the setting is global or path-specific.

### Requirement: Protocol Runtime Resources
The dashboard SHALL list and inspect MediaMTX runtime resources for supported protocol servers.

#### Scenario: RTSP runtime resources are listed
- **WHEN** an operator opens RTSP runtime resources
- **THEN** the dashboard MUST show RTSP and RTSPS connections and sessions with loading, empty, error, and refresh states.

#### Scenario: RTSP session details are viewed
- **WHEN** an operator selects an RTSP or RTSPS session
- **THEN** the dashboard MUST display the session detail returned by the MediaMTX Control API.

#### Scenario: RTMP connection resources are listed
- **WHEN** an operator opens RTMP runtime resources
- **THEN** the dashboard MUST show RTMP and RTMPS connections with loading, empty, error, and refresh states.

#### Scenario: RTMP connection details are viewed
- **WHEN** an operator selects an RTMP or RTMPS connection
- **THEN** the dashboard MUST display the connection detail returned by the MediaMTX Control API.

#### Scenario: HLS muxers are listed
- **WHEN** an operator opens HLS runtime resources
- **THEN** the dashboard MUST show HLS muxers with loading, empty, error, and refresh states.

#### Scenario: HLS muxer details are viewed
- **WHEN** an operator selects an HLS muxer
- **THEN** the dashboard MUST display the muxer detail returned by the MediaMTX Control API.

#### Scenario: WebRTC sessions are listed
- **WHEN** an operator opens WebRTC runtime resources
- **THEN** the dashboard MUST show WebRTC sessions with loading, empty, error, and refresh states.

#### Scenario: WebRTC session details are viewed
- **WHEN** an operator selects a WebRTC session
- **THEN** the dashboard MUST display the session detail returned by the MediaMTX Control API.

#### Scenario: SRT connections are listed
- **WHEN** an operator opens SRT runtime resources
- **THEN** the dashboard MUST show SRT connections with loading, empty, error, and refresh states.

#### Scenario: SRT connection details are viewed
- **WHEN** an operator selects an SRT connection
- **THEN** the dashboard MUST display the connection detail returned by the MediaMTX Control API.

### Requirement: Protocol Runtime Actions
The dashboard SHALL provide safe kick actions for protocol runtime resources whose MediaMTX Control API clients support kicking.

#### Scenario: RTSP session is kicked
- **WHEN** an authorized operator confirms a kick action for an RTSP or RTSPS session
- **THEN** the dashboard MUST call the corresponding session kick endpoint and refresh the affected runtime list after success.

#### Scenario: RTMP connection is kicked
- **WHEN** an authorized operator confirms a kick action for an RTMP or RTMPS connection
- **THEN** the dashboard MUST call the corresponding connection kick endpoint and refresh the affected runtime list after success.

#### Scenario: WebRTC session is kicked
- **WHEN** an authorized operator confirms a kick action for a WebRTC session
- **THEN** the dashboard MUST call the WebRTC session kick endpoint and refresh the affected runtime list after success.

#### Scenario: SRT connection is kicked
- **WHEN** an authorized operator confirms a kick action for an SRT connection
- **THEN** the dashboard MUST call the SRT connection kick endpoint and refresh the affected runtime list after success.

#### Scenario: Kick is unavailable for a resource
- **WHEN** a protocol runtime resource has no supported kick endpoint
- **THEN** the dashboard MUST omit or disable the kick action instead of calling an unsupported endpoint.

### Requirement: Protocol Players and URL Helpers
The dashboard SHALL provide player entry points and generated protocol URLs for common MediaMTX publish and read workflows.

#### Scenario: HLS live player is opened
- **WHEN** an operator opens the HLS player for a path
- **THEN** the dashboard MUST build the playback URL from the configured HLS service URL and selected path.

#### Scenario: WebRTC player is opened
- **WHEN** an operator opens the WebRTC player for a path
- **THEN** the dashboard MUST provide a low-latency browser playback entry point or generated WebRTC read URL based on configured WebRTC service settings.

#### Scenario: Browser client URLs are shown
- **WHEN** an operator views WebRTC, WHEP, WHIP, or HLS browser client guidance
- **THEN** the dashboard MUST display publish and read URLs derived from configured service addresses and selected path.

#### Scenario: RTSP and RTMP URLs are shown
- **WHEN** an operator views RTSP, RTSPS, RTMP, or RTMPS stream guidance
- **THEN** the dashboard MUST display sample publish and read URLs using the configured protocol addresses and path placeholders.

#### Scenario: SRT URLs are shown
- **WHEN** an operator views SRT stream guidance
- **THEN** the dashboard MUST display sample SRT publish and read URLs and include path-level passphrase guidance when configured.

#### Scenario: RTP MPEG-TS URLs are shown
- **WHEN** an operator views RTP or MPEG-TS stream guidance
- **THEN** the dashboard MUST display sample RTP SDP and MPEG-TS publish/read guidance consistent with MediaMTX configuration.

### Requirement: SRT Metrics Display
The dashboard SHALL display SRT runtime metrics when they are present in MediaMTX SRT connection responses.

#### Scenario: SRT metrics are available
- **WHEN** an SRT connection response includes RTT, packet loss, retransmit, send rate, or receive rate values
- **THEN** the dashboard MUST show those metrics in the SRT connection list or detail view.

#### Scenario: SRT metrics are absent
- **WHEN** an SRT connection response omits one or more metric values
- **THEN** the dashboard MUST hide unavailable metric fields without failing the runtime resource view.
