# TODO - MediaMTX Dashboard Full Feature Coverage

Mục tiêu: xây dựng giao diện quản trị có thể khai thác gần đầy đủ các chức năng backend MediaMTX, dựa trên tài liệu chính thức và Control API hiện có trong `openapi.yaml`.

## 0. Nền Tảng Chung

- [ ] Tạo lớp API client đầy đủ cho MediaMTX Control API.
  - [ ] Global config: `GET /v3/config/global/get`.
  - [ ] Global config patch: `PATCH /v3/config/global/patch`.
  - [ ] Path defaults: `GET /v3/config/pathdefaults/get`.
  - [ ] Path defaults patch: `PATCH /v3/config/pathdefaults/patch`.
  - [ ] Path configs: list/get/add/patch/replace/delete.
  - [ ] Runtime paths: list/get.
  - [ ] HLS muxers: list/get.
  - [ ] RTSP/RTSPS connections and sessions: list/get/kick.
  - [ ] RTMP/RTMPS connections: list/get/kick.
  - [ ] SRT connections: list/get/kick.
  - [ ] WebRTC sessions: list/get/kick.
  - [ ] Recordings: list/get/delete segment.
  - [ ] JWT JWKS refresh: `POST /v3/auth/jwks/refresh`.
- [ ] Chuẩn hóa schema TypeScript theo OpenAPI.
- [ ] Tạo wrapper lỗi API thống nhất.
- [ ] Thêm toast/notification thay cho `alert()`.
- [ ] Thêm loading, empty, error states cho mỗi module.
- [ ] Thêm audit log phía dashboard cho các thao tác quản trị.
- [ ] Thêm permission guard theo action MediaMTX: `api`, `metrics`, `pprof`, `publish`, `read`, `playback`.
- [ ] Thêm cơ chế refresh/polling có cấu hình.
- [ ] Thêm tùy chọn base URL cho:
  - [ ] Control API.
  - [ ] HLS server.
  - [ ] Playback server.
  - [ ] Metrics server.
  - [ ] pprof server.

## 1. Auth Và Session Dashboard

- [ ] Nâng cấp login hiện tại.
  - [ ] Hỗ trợ Basic Auth username/password.
  - [ ] Hỗ trợ token/JWT nếu MediaMTX dùng JWT auth.
  - [ ] Kiểm tra quyền `api` sau login.
  - [ ] Hiển thị lỗi kết nối MediaMTX rõ ràng.
- [ ] Quản lý session dashboard.
  - [ ] Logout.
  - [ ] Auto-expire session.
  - [ ] Lưu credential an toàn hơn `sessionStorage` nếu triển khai production.
- [ ] RBAC trong UI.
  - [ ] Ẩn/disable chức năng nếu user không có quyền tương ứng.
  - [ ] Hiển thị permission hiện tại của user.

## 2. Overview Dashboard

- [ ] Hiển thị trạng thái server thật.
  - [ ] API enabled/disabled.
  - [ ] Metrics enabled/disabled.
  - [ ] pprof enabled/disabled.
  - [ ] Playback enabled/disabled.
  - [ ] Protocol enabled/disabled: RTSP, RTMP, HLS, WebRTC, SRT.
- [ ] Tổng quan stream.
  - [ ] Số path configured.
  - [ ] Số path ready/live.
  - [ ] Số reader theo protocol.
  - [ ] Tổng inbound/outbound bytes.
  - [ ] Bitrate tính từ byte delta.
- [ ] Hiển thị health cards.
  - [ ] API latency.
  - [ ] Metrics scrape status.
  - [ ] Last config update.
  - [ ] Warning khi config UI chưa đồng bộ với backend.
- [ ] Quick actions.
  - [ ] Add path.
  - [ ] Open playback.
  - [ ] Open metrics.
  - [ ] Restart/refresh data trong UI.

## 3. Global Server Configuration

