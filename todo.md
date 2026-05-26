# TODO - MediaMTX Dashboard Full Feature Coverage

Mục tiêu: xây dựng giao diện quản trị có thể khai thác gần đầy đủ các chức năng backend MediaMTX, dựa trên tài liệu chính thức và Control API hiện có trong `openapi.yaml`.

## 0. Nền Tảng Chung

- [x] Tạo lớp API client đầy đủ cho MediaMTX Control API.
  - [x] Global config: `GET /v3/config/global/get`.
  - [x] Global config patch: `PATCH /v3/config/global/patch`.
  - [x] Path defaults: `GET /v3/config/pathdefaults/get`.
  - [x] Path defaults patch: `PATCH /v3/config/pathdefaults/patch`.
  - [x] Path configs: list/get/add/patch/replace/delete.
  - [x] Runtime paths: list/get.
  - [x] HLS muxers: list/get.
  - [x] RTSP/RTSPS connections and sessions: list/get/kick.
  - [x] RTMP/RTMPS connections: list/get/kick.
  - [x] SRT connections: list/get/kick.
  - [x] WebRTC sessions: list/get/kick.
  - [x] Recordings: list/get/delete segment.
  - [x] JWT JWKS refresh: `POST /v3/auth/jwks/refresh`.
- [x] Chuẩn hóa schema TypeScript theo OpenAPI.
- [x] Tạo wrapper lỗi API thống nhất.
- [x] Thêm toast/notification thay cho `alert()`.
- [x] Thêm loading, empty, error states cho mỗi module.
- [x] Thêm audit log phía dashboard cho các thao tác quản trị.
- [x] Thêm permission guard theo action MediaMTX: `api`, `metrics`, `pprof`, `publish`, `read`, `playback`.
- [x] Thêm cơ chế refresh/polling có cấu hình.
- [x] Thêm tùy chọn base URL cho:
  - [x] Control API.
  - [x] HLS server.
  - [x] Playback server.
  - [x] Metrics server.
  - [x] pprof server.

## 1. Auth Và Session Dashboard

- [x] Nâng cấp login hiện tại.
  - [x] Hỗ trợ Basic Auth username/password.
  - [x] Hỗ trợ token/JWT nếu MediaMTX dùng JWT auth.
  - [x] Kiểm tra quyền `api` sau login.
  - [x] Hiển thị lỗi kết nối MediaMTX rõ ràng.
- [x] Quản lý session dashboard.
  - [x] Logout.
  - [x] Auto-expire session.
  - [ ] Lưu credential an toàn hơn `sessionStorage` nếu triển khai production.
- [x] RBAC trong UI.
  - [x] Ẩn/disable chức năng nếu user không có quyền tương ứng.
  - [x] Hiển thị permission hiện tại của user.

## 2. Overview Dashboard

- [x] Hiển thị trạng thái server thật.
  - [x] API enabled/disabled.
  - [x] Metrics enabled/disabled.
  - [x] pprof enabled/disabled.
  - [x] Playback enabled/disabled.
  - [x] Protocol enabled/disabled: RTSP, RTMP, HLS, WebRTC, SRT.
- [x] Tổng quan stream.
  - [x] Số path configured.
  - [x] Số path ready/live.
  - [x] Số reader theo protocol.
  - [x] Tổng inbound/outbound bytes.
  - [x] Bitrate tính từ byte delta.
- [x] Hiển thị health cards.
  - [x] API latency.
  - [x] Metrics scrape status.
  - [x] Last config update.
  - [x] Warning khi config UI chưa đồng bộ với backend.
- [x] Quick actions.
  - [x] Add path.
  - [x] Open playback.
  - [x] Open metrics.
  - [x] Restart/refresh data trong UI.

## 3. Global Server Configuration

- [x] Đọc/sửa global config bằng Control API.
- [x] General settings.
  - [x] `logLevel`.
  - [x] `logDestinations`.
  - [x] `logStructured`.
  - [x] `logFile`.
  - [x] `sysLogPrefix`.
  - [x] `dumpPackets`.
  - [x] `readTimeout`.
  - [x] `writeTimeout`.
  - [x] `writeQueueSize`.
  - [x] `udpMaxPayloadSize`.
  - [x] `udpReadBufferSize`.
- [x] Global hooks.
  - [x] `runOnConnect`.
  - [x] `runOnConnectRestart`.
  - [x] `runOnDisconnect`.
