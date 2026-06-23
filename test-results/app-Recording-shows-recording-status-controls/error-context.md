# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: app.spec.ts >> Recording >> shows recording status controls
- Location: e2e/app.spec.ts:82:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByText('Recording Status')
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for getByText('Recording Status')

```

```yaml
- img "SIPVY"
- heading "MediaMTX Dashboard" [level=1]
- paragraph: Media streaming server management
- img
- text: Online
- img
- button "Ẩn tóm tắt":
  - img
  - text: Ẩn tóm tắt
- button "Đăng xuất":
  - img
  - text: Đăng xuất
- paragraph: Stream đang chạy
- img
- paragraph: "0"
- paragraph: 0 live, 1 đang chờ
- paragraph: Tổng người xem
- img
- paragraph: "0"
- paragraph: Trên tất cả stream
- paragraph: Path đã cấu hình
- img
- paragraph: "1"
- paragraph: Sẵn sàng cho RTSP, RTMP, HLS
- paragraph: Trạng thái máy chủ
- img
- paragraph: Lỗi
- paragraph: Tự refresh mỗi 10 giây
- button "Thêm path":
  - img
  - text: Thêm path
- button "Refresh":
  - img
  - text: Refresh
- paragraph: Tóm tắt lưu lượng
- paragraph: 0.00 MB
- text: refresh 10s Stream live 0/1
- paragraph: Đã nhận
- paragraph: 0.00 MB
- paragraph: Người xem
- paragraph: "0"
- tablist:
  - tab "Tổng quan":
    - img
    - text: Tổng quan
  - tab "Máy chủ":
    - img
    - text: Máy chủ
  - tab "Paths":
    - img
    - text: Paths
  - tab "Live Players":
    - img
    - text: Live Players
  - tab "Cấu hình":
    - img
    - text: Cấu hình
  - tab "Hooks":
    - img
    - text: Hooks
  - tab "Protocols":
    - img
    - text: Protocols
  - tab "Xác thực":
    - img
    - text: Xác thực
  - tab "Ghi hình" [selected]:
    - img
    - text: Ghi hình
  - tab "Giám sát":
    - img
    - text: Giám sát
  - tab "Proxy":
    - img
    - text: Proxy
  - tab "Guides":
    - img
    - text: Guides
  - tab "Logs":
    - img
    - text: Logs
