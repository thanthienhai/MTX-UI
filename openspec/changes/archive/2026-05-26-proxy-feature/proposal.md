## Why

MediaMTX can act as a proxy/relay by configuring paths with upstream source URLs (RTSP cameras, HLS streams, RTMP/SRT upstreams). Currently, creating a proxy path requires users to manually enter source URLs in the Path Add/Edit dialog — there's no dedicated UX to simplify this workflow. Different upstream protocols have different URL formats, authentication patterns, and options (e.g., `sourceOnDemand`, regex capture groups `$G1`/`$G2`).

Adding a dedicated Proxy configuration UI makes it easy to:
- Set up a path that pulls from an upstream source with a few clicks
- Use predefined templates for common upstream types (RTSP camera, HLS, RTMP, SRT)
- Leverage regex paths with capture groups for dynamic upstream routing
- Enable on-demand pulling to avoid unnecessary connections
- Test upstream source reachability before saving

## What Changes

- New `proxy-config.tsx` component for configuring per-path upstream proxy sources.
- Addition of a new **Proxy** tab in the dashboard navigation (next to "Paths" tab).
- A dedicated Proxy page showing all proxy-configured paths with upstream status.
- Proxy templates for common upstream types: RTSP camera/server, HLS upstream, RTMP upstream, SRT upstream.
- Regex path support with capture groups `$G1`, `$G2` for dynamic proxy routing.
- `sourceOnDemand` configuration for proxy paths (lazy pull).
- "Test upstream source" button with URL validation + reachability check via the API.
- Option to add proxy paths directly from the Path Form dialog as well (reusable `ProxyConfig` component).

## Capabilities

### New Capabilities
- `proxy-config`: UI for configuring per-path upstream proxy sources — template selector, source URL builder, regex capture group helpers, `sourceOnDemand` toggle, and upstream reachability test.

### Modified Capabilities
- `path-management-ui`: Add `ProxyConfig` as an optional section in Path Add/Edit dialog for quick proxy path creation.
- `mediamtx-service-endpoints`: May add a test-endpoint utility if upstream testing is done via the backend.

## Impact

- **New component**: `components/proxy-config.tsx` — core proxy config form with templates, regex helper, and test button.
- **New tab in page.tsx**: Add TabsTrigger "proxy" + TabsContent section with proxy list.
- **Modified component**: `components/path-management/path-form.tsx` — optionally import and render ProxyConfig.
- **Modified page**: `app/page.tsx` — add Proxy tab trigger and content, update layout grid (`lg:grid-cols-9` → `lg:grid-cols-10`).
- **No API changes**: `source`, `sourceOnDemand`, `sourceOnDemandStartTimeout`, `sourceOnDemandCloseAfter`, `sourceFingerprint` already exist in `PathConf` and the Control API.
- **No new dependencies**: All proxy functionality uses existing MediaMTX path configuration fields.