- [x] Hot reload UX.
  - [x] Patch từng field.
  - [x] Preview payload trước khi apply.
  - [x] Hiển thị thành công/thất bại và field bị lỗi.

## 4. Protocol Servers

### 4.1 RTSP / RTSPS

- [x] Enable/disable `rtsp`.
- [x] Cấu hình `rtspAddress`.
- [x] Cấu hình `rtspTransports`: `udp`, `multicast`, `tcp`.
- [x] Cấu hình `rtspEncryption`: `no`, `strict`, `optional`.
- [x] Cấu hình `rtspsAddress`.
- [x] Cấu hình RTP/RTCP/SRTP/SRTCP addresses.
- [x] Cấu hình multicast IP/ports.
- [x] Cấu hình TLS key/cert.
- [x] Cấu hình `rtspAuthMethods`: `basic`, `digest`.
- [x] Danh sách RTSP connections.
- [x] Danh sách RTSP sessions.
- [x] Xem chi tiết session.
- [x] Kick RTSP session.

### 4.2 RTMP / RTMPS

- [x] Enable/disable `rtmp`.
- [x] Cấu hình `rtmpAddress`.
- [x] Cấu hình `rtmpEncryption`: `no`, `strict`, `optional`.
- [x] Cấu hình `rtmpsAddress`.
- [x] Cấu hình TLS key/cert.
- [x] Danh sách RTMP connections.
- [x] Xem chi tiết RTMP connection.
- [x] Kick RTMP connection.

### 4.3 HLS

- [x] Enable/disable `hls`.
- [x] Cấu hình `hlsAddress`.
- [x] Cấu hình HTTPS/TLS.
- [x] Cấu hình HLS always remux.
- [x] Cấu hình HLS variants/segment/count/duration/part duration nếu có trong version MediaMTX đang dùng.
- [x] Cấu hình CORS/trusted proxies.
- [x] Danh sách HLS muxers.
- [x] Xem chi tiết HLS muxer.
- [x] Player HLS live.
- [x] Hiển thị URL doc stream HLS.

### 4.4 WebRTC / WHEP / WHIP

- [x] Enable/disable `webrtc`.
- [x] Cấu hình `webrtcAddress`.
- [x] Cấu hình HTTPS/TLS.
- [x] Cấu hình local UDP/TCP address.
- [x] Cấu hình ICE servers/STUN/TURN.
- [x] Cấu hình trusted proxies/CORS.
- [x] Danh sách WebRTC sessions.
- [x] Xem chi tiết WebRTC session.
- [x] Kick WebRTC session.
- [x] Player WebRTC nếu cần latency thap.
- [x] Hiển thị publish/read URLs cho browser clients.

### 4.5 SRT

- [x] Enable/disable `srt`.
- [x] Cấu hình `srtAddress`.
- [x] Cấu hình SRT publish/read passphrase o path.
- [x] Danh sách SRT connections.
- [x] Xem chi tiết SRT connection.
- [x] Kick SRT connection.
- [x] Hiển thị SRT metrics: RTT, loss, retransmit, send/receive rate.

### 4.6 RTP / MPEG-TS

- [x] Hỗ trợ source RTP với `rtpSDP`.
- [x] Hỗ trợ publish/read MPEG-TS theo hướng dẫn MediaMTX.
- [x] Cấu hình demux MPEG-TS over RTSP: `rtspDemuxMpegts`.
- [x] Hiển thị URL mau cho RTP/MPEG-TS.

## 5. Authentication Configuration

- [x] Đọc/sửa `authMethod`.
  - [x] Internal auth.
  - [x] List users từ `authInternalUsers`.
  - [x] Add user.
  - [x] Edit user.
  - [x] Delete user.
  - [x] Username `any`.
  - [x] Password plain/hash.
  - [x] Hỗ trợ Argon2/SHA256 prefix nếu người dùng nhập hash.
  - [x] IP allowlist.
  - [x] Permissions theo action.
  - [x] Permissions theo path.
  - [x] Regex path permissions.
- [x] HTTP auth.
  - [x] `authHTTPAddress`.
  - [x] `authHTTPFingerprint`.
  - [x] `authHTTPExclude`.
  - [x] Test auth endpoint.
- [x] JWT auth.
  - [x] `authJWTJWKS`.
  - [x] `authJWTJWKSFingerprint`.
  - [x] `authJWTClaimKey`.
  - [x] `authJWTExclude`.
  - [x] `authJWTIssuer`.
  - [x] `authJWTAudience`.
  - [x] Trigger JWKS refresh.