- [ ] Đọc/sửa global config bằng Control API.
- [ ] General settings.
  - [ ] `logLevel`.
  - [ ] `logDestinations`.
  - [ ] `logStructured`.
  - [ ] `logFile`.
  - [ ] `sysLogPrefix`.
  - [ ] `dumpPackets`.
  - [ ] `readTimeout`.
  - [ ] `writeTimeout`.
  - [ ] `writeQueueSize`.
  - [ ] `udpMaxPayloadSize`.
  - [ ] `udpReadBufferSize`.
- [ ] Global hooks.
  - [ ] `runOnConnect`.
  - [ ] `runOnConnectRestart`.
  - [ ] `runOnDisconnect`.
- [ ] Hot reload UX.
  - [ ] Patch từng field.
  - [ ] Preview payload trước khi apply.
  - [ ] Hiển thị thành công/thất bại và field bị lỗi.

## 4. Protocol Servers

### 4.1 RTSP / RTSPS

- [ ] Enable/disable `rtsp`.
- [ ] Cấu hình `rtspAddress`.
- [ ] Cấu hình `rtspTransports`: `udp`, `multicast`, `tcp`.
- [ ] Cấu hình `rtspEncryption`: `no`, `strict`, `optional`.
- [ ] Cấu hình `rtspsAddress`.
- [ ] Cấu hình RTP/RTCP/SRTP/SRTCP addresses.
- [ ] Cấu hình multicast IP/ports.
- [ ] Cấu hình TLS key/cert.
- [ ] Cấu hình `rtspAuthMethods`: `basic`, `digest`.
- [ ] Danh sách RTSP connections.
- [ ] Danh sách RTSP sessions.
- [ ] Xem chi tiết session.
- [ ] Kick RTSP session.

### 4.2 RTMP / RTMPS

- [ ] Enable/disable `rtmp`.
- [ ] Cấu hình `rtmpAddress`.
- [ ] Cấu hình `rtmpEncryption`: `no`, `strict`, `optional`.
- [ ] Cấu hình `rtmpsAddress`.
- [ ] Cấu hình TLS key/cert.
- [ ] Danh sách RTMP connections.
- [ ] Xem chi tiết RTMP connection.
- [ ] Kick RTMP connection.

### 4.3 HLS

- [ ] Enable/disable `hls`.
- [ ] Cấu hình `hlsAddress`.
- [ ] Cấu hình HTTPS/TLS.
- [ ] Cấu hình HLS always remux.
- [ ] Cấu hình HLS variants/segment/count/duration/part duration nếu có trong version MediaMTX đang dùng.
- [ ] Cấu hình CORS/trusted proxies.
- [ ] Danh sách HLS muxers.
- [ ] Xem chi tiết HLS muxer.
- [ ] Player HLS live.
- [ ] Hiển thị URL doc stream HLS.

### 4.4 WebRTC / WHEP / WHIP

- [ ] Enable/disable `webrtc`.
- [ ] Cấu hình `webrtcAddress`.
- [ ] Cấu hình HTTPS/TLS.
- [ ] Cấu hình local UDP/TCP address.
- [ ] Cấu hình ICE servers/STUN/TURN.
- [ ] Cấu hình trusted proxies/CORS.
- [ ] Danh sách WebRTC sessions.
- [ ] Xem chi tiết WebRTC session.
- [ ] Kick WebRTC session.
- [ ] Player WebRTC nếu cần latency thap.
- [ ] Hiển thị publish/read URLs cho browser clients.

### 4.5 SRT

- [ ] Enable/disable `srt`.
- [ ] Cấu hình `srtAddress`.
- [ ] Cấu hình SRT publish/read passphrase o path.
- [ ] Danh sách SRT connections.
- [ ] Xem chi tiết SRT connection.
- [ ] Kick SRT connection.
- [ ] Hiển thị SRT metrics: RTT, loss, retransmit, send/receive rate.

### 4.6 RTP / MPEG-TS