- tabpanel "Ghi hình":
  - text: Cài đặt ghi hình Cấu hình tùy chọn ghi hình stream qua path defaults
  - button "Refresh":
    - img
    - text: Refresh
  - text: Bật ghi hình
  - paragraph: Cho phép ghi hình stream cho tất cả path
  - switch
  - text: Định dạng ghi hình
  - combobox
  - text: Đường dẫn ghi hình
  - textbox "Đường dẫn ghi hình"
  - paragraph: "Biến: %path, %Y %m %d (ngày), %H %M %S (giờ)"
  - text: Thời lượng part
  - textbox "Thời lượng part"
  - text: Thời lượng segment
  - textbox "Thời lượng segment"
  - text: Kích thước part tối đa
  - textbox "Kích thước part tối đa":
    - /placeholder: 50M
  - paragraph: "Định dạng: số + đơn vị (vd: 50M, 100M, 1G)"
  - text: Xóa sau
  - textbox "Xóa sau"
  - paragraph: Đặt 0s để tắt tự động xóa
  - button "Xem trước & lưu" [disabled]:
    - img
    - text: Xem trước & lưu
  - img
  - paragraph: Không thể tải dữ liệu
  - paragraph: Yêu cầu MediaMTX API thất bại (500 Internal Server Error)
  - button "Thử lại"
  - text: Upload từ xa (rclone) Cấu hình command cho hook
  - code: runOnRecordSegmentComplete
  - text: để upload segment lên remote storage.
  - img
  - paragraph:
    - strong: "Cảnh báo filesystem:"
    - text: MediaMTX cần quyền ghi filesystem để tạo file ghi hình. Hook
    - code: runOnRecordSegmentComplete
    - text: chạy với quyền của process MediaMTX.
  - paragraph:
    - strong: "Cảnh báo bảo mật:"
    - text: Hook command chạy với quyền MediaMTX. Không nhúng secret/password trực tiếp vào command. Sử dụng environment variables hoặc file cấu hình riêng.
  - img
  - text: "Biến môi trường MediaMTX có sẵn trong hook:"
  - code: $MTX_PATH
  - text: Tên path
  - code: $MTX_RECORD_PATH
  - text: Đường dẫn file ghi hình
  - code: $MTX_RECORD_FORMAT
  - text: Định dạng ghi hình (fmp4/mpegts)
  - code: $MTX_RECORD_SEGMENT_DURATION
  - text: Thời lượng segment Command
  - textbox "Command":
    - /placeholder: "# Upload segment lên remote storage bằng rclone\n# Biến môi trường MediaMTX có sẵn:\n#   $MTX_PATH - tên path\n#   $MTX_RECORD_PATH - đường dẫn file ghi hình\n#   $MTX_RECORD_FORMAT - định dạng ghi hình\n#   $MTX_RECORD_SEGMENT_DURATION - thời lượng segment\n\nrclone copy \"$MTX_RECORD_PATH\" \"remote:stream-recordings/$MTX_PATH\""
    - text: "# Upload segment lên remote storage bằng rclone # Biến môi trường MediaMTX có sẵn: # $MTX_PATH - tên path # $MTX_RECORD_PATH - đường dẫn file ghi hình # $MTX_RECORD_FORMAT - định dạng ghi hình # $MTX_RECORD_SEGMENT_DURATION - thời lượng segment rclone copy \"$MTX_RECORD_PATH\" \"remote:stream-recordings/$MTX_PATH\""
  - paragraph: Lưu command vào localStorage trình duyệt. Command này không được đồng bộ lên máy chủ.
  - button "Lưu command":
    - img
    - text: Lưu command
  - button "Sao chép command":
    - img
    - text: Sao chép command
  - button "Đặt lại mặc định"
  - text: Đã lưu (local)
  - img
  - paragraph: Không thể tải dữ liệu
  - paragraph: Yêu cầu MediaMTX API thất bại (500 Internal Server Error)
  - button "Thử lại"
  - text: Playback bản ghi Xem và tải lại các bản ghi đã lưu
  - button "Refresh":
    - img
    - text: Refresh
  - text: Path
  - combobox "Path": Chọn path...
  - text: Từ ngày
  - textbox "Từ ngày" [disabled]
  - text: Đến ngày
  - textbox "Đến ngày" [disabled]
  - img
  - paragraph: Chọn path để xem bản ghi
  - paragraph: Không có path nào bật ghi hình