- [x] UI permission matrix.
  - [x] `publish`.
  - [x] `read`.
  - [x] `playback`.
  - [x] `api`.
  - [x] `metrics`.
  - [x] `pprof`.

## 6. Path Management

- [x] Path list.
  - [x] Configured paths.
  - [x] Runtime paths.
  - [x] Ready status.
  - [x] Source type/id.
  - [x] Tracks.
  - [x] Readers.
  - [x] Bytes in/out.
- [x] Add/edit/delete/replace path.
- [x] Path name support.
  - [x] Normal path.
  - [x] Regex path.
  - [x] `all_others`.
- [x] Source config.
  - [x] `publisher`.
  - [x] RTSP/RTSPS URL.
  - [x] RTMP/RTMPS URL.
  - [x] HLS URL.
  - [x] SRT URL.
  - [x] WHEP source.
  - [x] RTP source.
  - [x] Redirect source.
  - [x] Raspberry Pi Camera source.
- [x] Source common options.
  - [x] `source`.
  - [x] `sourceFingerprint`.
  - [x] `sourceOnDemand`.
  - [x] `sourceOnDemandStartTimeout`.
  - [x] `sourceOnDemandCloseAfter`.
  - [x] `maxReaders`.
  - [x] `overridePublisher`.
  - [x] `useAbsoluteTimestamp`.
- [x] Path URLs.
  - [x] RTSP URL.
  - [x] RTSPS URL.
  - [x] RTMP URL.
  - [x] HLS URL.
  - [x] WebRTC URL.
  - [x] SRT URL.
- [x] Path actions.
  - [x] Preview live.
  - [x] Copy stream URL.
  - [x] Open playback.
  - [x] Show active readers.
  - [x] Kick reader/session.
  - [x] Delete path config.

## 7. Path Defaults

- [x] Màn hình cấu hình `pathDefaults`.
- [x] Apply defaults cho tất cả path.
- [x] So sánh path override với default.
- [x] Reset path field về default.
- [x] Import/export path defaults JSON/YAML.

## 8. Recording

- [x] Global/path recording settings.
  - [x] `record`.
  - [x] `recordPath`.
  - [x] `recordFormat`: `fmp4`, `mpegts`.
  - [x] `recordPartDuration`.
  - [x] `recordSegmentDuration`.
  - [x] `recordMaxPartSize`.
  - [x] `recordDeleteAfter`.
- [x] Recording runtime.
  - [x] List recordings: `GET /v3/recordings/list`.
  - [x] Get recording by path/name.
  - [x] Show segment list.
  - [x] Delete segment: `POST /v3/recordings/deletesegment`.
- [x] Recording status UI.
  - [x] Đang ghi/idle theo path.
  - [x] Segment mới nhất.
  - [x] Dung lượng ước tính.
  - [x] Retention status.
- [x] Remote upload workflow.
  - [x] Mẫu hook `runOnRecordSegmentComplete` cho rclone.
  - [x] UI cấu hình command upload.
  - [x] Cảnh báo quyền filesystem và bảo mật command.

## 9. Playback

- [x] Enable/disable `playback`.
- [x] Cấu hình `playbackAddress`.
- [x] Cấu hình HTTPS/TLS.
- [x] Cấu hình CORS/trusted proxies.
- [x] Playback API client.
  - [x] `GET /list?path=&start=&end=`.
  - [x] `GET /get?path=&start=&duration=&format=`.
- [x] Playback UI.
  - [x] Chọn path.
  - [x] Chọn date range.
  - [x] Timeline recorded spans.
  - [x] Play recording bằng video tag.
  - [x] Download fMP4.
  - [x] Download MP4 với `format=mp4`.
  - [x] Copy playback URL.

## 10. Live Players

- [x] HLS player hiện tại.
  - [x] Xử lý path có ký tự đặc biệt.
  - [x] Show manifest URL.
  - [x] Better fatal/non-fatal error handling.
- [x] WebRTC player (WHEP).
  - [x] `whep-player.tsx` component with `useMediaMTXWebRTC`.
  - [x] Loading/error/connected states.
  - [x] Preview button in `renderStreamRow` + `PathActions`.
- [x] Playback player (PlaybackBrowser existing — marked done).
- [x] Multi-view player.
  - [x] Grid 2x2/3x3 (CSS grid + Tailwind).
  - [x] Pin stream (`col-span-2 row-span-2`).
  - [x] Mute/unmute per cell + Mute All.
  - [x] Fullscreen (`requestFullscreen`).
  - [x] Stream add/remove.
  - [x] Dedicated "Live Players" tab.
