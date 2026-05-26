## Why

Hooks management trong MediaMTX dashboard hiện đang bị **phân mảnh**: global hooks (`runOnConnect`, `runOnDisconnect`) nằm trong Global Config tab, path hooks bị rải rác trong path edit dialog (4 hooks có UI, 5 hooks chưa có UI nào), và không có một hook command editor thống nhất hỗ trợ multiline, env var helper, template snippets, hay security warning. Điều này gây khó khăn cho người dùng khi cấu hình các hook command phức tạp và tiềm ẩn rủi ro bảo mật.

## What Changes

- **Tạo tab "Hooks" riêng** trong dashboard navigation, thay thế và mở rộng global hooks hiện tại.
- **Di chuyển global hooks** (`runOnConnect`, `runOnConnectRestart`, `runOnDisconnect`) từ Global Config tab sang Hooks tab.
- **Thêm UI cho toàn bộ 14 path-level hooks**, bao gồm 5 hooks chưa có UI: `runOnNotReady`, `runOnRead`, `runOnReadRestart`, `runOnUnread`, `runOnRecordSegmentCreate`.
- **Tạo reusable `HookCommandEditor` component** với multiline command, env var helper, template snippets, và security warning - dùng chung cho tất cả hook fields.
- **Organize path hooks theo nhóm lifecycle**: Lifecycle (init/ready/notReady), On-Demand (demand/undemand), Read Events (read/unread), Recording Events (segment create/complete).
- **Giữ nguyên Forwarding và On-Demand config components** hiện tại (chúng là specialized template UI), nhưng expose thêm raw command editor từ HookCommandEditor.
- **Thêm hook test runner** mock UI sẵn sàng cho backend dashboard riêng sau này.

## Capabilities

### New Capabilities
- `hooks-management`: Màn hình quản lý hooks tập trung - global hooks + path-level hooks với path selector, grouped theo lifecycle category.
- `hook-command-editor`: Component reusable cho việc soạn thảo hook command - multiline textarea, env var helper, template snippets, security warning, restart toggle.

### Modified Capabilities
- `global-config-ui`: Remove global hooks section (3 fields) - chuyển sang Hooks tab. Chỉ giữ lại General Settings.
- `on-demand-publishing`: Giữ nguyên specialized template UI, tích hợp thêm HookCommandEditor cho raw command editing.
- `forwarding-config`: Giữ nguyên specialized template UI, tích hợp thêm HookCommandEditor cho raw command editing.

## Impact

- **app/page.tsx**: Thêm tab `hooks` vào `TabsList` và `TabsContent`.
- **components/global-config-view.tsx**: Remove hooks section card.
- **components/path-management/path-form.tsx**: Có thể loại bỏ các hook section riêng lẻ nếu Hooks tab thay thế, hoặc giữ lại để edit nhanh trong path dialog.
- **components/**: Thêm `hooks-view.tsx`, `hook-command-editor.tsx` mới.
- **lib/mediamtx-api.ts**: Không cần thay đổi (types và API methods đã đầy đủ).
- **openspec/specs/**: Thêm `hooks-management/` và `hook-command-editor/`.
