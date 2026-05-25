## Why

Operators need one reliable dashboard surface for configured paths, runtime path state, stream URLs, reader/session actions, and reusable path defaults. The current path UI covers only a small subset of MediaMTX path configuration, leaving important source types, runtime diagnostics, default comparison, and import/export workflows manual or incomplete.

## What Changes

- Add a full Path Management UI that combines configured paths and runtime paths.
- Show ready status, source type/id, tracks, active readers, bytes in/out, and per-path URLs.
- Support add, edit, delete, and replace path configuration with normal path names, regex path names, and `all_others`.
- Support source configuration for `publisher`, RTSP/RTSPS, RTMP/RTMPS, HLS, SRT, WHEP, RTP, redirect, and Raspberry Pi Camera sources.
- Expose common source/path options including `source`, `sourceFingerprint`, `sourceOnDemand`, `sourceOnDemandStartTimeout`, `sourceOnDemandCloseAfter`, `maxReaders`, `overridePublisher`, and `useAbsoluteTimestamp`.
- Add path actions for live preview, copying stream URLs, opening playback, showing active readers, kicking readers/sessions, and deleting path configuration.
- Add a Path Defaults screen for `pathDefaults`, including apply defaults to all paths, comparing per-path overrides to defaults, resetting a path field to default, and importing/exporting defaults as JSON/YAML.
- Preserve existing permission guards so `api`, `read`, `playback`, and protocol-specific runtime actions are disabled or rejected when unavailable.

## Capabilities

### New Capabilities
- `path-management-ui`: Dashboard UI and behavior for configured path lifecycle, runtime path status, stream URL generation, source configuration, and path-level actions.
- `path-defaults-ui`: Dashboard UI and behavior for viewing, editing, comparing, applying, resetting, importing, and exporting MediaMTX `pathDefaults`.

### Modified Capabilities
- `mediamtx-control-api-client`: Extend typed path config/runtime coverage where needed for path source fields, runtime readers/sessions, replace/delete actions, and path defaults payloads.
- `mediamtx-api-contracts`: Keep the checked-in OpenAPI contract and source-inspection tests aligned with the path source/default fields used by the new UI.

## Impact

- Affected UI areas: path tab, protocol/runtime panels, path add/edit dialogs, path defaults configuration, stream player/URL actions, notifications, and audit log.
- Affected client/API areas: `PathConf`, `Path`, `PathReader`, path config lifecycle methods, runtime path reads, protocol kick operations, path defaults read/patch, and path URL builders.
- Affected tests: path management UI behavior, path defaults serialization/import/export, OpenAPI contract coverage, MediaMTX API client tests, dashboard permission guards, and existing dashboard experience tests.
