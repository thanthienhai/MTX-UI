## Context

The dashboard is a Next.js/React application with a typed MediaMTX Control API client in `lib/mediamtx-api.ts`, browser URL helpers in `lib/mediamtx-url.mjs`, Vietnamese dashboard UI in `app/page.tsx` and components, and existing notification, audit, permission, and module-state helpers. The current code already has typed client coverage for global configuration, HLS muxers, RTSP/RTSPS resources, RTMP/RTMPS connections, SRT connections, and WebRTC sessions, but the operator-facing protocol server workflow is incomplete.

This change should complete `todo.md` section 4 by adding one coherent protocol management surface rather than scattering fields across unrelated panels. MediaMTX versions differ in available global configuration fields, so the UI must preserve unknown values and treat absent fields as unsupported instead of forcing defaults into patch payloads.

## Goals / Non-Goals

**Goals:**
- Provide a protocol server management UI for RTSP/RTSPS, RTMP/RTMPS, HLS, WebRTC/WHEP/WHIP, SRT, and RTP/MPEG-TS.
- Reuse existing Control API clients for configuration read/patch, runtime list/detail, and kick operations.
- Keep protocol configuration patches field-scoped and reviewable, with validation for enum, address, port, TLS, and duration-like values.
- Show runtime lists, detail views, and safe kick confirmations for supported protocol resources.
- Generate stream helper URLs from current configuration and existing browser-visible service URL settings.
- Provide HLS and WebRTC player entry points while keeping protocol-specific advanced playback behavior isolated.
- Preserve Vietnamese copy, permission guards, loading/empty/error states, non-blocking notifications, and audit logging.

**Non-Goals:**
- Replacing the MediaMTX Control API or adding a custom backend service.
- Implementing unsupported MediaMTX endpoints not present in the bundled OpenAPI contract.
- Persisting protocol configuration outside MediaMTX global/path configuration.
- Building a full standalone WebRTC WHIP/WHEP SDK; the dashboard only needs operator-focused player and URL helper entry points.

## Decisions

### Use a dedicated protocol management module

Create a dedicated protocol server view or component that groups protocol configuration, runtime resources, and URL helpers by protocol. This keeps the global configuration editor focused while still using the same `getGlobalConfig` and `patchGlobalConfig` client methods.

Alternative considered: extend the existing global configuration form with every protocol field. That would reduce component count but make the operator workflow harder to scan and would mix protocol runtime actions with unrelated global settings.

### Patch only changed supported fields

Build patch payloads from edited fields that exist in the loaded global configuration or are explicitly supported by the current app schema. Multi-value fields such as transports, auth methods, trusted proxies, CORS origins, and ICE servers should be edited as structured arrays and serialized to the shape expected by the current MediaMTX config.

Alternative considered: submit a full global configuration object after every edit. That risks overwriting unknown or version-specific values and makes rollback harder.

### Model runtime resources with a shared protocol resource pattern

Use the existing protocol clients in `lib/mediamtx-api.ts` and build a reusable runtime table/detail/kick pattern for resources that have similar list/get/kick behavior. RTSP connections remain read-only unless the API supports kick; RTSP sessions, RTMP/RTMPS connections, SRT connections, and WebRTC sessions expose kick actions with confirmation and audit entries.

Alternative considered: build one bespoke table per protocol. Some custom rendering is still needed, but a shared shell reduces drift in loading/error/empty states, refresh controls, and action handling.

### Derive helper URLs from config and service URL helpers

Generate URLs from the loaded protocol addresses, configured browser-visible base URLs, and selected path names. HLS and WebRTC browser URLs should prefer HTTP(S) service URL helpers; RTSP, RTSPS, RTMP, RTMPS, SRT, RTP, and MPEG-TS examples should use configured addresses and explicit placeholders for stream path, credentials, passphrase, SDP, or port values when needed.

Alternative considered: hard-code localhost examples. That is acceptable as a fallback, but it is less useful for deployed dashboards behind reverse proxies.

### Display optional metrics defensively

SRT runtime responses can vary by MediaMTX version. Render RTT, loss, retransmit, and send/receive rates when present, hide missing metrics without errors, and expose raw detail fields in the detail view for troubleshooting.

Alternative considered: require exact metric field names in the UI. That would be brittle against MediaMTX version differences.

## Risks / Trade-offs

- MediaMTX configuration fields vary by version -> Render unsupported fields as unavailable and avoid sending absent fields in patch payloads.
- TLS key/cert fields can contain sensitive material -> Use masked inputs or text areas with explicit edit intent and avoid echoing full values in audit payload summaries.
- Kick actions are disruptive -> Require confirmation, gate by `api` permission, show non-blocking result notifications, and record audit entries.
- Protocol helper URLs can be wrong behind complex proxies -> Let configured service base URLs override derived defaults and show the source of the generated URL.
- A large protocol surface can become visually dense -> Use protocol tabs or sections with compact tables and stable module states rather than one long uncontrolled form.

## Migration Plan

1. Add the protocol management UI alongside existing dashboard modules without changing existing route structure.
2. Reuse existing Control API proxy and typed clients; add only missing types/helpers if implementation discovers contract gaps.
3. Verify configuration patch payloads against `openapi.yaml` and current `mediamtx.yml` defaults.
4. Roll back by hiding/removing the new protocol management module; existing global configuration and runtime clients remain compatible.

## Open Questions

- Which exact WebRTC player behavior is acceptable for the first implementation: read-only WHEP playback, generated browser URL only, or a richer embedded low-latency player?
- Should TLS key/cert values be editable inline, file-path oriented, or both, based on the deployment convention this dashboard targets?
