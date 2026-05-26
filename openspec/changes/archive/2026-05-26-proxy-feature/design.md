## Context

MediaMTX dashboard already has:
- `PathConf` TypeScript interface with `source`, `sourceOnDemand`, `sourceOnDemandStartTimeout`, `sourceOnDemandCloseAfter`, `sourceFingerprint` fields (in `lib/mediamtx-api.ts`)
- `path-form.tsx` — Path Add/Edit dialog with source type selector, source URL input, `sourceOnDemand` toggle, recording settings, forwarding config, snapshot config
- `forwarding-config.tsx` — Component pattern for protocol-specific configuration with toggle, presets, command generation, and editable textarea
- `detectSourceType()` utility in `lib/path-management.mjs` that auto-detects source type from URL prefixes (`rtsp://`, `rtmp://`, `http://`, `srt://`, etc.)
- Regex path support via `PathNameMode = "normal" | "regex" | "all_others"` (in `path-form.tsx`)
- `isRegexPathName()` utility in `lib/mediamtx-url.mjs`
- Existing tab navigation system with 9 tabs (`lg:grid-cols-9`) in `app/page.tsx`

No dedicated Proxy UI exists. Proxy paths are currently created via the generic Path Add dialog — users must know the exact source URL format and manually configure `sourceOnDemand`.

## Proxy vs Forwarding

```
FORWARDING (existing):  MediaMTX path → FFmpeg → Upstream server (push via runOnReady)
                         "Send this stream somewhere else"

PROXY (new):            Upstream source → MediaMTX path → Clients (pull via source)
                         "Pull from upstream and serve to clients"
```

## Goals / Non-Goals

**Goals:**
- Provide a dedicated Proxy tab showing all proxy-configured paths with upstream status
- Provide per-path upstream configuration with protocol preset templates (RTSP, HLS, RTMP, SRT)
- Generate correct source URLs from template parameters (host, port, path, credentials)
- Support regex path names with `$G1`, `$G2` capture groups in source URLs
- Support `sourceOnDemand` configuration for proxy paths
- Test upstream source reachability (URL validation + HTTP/RTSP probe)
- Reuse `ProxyConfig` component in Path Add/Edit dialog for quick proxy path creation

**Non-Goals:**
- Native MediaMTX proxy beyond what path config supports (this uses existing `source` field)
- Upstream health monitoring / auto-failover
- Transcoding or re-encoding upstream content
- Multiple upstream sources per path (round-robin or failover)
- Proxy metrics or analytics display

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    PROXY ARCHITECTURE                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐    ┌──────────────────┐                   │
│  │  Proxy Tab   │    │  Path Add/Edit   │                   │
│  │  (page.tsx)  │    │  Dialog           │                   │
│  │              │    │  (path-form.tsx)  │                   │
│  │  ┌─────────┐ │    │                   │                   │
│  │  │ Proxy   │ │    │  ┌──────────────┐ │                   │
│  │  │ List    │ │    │  │ ProxyConfig  │ │                   │
│  │  │ + Add   │ │    │  │ (section)    │ │                   │
│  │  │ Button  │ │    │  └──────────────┘ │                   │
│  │  └────┬────┘ │    └────────┬──────────┘                   │
│  └───────┼──────┘             │                              │
│          │                    │                              │
│          └────────┬───────────┘                              │
│                   │                                          │
│          ┌────────▼──────────┐                               │
│          │  ProxyConfig      │  ◄── REUSABLE COMPONENT       │
│          │  (proxy-config.tsx)│                               │
│          │                    │                               │
│          │  - Template       │                               │
│          │    selector        │                               │
│          │  - Source URL      │                               │
│          │    builder         │                               │
│          │  - Regex $G1,$G2   │                               │
│          │    helper          │                               │
│          │  - sourceOnDemand  │                               │
│          │  - Test button     │                               │
│          └────────┬──────────┘                               │
│                   │                                          │
│          ┌────────▼──────────┐                               │
│          │  API Layer        │                               │
│          │  (mediamtx-api.ts)│                               │
│          │                    │                               │
│          │  addPath()         │                               │
│          │  updatePath()      │                               │
│          └────────────────────┘                               │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Decisions

