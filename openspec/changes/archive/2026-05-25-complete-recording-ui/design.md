## Context

Tab Recording trong dashboard MTX-UI hiện có hai phần: (1) "Cài đặt ghi hình" dùng `defaultValue` placeholder chưa kết nối API, (2) "Trạng thái ghi hình" chỉ liệt kê recordings với segment đầu tiên. Backend MediaMTX không có global recording config riêng — recording settings là per-path fields trong `PathConf` và có thể set qua path defaults (`PATCH /v3/config/pathdefaults/patch`). Module Path Defaults đã có sẵn cơ chế đọc/patch path defaults qua `useEffect` + preview-save pattern.

## Goals / Non-Goals

**Goals:**
- Kết nối Recording Settings UI với API path defaults (đọc `GET /v3/config/pathdefaults/get`, patch `PATCH /v3/config/pathdefaults/patch`).
- Thêm `recordMaxPartSize` vào PATH_FIELD_REGISTRY và path-form.
- Xây dựng Recording Status UI hiển thị trạng thái ghi theo từng path (dùng runtime paths + recordings API).
- Cung cấp mẫu hook `runOnRecordSegmentComplete` cho rclone và UI cấu hình command.
- Tách recording tab content thành component riêng, giảm kích thước `app/page.tsx`.

**Non-Goals:**
- Không xây dựng playback recording (đã có trong section 9 riêng).
- Không thay đổi cơ chế auth/permission hiện tại.
- Không thêm i18n library (giữ nguyên hardcoded Vietnamese).

## Decisions

1. **Dùng path defaults API thay vì global config API** — MediaMTX không có global recording config. Path defaults là cơ chế chính thức để set recording settings cho tất cả path. Pattern tương tự `PathDefaultsEditor` đã có sẵn.

2. **Recording status xác định qua runtime paths** — Dùng `GET /v3/paths/list` để lấy danh sách runtime paths, kiểm tra field `source` (nếu có publisher → đang ghi nếu `record=true`). Kết hợp với `GET /v3/recordings/list` để lấy thông tin segment. Không cần endpoint mới.

3. **Dung lượng ước tính từ segment durations** — MediaMTX không expose dung lượng file qua API. Ước tính dựa trên: `sum(segment.duration) * bitrate_estimate`. Bitrate estimate lấy từ metrics (bytes_in/bytes_out) hoặc dùng hằng số mặc định.

4. **Retention status từ `recordDeleteAfter`** — So sánh thời gian segment mới nhất với `recordDeleteAfter` để tính thời gian còn lại trước khi segment bị xóa.

5. **Component tách riêng theo pattern `GlobalConfigView`** — Mỗi phần (settings, status, upload config) là standalone client component với loading/error state riêng, nhận `permissions`, `username`, `appendAuditEvent` props.

6. **Remote upload config lưu trong localStorage** — Command template cho rclone lưu ở client-side (không phải backend MediaMTX config). Dùng localStorage với cảnh báo bảo mật.

## Risks / Trade-offs

- [Dung lượng ước tính thiếu chính xác] → Ghi chú UI "dung lượng ước tính" kèm disclaimer, không dùng cho billing.
- [Không có API trạng thái ghi realtime] → Dùng polling (interval 5-10s) qua `useRefreshPolling`, tương tự các module khác.
- [Command upload lưu localStorage không an toàn] → Cảnh báo rõ trong UI: không lưu secret/password trong command field.