- [ ] Hỗ trợ source RTP với `rtpSDP`.
- [ ] Hỗ trợ publish/read MPEG-TS theo hướng dẫn MediaMTX.
- [ ] Cấu hình demux MPEG-TS over RTSP: `rtspDemuxMpegts`.
- [ ] Hiển thị URL mau cho RTP/MPEG-TS.

## 5. Authentication Configuration

- [ ] Đọc/sửa `authMethod`.
- [ ] Internal auth.
  - [ ] List users từ `authInternalUsers`.
  - [ ] Add user.
  - [ ] Edit user.
  - [ ] Delete user.
  - [ ] Username `any`.
  - [ ] Password plain/hash.
  - [ ] Hỗ trợ Argon2/SHA256 prefix nếu người dùng nhập hash.
  - [ ] IP allowlist.
  - [ ] Permissions theo action.
  - [ ] Permissions theo path.
  - [ ] Regex path permissions.
- [ ] HTTP auth.
  - [ ] `authHTTPAddress`.
  - [ ] `authHTTPFingerprint`.
  - [ ] `authHTTPExclude`.
  - [ ] Test auth endpoint.
- [ ] JWT auth.
  - [ ] `authJWTJWKS`.
  - [ ] `authJWTJWKSFingerprint`.
  - [ ] `authJWTClaimKey`.
  - [ ] `authJWTExclude`.
  - [ ] `authJWTIssuer`.
  - [ ] `authJWTAudience`.
  - [ ] Trigger JWKS refresh.
- [ ] UI permission matrix.
  - [ ] `publish`.
  - [ ] `read`.
  - [ ] `playback`.
  - [ ] `api`.
  - [ ] `metrics`.
  - [ ] `pprof`.

## 6. Path Management

- [ ] Path list.
  - [ ] Configured paths.
  - [ ] Runtime paths.
  - [ ] Ready status.
  - [ ] Source type/id.
  - [ ] Tracks.
  - [ ] Readers.
  - [ ] Bytes in/out.
- [ ] Add/edit/delete/replace path.
- [ ] Path name support.
  - [ ] Normal path.
  - [ ] Regex path.
  - [ ] `all_others`.
- [ ] Source config.
  - [ ] `publisher`.
  - [ ] RTSP/RTSPS URL.
  - [ ] RTMP/RTMPS URL.
  - [ ] HLS URL.
  - [ ] SRT URL.
  - [ ] WHEP source.
  - [ ] RTP source.
  - [ ] Redirect source.
  - [ ] Raspberry Pi Camera source.
- [ ] Source common options.
  - [ ] `source`.
  - [ ] `sourceFingerprint`.
  - [ ] `sourceOnDemand`.
  - [ ] `sourceOnDemandStartTimeout`.
  - [ ] `sourceOnDemandCloseAfter`.
  - [ ] `maxReaders`.
  - [ ] `overridePublisher`.
  - [ ] `useAbsoluteTimestamp`.
- [ ] Path URLs.
  - [ ] RTSP URL.
  - [ ] RTSPS URL.
  - [ ] RTMP URL.
  - [ ] HLS URL.
  - [ ] WebRTC URL.
  - [ ] SRT URL.
- [ ] Path actions.
  - [ ] Preview live.
  - [ ] Copy stream URL.
  - [ ] Open playback.
  - [ ] Show active readers.
  - [ ] Kick reader/session.
  - [ ] Delete path config.

## 7. Path Defaults

- [ ] Màn hình cấu hình `pathDefaults`.
- [ ] Apply defaults cho tất cả path.
- [ ] So sánh path override với default.
- [ ] Reset path field về default.
- [ ] Import/export path defaults JSON/YAML.

## 8. Recording

- [ ] Global/path recording settings.
  - [ ] `record`.
  - [ ] `recordPath`.
  - [ ] `recordFormat`: `fmp4`, `mpegts`.
  - [ ] `recordPartDuration`.
  - [ ] `recordMaxPartSize`.
  - [ ] `recordSegmentDuration`.
  - [ ] `recordDeleteAfter`.