- [x] Snapshot preview.
  - [x] `snapshot-config.tsx` — config UI in Path Edit dialog.
  - [x] FFmpeg command generator + editable textarea.
  - [x] `snapshot-gallery.tsx` — gallery dialog with download/delete.
  - [x] Security warning banner.

## 11. Forwarding

- [x] UI cấu hình forward stream sang server khác.
- [x] Generate `runOnReady` FFmpeg command.
- [x] Cấu hình `runOnReadyRestart`.
- [x] Forward target presets.
  - [x] RTSP target.
  - [x] RTMP target.
  - [x] SRT target.
  - [x] HLS/HTTP target nếu dùng FFmpeg phù hợp.
- [x] Validate command.
- [x] Hiển thị warning về FFmpeg dependency.

## 12. Proxy

- [x] UI tạo proxy path.
- [x] Hỗ trợ regex path.
- [x] Hỗ trợ regex capture groups `$G1`, `$G2`.
- [x] `sourceOnDemand` cho proxy.
- [x] Proxy templates.
  - [x] RTSP camera/server.
  - [x] HLS upstream.
  - [x] RTMP upstream.
  - [x] SRT upstream.
- [x] Test upstream source.

## 13. Always-Available Streams

- [x] Hỗ trợ source static để path tồn tại kể cả khi publisher offline.
- [x] UI phân biệt:
  - [x] Publisher mode.
  - [x] Pull from upstream.
  - [x] On-demand pull.
  - [x] Always pull.
- [x] Hiển thị offline/connecting/ready state.

## 14. On-Demand Publishing

- [x] UI cấu hình `runOnDemand`.
- [x] UI cấu hình `runOnDemandRestart`.
- [x] UI cấu hình `runOnUnDemand`.
- [x] Command templates.
  - [x] Loop file MP4 bằng FFmpeg.
  - [x] Start camera process.
  - [x] Pull external stream khi có reader.
- [x] Hiển thị lifecycle của command nếu có thể suy ra từ logs/metrics.

## 15. Hooks

- [x] Màn hình quản lý hooks global và path-level.
  - [x] Global hooks trong Global Config tab.
  - [x] Path-level hooks UI trong Hooks tab riêng.
- [x] Global hooks.
  - [x] `runOnConnect`.
  - [x] `runOnConnectRestart`.
  - [x] `runOnDisconnect`.
- [x] Path hooks.
  - [x] `runOnInit`.
  - [x] `runOnInitRestart`.
  - [x] `runOnDemand`.
  - [x] `runOnDemandRestart`.
  - [x] `runOnUnDemand`.
  - [x] `runOnReady`.
  - [x] `runOnReadyRestart`.
  - [x] `runOnNotReady`.
  - [x] `runOnRead`.
  - [x] `runOnReadRestart`.
  - [x] `runOnUnread`.
  - [x] `runOnRecordSegmentCreate`.
  - [x] `runOnRecordSegmentComplete`.
- [x] Hook command editor (`HookCommandEditor` component).
  - [x] Multiline command (monospace textarea).
  - [x] Env var helper (collapsible panel, click-to-insert).
  - [x] Template snippets (template selector + dynamic fields).
  - [x] Security warning (amber banner khi command non-empty).
- [ ] Hook test runner nếu có backend dashboard riêng.

## 16. Snapshots

- [x] Snapshot feature dựa trên hook `runOnReady`.
- [x] Generate FFmpeg command extract frame định kỳ.
- [x] Cấu hình snapshot interval.
- [x] Cấu hình snapshot output path.
- [x] Thumbnail trong path list.
- [x] Snapshot gallery.
- [x] Xóa snapshot.
- [x] Cảnh báo cần FFmpeg và filesystem access.

## 17. Re-Encoding

- [x] UI tạo command re-encode bằng FFmpeg/GStreamer.
- [x] Templates.
  - [x] H264 to H264 bitrate change.
  - [x] H265 to H264 for browser compatibility.
  - [x] Audio transcode to AAC/Opus.
  - [x] Scale resolution.
  - [x] Add low-bitrate substream.
- [x] Gắn command vào `runOnReady`, `runOnInit`, hoặc `runOnDemand`.
- [x] Hiển thị CPU warning.

## 18. Absolute Timestamps

