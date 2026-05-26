## Context

MediaMTX dashboard already has:
- `PathConf` TypeScript interface with `runOnReady?: string` and `runOnReadyRestart?: boolean` fields (in `lib/mediamtx-api.ts`)
- `PATH_FIELD_REGISTRY` with a `runOnReady` entry in the "hooks" category (in `lib/path-management.mjs`) — but without `appliesToDefaults: true` and no `runOnReadyRestart` entry
- `snapshot-config.tsx` component that demonstrates the pattern: FFmpeg command generation from form inputs with an editable textarea preview and security warning
- `path-form.tsx` dialog where path-level features (Recording, Snapshot) are embedded as toggleable sections

No Forwarding UI exists. Forwarding is currently only configurable via raw API calls or manual YAML editing.

## Goals / Non-Goals

**Goals:**
- Provide a per-path Forwarding configuration UI inside the Path Edit dialog
- Generate valid FFmpeg commands for RTSP, RTMP, SRT, and HLS/HTTP target presets
- Allow free-form editing of the generated command
- Toggle `runOnReadyRestart` on/off
- Validate command non-empty when forwarding is enabled
- Warn about FFmpeg dependency and security risks
- Include forwarding fields in path PATCH payload on save

**Non-Goals:**
- Multiple simultaneous forward targets per path (users can chain commands manually in the textarea)
- Native MediaMTX forwarding (this is impossible — MediaMTX relies on hooks)
- Forwarding status monitoring or health checks
- Global forwarding defaults UI (only per-path in this change)
- Forwarding metrics display

## Decisions

### Decision: Embed forwarding config in Path Edit dialog (like Recording/Snapshot)
**Rationale**: Forwarding is a per-path feature. Embedding keeps it discoverable where users already configure paths. Following the established Recording/Snapshot pattern reduces cognitive overhead and keeps `path-form.tsx` consistent.

**Alternatives considered**:
- *Dedicated Forwarding tab/page*: Would require a separate view, custom API calls, and duplicated path-selection UX. Over-engineered for a feature that's essentially two config fields (`runOnReady` + `runOnReadyRestart`).
- *Part of Hooks editor (Section 15)*: Forwarding is a specific use case of `runOnReady`, but mixing it with a generic hooks UI obscures its purpose. A dedicated Forwarding section with presets is more intuitive.

### Decision: Generate FFmpeg command from preset templates with `-c copy`
**Rationale**: Using `-c copy` (stream copy) avoids transcoding overhead. This is the simplest and most performant approach — the stream passes through without re-encoding. Users who need transcoding can edit the command in the textarea.

**Templates per target**:
| Target | Template |
|---|---|
| RTSP | `ffmpeg -i rtsp://localhost:8554/{path} -c copy -f rtsp rtsp://{target}:8554/{stream}` |
| RTMP | `ffmpeg -i rtsp://localhost:8554/{path} -c copy -f flv rtmp://{target}/live/{stream}` |
| SRT | `ffmpeg -i rtsp://localhost:8554/{path} -c copy -f mpegts 'srt://{target}:9000?streamid=publish:{stream}'` |
| HLS | `ffmpeg -i rtsp://localhost:8554/{path} -c copy -f hls -hls_time 6 -hls_list_size 4 http://{target}:8888/{stream}.m3u8` |

### Decision: Editable command textarea as the source of truth
**Rationale**: Users can fine-tune the generated command (add codec params, change bitrate, etc.). The preset inputs (target type, URL) populate the textarea template, but the textarea is the authoritative value saved to `runOnReady`. This matches the `snapshot-config.tsx` pattern exactly.

### Decision: Validation — non-empty check + URL format hint
**Rationale**: The minimum validation is "command must not be empty when forwarding is enabled", matching existing pattern for `remote-upload-config.tsx`. FFmpeg syntax validation would require shell-parsing and is beyond scope. We provide placeholder hints per target type and let the editable textarea handle advanced cases.

### Decision: Add `appliesToDefaults: true` to `runOnReady` and register `runOnReadyRestart`
**Rationale**: Forwarding commands should be configurable as path defaults so all paths inherit a forward rule unless overridden. `runOnReadyRestart` is missing from the registry entirely and needs adding. This aligns with how Recording fields (`record`, `recordPath`, etc.) already work in path defaults.

## Risks / Trade-offs

| Risk | Mitigation |
|---|---|
| Users paste credentials in the FFmpeg URL (e.g., `rtsp://user:pass@target`) | Security warning explicitly mentions credential exposure. Credentials live in the command string which is stored in MediaMTX config — same risk as manual YAML editing. |
| FFmpeg not installed on server | Prominent warning banner: "Cần FFmpeg trên server MediaMTX. Command sẽ chạy với quyền của process MediaMTX." |
| Generated command doesn't work for all stream types (e.g., H.265 in RTMP) | Users can edit the command. Templates use `-c copy` which passes through supported codecs. |  
| `runOnReady` command may consume significant CPU/bandwidth | Warning in UI. `runOnReadyRestart` could cause restart loops — users should be careful. |
| Multiple forward targets limited by single `runOnReady` field | Users can chain commands with `&&` or shell script in the textarea. Document this in the UI helper text. |