- [ ] Recording runtime.
  - [ ] List recordings: `GET /v3/recordings/list`.
  - [ ] Get recording by path/name.
  - [ ] Show segment list.
  - [ ] Delete segment: `POST /v3/recordings/deletesegment`.
- [ ] Recording status UI.
  - [ ] Đang ghi/idle theo path.
  - [ ] Segment mới nhất.
  - [ ] Dung lượng ước tính.
  - [ ] Retention status.
- [ ] Remote upload workflow.
  - [ ] Mẫu hook `runOnRecordSegmentComplete` cho rclone.
  - [ ] UI cấu hình command upload.
  - [ ] Cảnh báo quyền filesystem và bảo mật command.

## 9. Playback

- [ ] Enable/disable `playback`.
- [ ] Cấu hình `playbackAddress`.
- [ ] Cấu hình HTTPS/TLS.
- [ ] Cấu hình CORS/trusted proxies.
- [ ] Playback API client.
  - [ ] `GET /list?path=&start=&end=`.
  - [ ] `GET /get?path=&start=&duration=&format=`.
- [ ] Playback UI.
  - [ ] Chọn path.
  - [ ] Chọn date range.
  - [ ] Timeline recorded spans.
  - [ ] Play recording bằng video tag.
  - [ ] Download fMP4.
  - [ ] Download MP4 với `format=mp4`.
  - [ ] Copy playback URL.

## 10. Live Players

- [ ] HLS player hiện tại.
  - [ ] Xử lý path có ký tự đặc biệt.
  - [ ] Show manifest URL.
  - [ ] Better fatal/non-fatal error handling.
- [ ] WebRTC player.
- [ ] Playback player.
- [ ] Multi-view player.
  - [ ] Grid 2x2/3x3.
  - [ ] Pin stream.
  - [ ] Mute/unmute.
  - [ ] Fullscreen.
- [ ] Snapshot preview.

## 11. Forwarding

- [ ] UI cấu hình forward stream sang server khác.
- [ ] Generate `runOnReady` FFmpeg command.
- [ ] Cấu hình `runOnReadyRestart`.
- [ ] Forward target presets.
  - [ ] RTSP target.
  - [ ] RTMP target.
  - [ ] SRT target.
  - [ ] HLS/HTTP target nếu dùng FFmpeg phù hợp.
- [ ] Validate command.
- [ ] Hiển thị warning về FFmpeg dependency.

## 12. Proxy

- [ ] UI tạo proxy path.
- [ ] Hỗ trợ regex path.
- [ ] Hỗ trợ regex capture groups `$G1`, `$G2`.
- [ ] `sourceOnDemand` cho proxy.
- [ ] Proxy templates.
  - [ ] RTSP camera/server.
  - [ ] HLS upstream.
  - [ ] RTMP upstream.
  - [ ] SRT upstream.
- [ ] Test upstream source.

## 13. Always-Available Streams

- [ ] Hỗ trợ source static để path tồn tại kể cả khi publisher offline.
- [ ] UI phân biệt:
  - [ ] Publisher mode.
  - [ ] Pull from upstream.
  - [ ] On-demand pull.
  - [ ] Always pull.
- [ ] Hiển thị offline/connecting/ready state.

## 14. On-Demand Publishing

- [ ] UI cấu hình `runOnDemand`.
- [ ] UI cấu hình `runOnDemandRestart`.
- [ ] UI cấu hình `runOnUnDemand`.
- [ ] Command templates.
  - [ ] Loop file MP4 bằng FFmpeg.
  - [ ] Start camera process.
  - [ ] Pull external stream khi có reader.
- [ ] Hiển thị lifecycle của command nếu có thể suy ra từ logs/metrics.

## 15. Hooks

- [ ] Màn hình quản lý hooks global và path-level.
- [ ] Global hooks.
  - [ ] `runOnConnect`.
  - [ ] `runOnConnectRestart`.
  - [ ] `runOnDisconnect`.