- [x] Hỗ trợ `useAbsoluteTimestamp`.
- [ ] Giải thích UI ngắn gọn về recording date và sync multi-stream.
- [ ] Hiển thị protocol support:
  - [ ] Receive: HLS, RTSP, WebRTC, Raspberry Pi Camera.
  - [ ] Send: HLS, RTSP, WebRTC.
- [ ] Hiển thị warning khi source không có absolute timestamps.

## 19. Metrics

- [x] Metrics server config.
  - [x] `metrics`.
  - [x] `metricsAddress`.
  - [x] `metricsEncryption`.
  - [x] TLS key/cert.
  - [x] CORS.
  - [x] Trusted proxies.
- [x] Metrics fetcher.
  - [x] Parse Prometheus text format.
  - [x] Filter by query params.
  - [x] Tính bitrate từ byte delta.
- [ ] Metrics dashboards.
  - [x] Paths (monitoring tab - basic).
  - [x] HLS sessions/muxers.
  - [x] RTSP/RTSPS conns/sessions.
  - [x] RTMP/RTMPS conns.
  - [x] SRT conns.
  - [x] WebRTC sessions.
- [ ] Alert/warning.
  - [ ] Packet loss.
  - [ ] Jitter cao.
  - [ ] Frames discarded.
  - [ ] Error frames.
  - [ ] No readers.
  - [ ] Source offline.
- [x] Grafana integration.
  - [x] Link đến dashboard Grafana.
  - [x] Provision dashboard từ `grafana/provisioning`.

## 20. Performance / pprof

- [x] pprof server config.
  - [x] `pprof`.
  - [x] `pprofAddress`.
  - [x] `pprofEncryption`.
  - [x] TLS key/cert.
  - [x] CORS.
  - [x] Trusted proxies.
- [x] pprof links.
  - [x] Heap.
  - [x] Goroutine.
  - [x] Profile CPU.
  - [x] Trace.
- [ ] Nếu có dashboard backend riêng:
  - [ ] Gọi `go tool pprof` hoặc download profile.
  - [ ] Lưu artifact profile.
  - [ ] Hiển thị top consumers.
- [ ] Cảnh báo bảo mật khi expose pprof.

## 21. Logs

- [ ] Đọc log thật.
  - [ ] Nếu `logDestinations` có `file`, đọc `logFile` qua service riêng.
  - [ ] Nếu Docker, tích hợp docker logs nếu cho phép.
  - [ ] Nếu systemd, tích hợp journalctl nếu cho phép.
- [ ] Log viewer.
  - [ ] Tail realtime.
  - [ ] Filter level.
  - [ ] Filter path/protocol/client.
  - [ ] Search.
  - [ ] Download logs.
- [ ] Structured logs.
  - [ ] Hỗ trợ `logStructured`.
  - [ ] Parse JSONL.

## 22. Client / Session Management

- [x] Unified Sessions page.
- [x] Protocol tabs.
  - [x] RTSP conns.
  - [x] RTSP sessions.
  - [x] RTSPS conns.
  - [x] RTSPS sessions.
  - [x] RTMP conns.
  - [x] RTMPS conns.
  - [x] SRT conns.
  - [x] WebRTC sessions.
  - [x] HLS sessions/muxers nếu endpoint/metrics có.
- [x] Detail drawer.
  - [x] ID.
  - [x] Path.
  - [x] Remote address.
  - [x] State.
  - [x] Bytes.
  - [x] Packets.
  - [x] Loss/jitter nếu có.
- [x] Kick action.
- [x] Confirm dialog cho kick.

## 23. Publish Guides Trong UI

- [x] Generate publish command theo path.
- [x] FFmpeg.
- [x] GStreamer.
- [x] OBS Studio.
- [ ] VLC nếu publish supported scenario.
- [x] Python/OpenCV.
- [x] Golang.
- [x] Unity.
- [x] Web browsers/WebRTC.
- [x] Raspberry Pi Camera.
- [x] Generic webcam.
- [x] RTSP cameras/servers.
- [x] RTMP cameras/servers.
- [x] SRT clients/servers.
- [ ] HLS cameras/servers.
- [x] MPEG-TS.
- [x] RTP.

## 24. Read Guides Trong UI

- [x] Generate read URLs theo path.
- [x] RTSP.
- [x] RTMP.
- [x] HLS.
- [x] WebRTC.
- [x] SRT.
- [x] FFmpeg command.
- [x] GStreamer command.
- [x] VLC command.
- [x] OBS Studio source config.
- [x] Python/OpenCV snippet.
- [x] Golang snippet.
- [x] Unity snippet.
- [x] Browser URL/player.

