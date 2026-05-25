## 1. API Contract Foundation

- [x] 1.1 Choose the schema strategy and add OpenAPI-aligned TypeScript types for MediaMTX configuration, runtime resources, muxers, protocol resources, recordings, auth errors, and list responses.
- [x] 1.2 Add a developer verification command or test that detects drift between the normalized TypeScript schemas and `openapi.yaml`.
- [x] 1.3 Create a shared `MediaMtxApiError` wrapper with method, endpoint, status, status text, parsed body, raw body fallback, cause, and user-safe message fields.
- [x] 1.4 Refactor the low-level MediaMTX fetch transport to handle auth headers, JSON serialization, empty responses, malformed JSON, non-2xx responses, and network or proxy failures consistently.
- [x] 1.5 Add transport tests for success, empty response, JSON parse failure, HTTP failure, network failure, auth header propagation, body serialization, and single URL encoding.

## 2. Control API Client Coverage

- [x] 2.1 Implement typed global config methods for `GET /v3/config/global/get` and `PATCH /v3/config/global/patch`.
- [x] 2.2 Implement typed path defaults methods for `GET /v3/config/pathdefaults/get` and `PATCH /v3/config/pathdefaults/patch`.
- [x] 2.3 Implement typed path config methods for list, get, add, patch, replace, and delete under `/v3/config/paths`.
- [x] 2.4 Implement typed runtime path methods for `GET /v3/paths/list` and `GET /v3/paths/get/{name}`.
- [x] 2.5 Implement typed HLS muxer methods for `GET /v3/hlsmuxers/list` and `GET /v3/hlsmuxers/get/{name}`.
- [x] 2.6 Implement typed RTSP and RTSPS connection and session methods, including session kick operations.
- [x] 2.7 Implement typed RTMP and RTMPS connection methods, including kick operations.
- [x] 2.8 Implement typed SRT connection methods, including kick operations.
- [x] 2.9 Implement typed WebRTC session methods, including kick operations.
- [x] 2.10 Implement typed recordings list, get, and delete segment methods.
- [x] 2.11 Implement typed JWT JWKS refresh for `POST /v3/auth/jwks/refresh`.
- [x] 2.12 Add client endpoint tests that verify each method uses the expected HTTP method, URL path, encoded path or id parameters, query or payload shape, and response type.

## 3. Service URL Configuration

- [x] 3.1 Extend MediaMTX URL helpers to normalize independent Control API, HLS, playback, metrics, and pprof base URLs.
- [x] 3.2 Preserve `/api/mediamtx` as the browser Control API default and keep server proxy upstream configuration separate.
- [x] 3.3 Add helper methods for building HLS path URLs, non-HLS playback URLs, metrics URLs, and pprof URLs.
- [x] 3.4 Update proxy route tests or coverage to verify method, body, query string, and allowed header forwarding.
- [x] 3.5 Add URL helper tests for trailing slash trimming, `/v3` and `/v3/config` Control API normalization, service defaults, and independent service overrides.

## 4. Dashboard State and Feedback

- [x] 4.1 Add a reusable toast or notification system and wire it into the app shell.
- [x] 4.2 Replace all MediaMTX operation `alert()` usage with success or error notifications.
- [x] 4.3 Add reusable loading, empty, and error state components or patterns for API-backed dashboard modules.
- [x] 4.4 Update existing path config and runtime path dashboard views to use the new state patterns.
- [x] 4.5 Add state handling for new modules that display global config, path defaults, HLS muxers, protocol resources, recordings, metrics, or pprof links.

## 5. Admin Operations, Audit, and Permissions

- [x] 5.1 Add a dashboard audit event model with timestamp, actor, action, target, payload summary, result, and error summary fields.
- [x] 5.2 Add an audit log service that appends success and failure entries for configuration changes, path mutations, kick operations, recording segment deletion, and JWKS refresh.
- [x] 5.3 Add an audit log UI that displays recent entries in reverse chronological order.
- [x] 5.4 Add a permission model for MediaMTX actions `api`, `metrics`, `pprof`, `publish`, `read`, and `playback`.
- [x] 5.5 Add permission guard utilities or components that hide or disable unavailable controls and re-check permissions inside action handlers.
- [x] 5.6 Apply guards to Control API administration, metrics, pprof, publish, read, and playback-related dashboard controls.

## 6. Refresh and Polling

- [x] 6.1 Add a reusable refresh and polling hook or service with enabled state, interval configuration, manual refresh, visibility or mounted-state cleanup, and error propagation.
- [x] 6.2 Replace hard-coded dashboard refresh behavior with configurable polling controls.
- [x] 6.3 Trigger targeted data refreshes after successful mutating operations.
- [x] 6.4 Add tests for interval changes, disabled polling, unmount cleanup, manual refresh, and mutation-triggered refresh behavior.

## 7. Integration and Verification

- [x] 7.1 Migrate existing dashboard imports from the old small API wrapper to the new typed client without regressing current path add, update, delete, and list workflows.
- [x] 7.2 Run type checking and fix all TypeScript errors introduced by the new schemas, client methods, hooks, and components.
- [x] 7.3 Run linting and resolve dashboard, client, and test issues.
- [x] 7.4 Run the existing MediaMTX URL tests and any new unit tests added by this change.
- [x] 7.5 Manually verify dashboard flows for loading, empty, error, notification, audit, permission, polling, and service URL behavior.