- [ ] Path hooks.
  - [ ] `runOnInit`.
  - [ ] `runOnInitRestart`.
  - [ ] `runOnDemand`.
  - [ ] `runOnDemandRestart`.
  - [ ] `runOnUnDemand`.
  - [ ] `runOnReady`.
  - [ ] `runOnReadyRestart`.
  - [ ] `runOnNotReady`.
  - [ ] `runOnRead`.
  - [ ] `runOnReadRestart`.
  - [ ] `runOnUnread`.
  - [ ] `runOnRecordSegmentCreate`.
  - [ ] `runOnRecordSegmentComplete`.
- [ ] Hook command editor.
  - [ ] Multiline command.
  - [ ] Env var helper.
  - [ ] Template snippets.
  - [ ] Security warning.
- [ ] Hook test runner nếu có backend dashboard riêng.

## 16. Snapshots

- [ ] Snapshot feature dựa trên hook `runOnReady`.
- [ ] Generate FFmpeg command extract frame định kỳ.
- [ ] Cấu hình snapshot interval.
- [ ] Cấu hình snapshot output path.
- [ ] Thumbnail trong path list.
- [ ] Snapshot gallery.
- [ ] Xóa snapshot.
- [ ] Cảnh báo cần FFmpeg và filesystem access.

## 17. Re-Encoding

- [ ] UI tạo command re-encode bằng FFmpeg/GStreamer.
- [ ] Templates.
  - [ ] H264 to H264 bitrate change.
  - [ ] H265 to H264 for browser compatibility.
  - [ ] Audio transcode to AAC/Opus.
  - [ ] Scale resolution.
  - [ ] Add low-bitrate substream.
- [ ] Gắn command vào `runOnReady`, `runOnInit`, hoặc `runOnDemand`.
- [ ] Hiển thị CPU warning.

## 18. Absolute Timestamps

- [ ] Hỗ trợ `useAbsoluteTimestamp`.
- [ ] Giải thích UI ngắn gọn về recording date và sync multi-stream.
- [ ] Hiển thị protocol support:
  - [ ] Receive: HLS, RTSP, WebRTC, Raspberry Pi Camera.
  - [ ] Send: HLS, RTSP, WebRTC.
- [ ] Hiển thị warning khi source không có absolute timestamps.

## 19. Metrics

- [ ] Metrics server config.
  - [ ] `metrics`.
  - [ ] `metricsAddress`.
  - [ ] `metricsEncryption`.
  - [ ] TLS key/cert.
  - [ ] CORS.
  - [ ] Trusted proxies.
- [ ] Metrics fetcher.
  - [ ] Parse Prometheus text format.
  - [ ] Filter by query params.
  - [ ] Tính bitrate từ byte delta.
- [ ] Metrics dashboards.
  - [ ] Paths.
  - [ ] HLS sessions/muxers.
  - [ ] RTSP/RTSPS conns/sessions.
  - [ ] RTMP/RTMPS conns.
  - [ ] SRT conns.
  - [ ] WebRTC sessions.
- [ ] Alert/warning.
  - [ ] Packet loss.
  - [ ] Jitter cao.
  - [ ] Frames discarded.
  - [ ] Error frames.
  - [ ] No readers.
  - [ ] Source offline.
- [ ] Grafana integration.
  - [ ] Link đến dashboard Grafana.
  - [ ] Provision dashboard từ `grafana/provisioning`.

## 20. Performance / pprof

- [ ] pprof server config.
  - [ ] `pprof`.
  - [ ] `pprofAddress`.
  - [ ] `pprofEncryption`.
  - [ ] TLS key/cert.
  - [ ] CORS.
  - [ ] Trusted proxies.
- [ ] pprof links.
  - [ ] Heap.
  - [ ] Goroutine.
  - [ ] Profile CPU.
  - [ ] Trace.
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