### Decision: Dedicated Proxy tab + reusable ProxyConfig component
**Rationale**: Proxy is a distinct use case from generic path management. A dedicated tab:
- Shows only proxy paths (filtered by those with upstream source URLs)
- Provides a focused workflow for creating proxy paths with templates
- Is more discoverable than burying it in the Path form

The `ProxyConfig` component is built as a reusable component that can be embedded in both:
1. The Proxy tab's add/edit dialog
2. The Path Form's source section (as an alternative to the generic source URL input)

**Alternatives considered**:
- *Only in Path Form*: Less discoverable, no separate proxy list view
- *Only in Proxy tab*: Users editing paths in Paths tab would miss proxy-specific features

### Decision: Proxy templates with parameterized URL generation
**Rationale**: Each upstream protocol has a distinct URL format. Templates make it easy:
- Users select a protocol → get a form with relevant fields (host, port, path, credentials)
- The `source` value is auto-generated from the template parameters
- Advanced users can override the generated URL directly

| Template | Source URL Pattern |
|---|---|
| RTSP Camera/Server | `rtsp://{username}:{password}@{host}:{port}/{streamPath}` |
| RTSPS Camera/Server (TLS) | `rtsps://{username}:{password}@{host}:{port}/{streamPath}` |
| HLS Upstream | `http://{host}:{port}/{streamPath}/stream.m3u8` |
| RTMP Upstream | `rtmp://{host}/live/{streamPath}` |
| SRT Upstream | `srt://{host}:{port}?streamid={streamid}` |

### Decision: Regex capture groups ($G1, $G2) in source URL
**Rationale**: When a proxy path uses a regex name (e.g., `~^cam(\d+)$`), capture groups can reference dynamic segments of the path in the source URL. For example, a client connecting to `cam42` would make `$G1 = 42`, and the source URL `rtsp://192.168.1.${G1}:554/stream` resolves to `rtsp://192.168.1.42:554/stream`.

The UI should:
- Detect when a regex path name is used
- Show available capture groups (`$G1`, `$G2`, etc.) based on the regex pattern
- Provide buttons to insert capture group variables into the source URL
- Show a preview of how the source URL would resolve with example values

### Decision: sourceOnDemand for proxy
**Rationale**: Most proxy use cases benefit from `sourceOnDemand = true`:
- Camera streams only pull when someone is watching
- Reduces bandwidth when no clients are connected
- MediaMTX handles the lifecycle with `sourceOnDemandStartTimeout` and `sourceOnDemandCloseAfter`

The default is `sourceOnDemand = true` for proxy paths, with option to disable for always-on pulling.

### Decision: Test upstream source
**Rationale**: Before saving a proxy path, users should be able to verify the upstream source is reachable. Three approaches from simplest to most sophisticated:

1. **URL format validation** (client-side): Check the URL matches expected pattern for the selected protocol
2. **HTTP probe** (client-side): For HTTP/HLS sources, try fetching the URL to see if it responds
3. **MediaMTX probe** (via API): Create a temporary path → wait for source connection → read runtime status → delete path

**Selected approach**: Combine #1 (immediate validation) + an optional "Test Connection" button that attempts #2 for HTTP sources and shows a best-effort check for other protocols. For RTSP/RTMP/SRT, validate URL format and suggest running `ffprobe` on the server.

### Decision: Update TabsList layout from `lg:grid-cols-9` to `lg:grid-cols-10`
**Rationale**: Adding a 10th tab requires updating the grid column class. The current TabsList has `sm:grid-cols-5 lg:grid-cols-9` — this becomes `sm:grid-cols-5 lg:grid-cols-10`.

## Risks / Trade-offs

| Risk | Mitigation |
|---|---|
| Upstream URL may contain credentials exposed in UI | Show password input type for `password` field; mask in read-only views |
| Test connection may leak info about reachable internal hosts | Test button disabled by default, requires explicit user action. Log results to UI only. |
| Regex path with $G1/$G2 may be confusing | Provide helper UI showing available capture groups and a live preview of the resolved URL with example values |
| Proxy paths mixed with regular paths in the API | Filter paths by `source` having an upstream URL pattern to show in Proxy tab. All proxy paths are regular paths internally — no separate data model needed. |
| sourceOnDemand may cause delay for first viewer | Document the trade-off in UI: "On-demand: saves bandwidth but first viewer may wait for connection timeout" |
