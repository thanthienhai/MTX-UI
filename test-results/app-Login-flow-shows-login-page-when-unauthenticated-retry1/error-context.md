# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: app.spec.ts >> Login flow >> shows login page when unauthenticated
- Location: e2e/app.spec.ts:4:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByText('Đăng nhập')
Expected: visible
Error: strict mode violation: getByText('Đăng nhập') resolved to 2 elements:
    1) <div data-slot="card-description" class="text-muted-foreground text-sm text-center">Đăng nhập để quản trị máy chủ streaming</div> aka getByText('Đăng nhập để quản trị máy ch')
    2) <button type="submit" data-slot="button" class="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive bg-primary t…>Đăng nhập</button> aka getByRole('button', { name: 'Đăng nhập' })

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for getByText('Đăng nhập')

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e3]:
    - generic [ref=e4]:
      - img "SIPVY" [ref=e5]
      - generic [ref=e6]: Bảng điều khiển MediaMTX
      - generic [ref=e7]: Đăng nhập để quản trị máy chủ streaming
    - generic [ref=e8]:
      - generic [ref=e9]:
        - generic [ref=e10]:
          - generic [ref=e11]: Kiểu xác thực
          - combobox "Kiểu xác thực" [ref=e12]:
            - generic: Basic Auth
            - img
          - combobox [ref=e13]
        - generic [ref=e14]:
          - generic [ref=e15]: Tên người dùng
          - textbox "Tên người dùng" [ref=e16]:
            - /placeholder: admin
        - generic [ref=e17]:
          - generic [ref=e18]: Mật khẩu
          - textbox "Mật khẩu" [ref=e19]
        - button "Đăng nhập" [ref=e20]
      - generic [ref=e21]:
        - paragraph [ref=e22]: "Thông tin mặc định:"
        - paragraph [ref=e23]: "Tên người dùng: admin | Mật khẩu: adminpass"
        - paragraph [ref=e24]: Chế độ Token/JWT gửi thông tin xác thực dưới dạng bearer token.
  - alert [ref=e25]
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
> 11  |     await expect(page.getByText("Đăng nhập")).toBeVisible()
      |                                               ^ Error: expect(locator).toBeVisible() failed
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
  99  |     await expect(page.getByText("Recording Status")).toBeVisible()
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
```