- [ ] Unified Sessions page.
- [ ] Protocol tabs.
  - [ ] RTSP conns.
  - [ ] RTSP sessions.
  - [ ] RTSPS conns.
  - [ ] RTSPS sessions.
  - [ ] RTMP conns.
  - [ ] RTMPS conns.
  - [ ] SRT conns.
  - [ ] WebRTC sessions.
  - [ ] HLS sessions/muxers nếu endpoint/metrics có.
- [ ] Detail drawer.
  - [ ] ID.
  - [ ] Path.
  - [ ] Remote address.
  - [ ] State.
  - [ ] Bytes.
  - [ ] Packets.
  - [ ] Loss/jitter nếu có.
- [ ] Kick action.
- [ ] Confirm dialog cho kick.

## 23. Publish Guides Trong UI

- [ ] Generate publish command theo path.
- [ ] FFmpeg.
- [ ] GStreamer.
- [ ] OBS Studio.
- [ ] VLC nếu publish supported scenario.
- [ ] Python/OpenCV.
- [ ] Golang.
- [ ] Unity.
- [ ] Web browsers/WebRTC.
- [ ] Raspberry Pi Camera.
- [ ] Generic webcam.
- [ ] RTSP cameras/servers.
- [ ] RTMP cameras/servers.
- [ ] SRT clients/servers.
- [ ] HLS cameras/servers.
- [ ] MPEG-TS.
- [ ] RTP.

## 24. Read Guides Trong UI

- [ ] Generate read URLs theo path.
- [ ] RTSP.
- [ ] RTMP.
- [ ] HLS.
- [ ] WebRTC.
- [ ] SRT.
- [ ] FFmpeg command.
- [ ] GStreamer command.
- [ ] VLC command.
- [ ] OBS Studio source config.
- [ ] Python/OpenCV snippet.
- [ ] Golang snippet.
- [ ] Unity snippet.
- [ ] Browser URL/player.

## 25. Raspberry Pi Camera

- [ ] Source type `rpiCamera`.
- [ ] Camera ID.
- [ ] Secondary stream.
- [ ] Resolution.
- [ ] FPS.
- [ ] Flip H/V.
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
- [ ] TLS config UI cho API/metrics/pprof/playback/HLS/WebRTC/RTSP/RTMP.
- [ ] CORS allowed origins.
- [ ] Trusted proxies.
- [ ] Credential masking.
- [ ] Command hook safety warning.
- [ ] Backup config trước khi patch nhiều field.
- [ ] Confirm destructive actions:
  - [ ] Delete path.
  - [ ] Delete recording segment.
  - [ ] Kick session.
  - [ ] Replace config.

## 27. Configuration Import / Export

- [ ] Export global config JSON.
- [ ] Export paths JSON.
- [ ] Export path defaults JSON.
- [ ] Import config with validation.
- [ ] Diff current vs imported.
- [ ] Apply selected fields.
- [ ] Download generated `mediamtx.yml` nếu cần.

## 28. Validation

- [ ] Validate address format.
- [ ] Validate duration format.
- [ ] Validate path name.
- [ ] Validate regex path.
- [ ] Validate URLs.
- [ ] Validate TLS key/cert paths.
- [ ] Validate command fields không rỗng khi enable hook.
- [ ] Validate auth permissions.
- [ ] Validate recording path variables.
- [ ] Validate codec/browser compatibility hints.

## 29. Testing

- [ ] Unit tests cho API client.
- [ ] Unit tests cho config payload builders.
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

- [ ] Phase 1: Biến các UI hiện có thành thao tác thật.
  - [ ] Server global config get/patch.
  - [ ] Auth config get/patch.
  - [ ] Recording settings get/patch.
  - [ ] Monitoring fetch metrics thực.
- [ ] Phase 2: Quản trị runtime.
  - [ ] Sessions/connections list/get/kick.
  - [ ] HLS muxers.
  - [ ] Recordings list/get/delete segment.
  - [ ] Playback list/get/player.
- [ ] Phase 3: Advanced path features.
  - [ ] Path defaults.
  - [ ] Protocol-specific source settings.
  - [ ] Hooks.
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





