## ADDED Requirements

### Requirement: WebRTC Player renders video stream via WHEP protocol
The system SHALL provide a player component that consumes WebRTC streams using the WHEP (WebRTC HTML5 Embed Play) protocol. The component SHALL use the `mediamtx-webrtc-react` library for WebRTC connection management.

#### Scenario: Player loads and displays stream
- **WHEN** the component mounts with a valid `pathName`
- **THEN** it SHALL build the WHEP URL using `buildMediaMtxWebRtcReadUrl(pathName)` and establish a WHEP connection via `useMediaMTXWebRTC` hook
- **THEN** it SHALL render a `<video>` element with the received `MediaStream` attached via `srcObject`
- **THEN** it SHALL display a loading indicator while `isConnecting` is true

#### Scenario: Player handles connection failure
- **WHEN** the WHEP connection fails (invalid URL, server unreachable, ICE failure)
- **THEN** the component SHALL display an error message with the error detail
- **THEN** the component SHALL offer a retry mechanism

#### Scenario: Player cleanup on unmount
- **WHEN** the component unmounts
- **THEN** it SHALL close the WHEP connection via `close()` from the hook
- **THEN** it SHALL detach the MediaStream from the video element

### Requirement: WebRTC Player UI follows existing player pattern
The WHEP player SHALL follow the same visual pattern as `StreamPlayer` (HLS) for UI consistency.

#### Scenario: Visual layout matches HLS player
- **WHEN** the WHEP player is rendered
- **THEN** it SHALL use 16:9 aspect ratio container with black background
- **THEN** it SHALL render `<video>` with `controls playsInline muted` attributes
- **THEN** loading state SHALL show spinner (same pattern as `module-state.tsx`)
- **THEN** error state SHALL show error message in red overlay

#### Scenario: Props interface matches HLS player
- **WHEN** the component is instantiated
- **THEN** it SHALL accept `pathName: string` as required prop
- **THEN** it MAY accept optional `className` prop for additional styling

### Requirement: WebRTC Player integrates into preview locations
The WHEP player SHALL be available in all locations where HLS player is currently used for stream preview.

#### Scenario: Preview button in path list
- **WHEN** user clicks a "WebRTC" preview button on a path row
- **THEN** the system SHALL render the WHEP player inline below the path row
- **THEN** the player SHALL only render if the path is live (`runtimePath.ready === true`)

#### Scenario: Preview in Path Actions dialog
- **WHEN** user opens Path Actions dialog for a live path
- **THEN** the dialog SHALL include a "WebRTC Live Preview" toggle
- **THEN** toggling on SHALL render the WHEP player inside the dialog

### Requirement: WebRTC URL display
Path Actions dialog SHALL display the WHEP URL alongside other protocol URLs.

#### Scenario: WHEP URL shown
- **WHEN** viewing path URLs in Path Actions
- **THEN** the WHEP URL (from `buildPathStreamUrls(pathName).webrtc`) SHALL be displayed
- **THEN** a "Copy" button SHALL copy the URL to clipboard
- **THEN** an "Open" button SHALL open the URL in a new tab
