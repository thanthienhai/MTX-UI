## 1. Add recordMaxPartSize to Field Registry

- [x] 1.1 Thêm `recordMaxPartSize` vào `PATH_FIELD_REGISTRY` trong `lib/path-management.mjs` với category `recording`, type `string`, placeholder `50M`, appliesToDefaults `true`.
- [x] 1.2 Cập nhật `renderField` trong `components/path-defaults/path-defaults-editor.tsx` (hoặc file xử lý) để hỗ trợ type mới `size` (chấp nhận số + suffix M/G) cho `recordMaxPartSize`.
- [x] 1.3 Cập nhật `components/path-management/path-form.tsx` thêm field `recordMaxPartSize` sau `recordPartDuration`.

## 2. Create RecordingSettingsView Component

- [x] 2.1 Tạo `components/recording-settings-view.tsx` — standalone client component theo pattern `GlobalConfigView`: nhận `permissions`, `username`, `appendAuditEvent` props.
- [x] 2.2 Implement `useEffect` gọi `api.getPathDefaults()` khi mount, trích xuất 7 recording fields vào local state.
- [x] 2.3 Render form với: toggle switch cho `record`, input/text cho `recordPath`, select cho `recordFormat` (fmp4/mpegts), duration inputs cho `recordPartDuration`/`recordSegmentDuration`, size input cho `recordMaxPartSize`, duration input cho `recordDeleteAfter`.
- [x] 2.4 Khi `record=false`, disable tất cả dependent fields (recordPath, recordFormat, etc.).
- [x] 2.5 Implement preview-save pattern: compute diff, show preview dialog, gọi `api.patchPathDefaults()` khi confirm.
- [x] 2.6 Thêm loading state, error state với retry, success/failure toast, audit event.
- [x] 2.7 Validate `recordMaxPartSize` format (số + M/G suffix) trước khi patch.

## 3. Create RecordingStatusView Component

- [x] 3.1 Tạo `components/recording-status-view.tsx` — standalone client component nhận `permissions`, `username`, `appendAuditEvent`, `pollingRefresh` props.
- [x] 3.2 Implement `useEffect` gọi song song `api.getPaths()` (runtime paths) và `api.getRecordings()` — lọc paths có `record=true`.
- [x] 3.3 Xây dựng per-path status: kiểm tra runtime path có `source` (có publisher) → "Đang ghi" badge, không → "Idle" badge.
- [x] 3.4 Với mỗi recording path, hiển thị: tên path, trạng thái (đang ghi/idle), số segment, segment mới nhất (start time + duration).
- [x] 3.5 Tính dung lượng ước tính: `sum(segment.duration) * estimated_bitrate` — lưu ý disclaimer "dung lượng ước tính".
- [x] 3.6 Tính retention status: so sánh segment mới nhất với `recordDeleteAfter`, hiển thị thời gian còn lại hoặc warning.
- [x] 3.7 Implement xóa segment: click nút "Xóa" → confirm dialog → gọi `deleteRecordingSegment()` → refresh → audit.
- [x] 3.8 Tích hợp polling: sử dụng `useRefreshPolling` với interval 10s, chỉ refresh khi tab Recording active.

## 4. Create RemoteUploadConfig Component

- [x] 4.1 Tạo `components/remote-upload-config.tsx` — standalone client component.
- [x] 4.2 Hiển thị section "Upload từ xa (rclone)" với template command sẵn: `rclone copy "{{ .RecordPath }}" "remote:stream-recordings/{{ .Path }}"` trong multi-line textarea.
- [x] 4.3 Document available env vars: `MTX_PATH`, `MTX_RECORD_PATH`, `MTX_RECORD_FORMAT`, `MTX_RECORD_SEGMENT_DURATION`.
- [x] 4.4 Lưu command vào localStorage khi operator nhấn "Lưu", hiển thị indicator "Đã lưu (local)".
- [x] 4.5 Nút "Sao chép command" copy command vào clipboard để dán vào MediaMTX config.
- [x] 4.6 Hiển thị warning filesystem: "MediaMTX cần quyền ghi filesystem..."
- [x] 4.7 Hiển thị warning bảo mật: "Cảnh báo bảo mật: Hook command chạy với quyền MediaMTX..."

## 5. Refactor Recording Tab in Dashboard

- [x] 5.1 Import `RecordingSettingsView`, `RecordingStatusView`, `RemoteUploadConfig` vào `app/page.tsx`.
- [x] 5.2 Thay thế nội dung `TabsContent value="recording"` bằng 3 components mới, truyền props `permissions`, `username`, `appendAuditEvent`, `pollingRefresh`.
- [x] 5.3 Xóa state `recordings` (nay do RecordingStatusView tự quản lý) khỏi dashboard state.
- [x] 5.4 Xóa `handleDeleteRecordingSegment` khỏi dashboard (nay do RecordingStatusView xử lý).
- [x] 5.5 Xóa recording fetch khỏi `Promise.allSettled` trong dashboard data loading.

## 6. Update Path Conf Type

- [x] 6.1 Thêm `recordMaxPartSize?: string` vào interface `PathConf` trong `lib/mediamtx-api.ts` (nếu chưa có).

## 7. Verify and Test

- [x] 7.1 Chạy `npm run build` (hoặc `next build`) kiểm tra type errors.
- [ ] 7.2 Kiểm tra recording settings load/save hoạt động với MediaMTX backend (cần backend thật).
- [ ] 7.3 Kiểm tra recording status hiển thị đúng đang ghi/idle per path (cần backend thật).
- [ ] 7.4 Kiểm tra segment delete hoạt động (cần backend thật).
- [ ] 7.5 Kiểm tra remote upload config lưu/load từ localStorage. (cần trình duyệt)