- status: Dữ liệu MediaMTX chưa đầy đủ Yêu cầu MediaMTX API thất bại (500 Internal Server Error)
- status: Không thể tải trạng thái ghi hình Yêu cầu MediaMTX API thất bại (500 Internal Server Error)
- status: Không thể tải cấu hình playback Yêu cầu MediaMTX API thất bại (500 Internal Server Error)
- alert
```

# Test source

```ts
  1   | import { test, expect } from "@playwright/test"
  2   | 
  3   | test.describe("Login flow", () => {
  4   |   test("shows login page when unauthenticated", async ({ page }) => {
  5   |     await page.route("**/api/auth/me", async (route) => {
  6   |       await route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({}) })
  7   |     })
  8   | 
  9   |     await page.goto("/")
  10  |     await expect(page.getByText("Bảng điều khiển MediaMTX")).toBeVisible()
  11  |     await expect(page.getByText("Đăng nhập")).toBeVisible()
  12  |   })
  13  | 
  14  |   test("shows error on invalid credentials", async ({ page }) => {
  15  |     await page.route("**/api/auth/login", async (route) => {
  16  |       await route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ error: "Sai thông tin đăng nhập" }) })
  17  |     })
  18  | 
  19  |     await page.goto("/login")
  20  |     await page.fill("#username", "admin")
  21  |     await page.fill("#password", "wrong")
  22  |     await page.click('button:has-text("Đăng nhập")')
  23  |     await expect(page.getByText(/Sai thông tin/)).toBeVisible()
  24  |   })
  25  | 
  26  |   test("navigates to dashboard on successful login", async ({ page }) => {
  27  |     await page.goto("/login")
  28  | 
  29  |     await page.route("**/api/auth/login", async (route) => {
  30  |       await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ username: "admin", permissions: ["api", "metrics"] }) })
  31  |     })
  32  | 
  33  |     await page.route("**/api/auth/me", async (route) => {
  34  |       await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ username: "admin", permissions: ["api", "metrics"] }) })
  35  |     })
  36  | 
  37  |     await page.fill("#username", "admin")
  38  |     await page.fill("#password", "adminpass")
  39  |     await page.click('button:has-text("Đăng nhập")')
  40  |     await expect(page.getByText("MediaMTX Dashboard")).toBeVisible()
  41  |   })
  42  | })
  43  | 
  44  | test.describe("Path CRUD", () => {
  45  |   test.beforeEach(async ({ page }) => {
  46  |     // Mock auth globally
  47  |     await page.route("**/api/auth/me", async (route) => {
  48  |       await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ username: "admin", permissions: ["api", "metrics", "read", "playback"] }) })
  49  |     })
  50  |     await page.route("**/api/auth/login", async (route) => {
  51  |       await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({}) })
  52  |     })
  53  |   })
  54  | 
  55  |   test("displays path list", async ({ page }) => {
  56  |     await page.route("**/api/mediamtx/v3/config/paths/list**", async (route) => {
  57  |       await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ items: [{ name: "test-cam", source: "rtsp://192.168.1.100:554/stream" }] }) })
  58  |     })
  59  |     await page.route("**/api/mediamtx/v3/paths/list**", async (route) => {
  60  |       await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ items: [] }) })
  61  |     })
  62  |     await page.route("**/api/mediamtx/v3/config/pathdefaults/get**", async (route) => {
  63  |       await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({}) })
  64  |     })
  65  | 
  66  |     await page.goto("/")
  67  |     await expect(page.getByText("Path stream")).toBeVisible()
  68  |   })
  69  | 
  70  |   test("renders login gate for public config page", async ({ page }) => {
  71  |     await page.route("**/api/public/config/*/login", async (route) => {
  72  |       await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({}) })
  73  |     })
  74  | 
  75  |     await page.goto("/public/config/test-token-123")
  76  |     await expect(page.getByText("Cấu hình sự kiện")).toBeVisible()
  77  |     await expect(page.getByText("Nhập mã đăng nhập")).toBeVisible()
  78  |   })
  79  | })
  80  | 
  81  | test.describe("Recording", () => {
  82  |   test("shows recording status controls", async ({ page }) => {
  83  |     await page.route("**/api/auth/me", async (route) => {
  84  |       await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ username: "admin", permissions: ["api"] }) })
  85  |     })
  86  | 
  87  |     await page.route("**/api/mediamtx/v3/config/paths/list**", async (route) => {
  88  |       await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ items: [{ name: "cam1", source: "rtsp://192.168.1.100/stream" }] }) })
  89  |     })
  90  |     await page.route("**/api/mediamtx/v3/paths/list**", async (route) => {
  91  |       await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ items: [{ name: "cam1", source: { type: "rtsp" }, tracks: ["video"], readers: 1, bytesReceived: 1024, bytesSent: 512 }] }) })
  92  |     })
  93  |     await page.route("**/api/mediamtx/v3/config/pathdefaults/get**", async (route) => {
  94  |       await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({}) })
  95  |     })
  96  | 
  97  |     await page.goto("/")
  98  |     await page.getByText("Ghi hình").click()
> 99  |     await expect(page.getByText("Recording Status")).toBeVisible()
      |                                                      ^ Error: expect(locator).toBeVisible() failed
  100 |   })
  101 | })
  102 | 
  103 | test.describe("Playback", () => {
  104 |   test("shows playback page", async ({ page }) => {
  105 |     await page.route("**/api/auth/me", async (route) => {
  106 |       await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ username: "admin", permissions: ["api", "playback"] }) })
  107 |     })
  108 |     await page.route("**/api/mediamtx/v3/config/paths/list**", async (route) => {
  109 |       await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ items: [{ name: "cam1" }] }) })
  110 |     })
  111 | 
  112 |     await page.goto("/")
  113 |     await page.getByText("Xem lại").click()
  114 |     await expect(page.getByText("Playback")).toBeVisible()
  115 |   })
  116 | })
  117 | 
```