## 25. Raspberry Pi Camera

- [x] Source type `rpiCamera`.
  - [x] Camera ID.
  - [ ] Secondary stream.
  - [x] Resolution.
  - [x] FPS.
  - [x] Flip H/V.
  - [ ] Brightness/contrast/saturation/sharpness.
  - [ ] Exposure.
  - [ ] AWB.
  - [ ] Denoise.
  - [ ] Shutter/gain/EV.
  - [ ] ROI.
  - [ ] HDR.
  - [ ] Tuning file.
  - [ ] Sensor mode.
  - [ ] Autofocus mode/range/speed/window.
  - [ ] Lens position.

## 26. Security

- [ ] Cảnh báo khi default credentials còn được dùng.
- [ ] Cảnh báo khi API/metrics/pprof expose public.
- [x] TLS config UI cho API/metrics/pprof/playback/HLS/WebRTC/RTSP/RTMP.
- [x] CORS allowed origins.
- [x] Trusted proxies.
- [x] Credential masking.
- [ ] Command hook safety warning.
- [ ] Backup config trước khi patch nhiều field.
- [x] Confirm destructive actions:
  - [x] Delete path.
  - [x] Delete recording segment.
  - [x] Kick session.
  - [x] Replace config.

## 27. Configuration Import / Export

- [ ] Export global config JSON.
- [ ] Export paths JSON.
- [x] Export path defaults JSON.
- [ ] Import config with validation.
- [ ] Diff current vs imported.
- [ ] Apply selected fields.
- [ ] Download generated `mediamtx.yml` nếu cần.

## 28. Validation

- [x] Validate address format.
- [x] Validate duration format.
- [x] Validate path name.
- [x] Validate regex path.
- [x] Validate URLs.
- [x] Validate TLS key/cert paths.
- [x] Validate command fields không rỗng khi enable hook.
- [x] Validate auth permissions.
- [ ] Validate recording path variables.
- [ ] Validate codec/browser compatibility hints.

## 29. Testing

- [x] Unit tests cho API client.
- [x] Unit tests cho config payload builders.
- [ ] Unit tests cho Prometheus parser.
- [ ] Component tests cho form complex.
- [ ] E2E tests.
  - [ ] Login.
  - [ ] Add path.
  - [ ] Edit path.
  - [ ] Delete path.
  - [ ] View stream.
  - [ ] List sessions.
  - [ ] Kick session.
  - [ ] Recording list/delete.
  - [ ] Playback list/play.
- [ ] Test với MediaMTX local docker.
- [ ] Test khi backend MediaMTX offline.
- [ ] Test permission denied.

## 30. Deployment / Ops

- [ ] Docker compose production chuẩn hóa.
- [ ] Environment variables documented.
- [ ] Reverse proxy docs.
- [ ] HTTPS deployment docs.
- [ ] Grafana/Prometheus optional stack.
- [ ] Healthcheck cho dashboard.
- [ ] Healthcheck cho MediaMTX API.
- [ ] Version compatibility check với MediaMTX.
- [ ] Hiển thị MediaMTX version nếu API/config cung cấp.

## 31. Ưu Tiên Thực Hiện Để Đạt Giá Trị Cao Nhất

- [x] Phase 1: Biến các UI hiện có thành thao tác thật.
  - [x] Server global config get/patch.
  - [x] Auth config get/patch.
  - [x] Recording settings get/patch.
  - [x] Monitoring fetch metrics thực.
- [x] Phase 2: Quản trị runtime.
  - [x] Sessions/connections list/get/kick.
  - [x] HLS muxers.
  - [x] Recordings list/get/delete segment.
  - [ ] Playback list/get/player.
- [x] Phase 3: Advanced path features.
  - [x] Path defaults.
  - [x] Protocol-specific source settings.
  - [x] Hooks.
  - [ ] Forward/proxy/on-demand/snapshots.
- [ ] Phase 4: Full protocol support.
  - [ ] SRT.
  - [ ] RTP/MPEG-TS.
  - [ ] WebRTC advanced.
  - [ ] Raspberry Pi Camera.
  - [ ] Absolute timestamps.
- [ ] Phase 5: Production hardening.
  - [ ] Security warnings.
  - [ ] Config import/export/diff.
  - [ ] Tests.
  - [ ] Deployment docs.



