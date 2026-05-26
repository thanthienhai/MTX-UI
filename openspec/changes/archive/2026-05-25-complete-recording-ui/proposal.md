## Why

Màn hình Ghi hình (Recording) hiện tại có các phần cài đặt là placeholder chưa kết nối với API backend, thiếu trạng thái ghi theo path, chưa có ước tính dung lượng, và chưa hỗ trợ luồng upload từ xa qua hook `runOnRecordSegmentComplete`. Hoàn thiện các chức năng này giúp người quản trị có thể quản lý ghi hình toàn diện ngay trong dashboard.

## What Changes

- Kết nối phần "Cài đặt ghi hình" trong tab Recording với API path defaults (`PATCH /v3/config/pathdefaults/patch`).
- Thêm field `recordMaxPartSize` vào recording settings (còn thiếu trong todo).
- Xây dựng **Recording Status UI** hiển thị trạng thái đang ghi/idle theo từng path, segment mới nhất, dung lượng ước tính, và retention status.
- Xây dựng **Remote Upload Workflow**: mẫu hook `runOnRecordSegmentComplete` cho rclone, UI cấu hình command upload, cảnh báo bảo mật.
- Tách phần Recording settings và status thành component riêng (giống pattern `GlobalConfigView`, `AuthConfigurationView`).

## Capabilities

### New Capabilities
- `recording-settings-ui`: Giao diện cấu hình recording settings toàn cục (qua path defaults) gồm record, recordPath, recordFormat, recordPartDuration, recordSegmentDuration, recordMaxPartSize, recordDeleteAfter. Kết nối với API patch path defaults, preview payload, hot reload.
- `recording-status-ui`: Bảng trạng thái ghi hình theo từng path: đang ghi/idle, segment mới nhất, dung lượng ước tính, retention status. Polling realtime.
- `remote-upload-workflow`: Mẫu hook `runOnRecordSegmentComplete` cho rclone, UI cấu hình command, cảnh báo filesystem & bảo mật.

### Modified Capabilities
- `path-defaults-ui`: Thêm field `recordMaxPartSize` vào danh sách field recording trong path defaults editor (PATH_FIELD_REGISTRY).

## Impact

- `lib/mediamtx-api.ts`: API client không cần thay đổi (đã có đủ endpoints).
- `lib/path-management.mjs`: Thêm `recordMaxPartSize` vào PATH_FIELD_REGISTRY.
- `app/page.tsx`: Tách recording tab content thành component riêng, cập nhật state management.
- `components/`: Thêm `recording-settings-view.tsx`, `recording-status-view.tsx`, `remote-upload-config.tsx`.
- `components/path-management/`: Cập nhật path-form để hỗ trợ recordMaxPartSize.
- Không có thay đổi dependencies mới.
