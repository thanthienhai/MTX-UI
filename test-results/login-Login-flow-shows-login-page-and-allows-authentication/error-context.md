# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: login.spec.ts >> Login flow >> shows login page and allows authentication
- Location: e2e/login.spec.ts:4:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByText('MediaMTX Dashboard')
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for getByText('MediaMTX Dashboard')

```

```yaml
- img "SIPVY"
- text: Bảng điều khiển MediaMTX Đăng nhập để quản trị máy chủ streaming Kiểu xác thực
- combobox "Kiểu xác thực": Basic Auth
- text: Tên người dùng
- textbox "Tên người dùng":
  - /placeholder: admin
- text: Mật khẩu
- textbox "Mật khẩu"
- button "Đăng nhập"
- paragraph: "Thông tin mặc định:"
- paragraph: "Tên người dùng: admin | Mật khẩu: adminpass"
- paragraph: Chế độ Token/JWT gửi thông tin xác thực dưới dạng bearer token.
- alert
```

# Test source

```ts
  1  | import { test, expect } from "@playwright/test"
  2  | 
  3  | test.describe("Login flow", () => {
  4  |   test("shows login page and allows authentication", async ({ page }) => {
  5  |     // Mock the auth endpoints
  6  |     await page.route("**/api/auth/me", async (route) => {
  7  |       await route.fulfill({
  8  |         status: 401,
  9  |         contentType: "application/json",
  10 |         body: JSON.stringify({ error: "Unauthorized" }),
  11 |       })
  12 |     })
  13 | 
  14 |     await page.goto("/")
  15 | 
  16 |     // Should redirect to login
  17 |     await expect(page).toHaveURL(/\/login/)
> 18 |     await expect(page.getByText("MediaMTX Dashboard")).toBeVisible()
     |                                                        ^ Error: expect(locator).toBeVisible() failed
  19 |   })
  20 | 
  21 |   test("shows error on invalid credentials", async ({ page }) => {
  22 |     await page.goto("/login")
  23 | 
  24 |     await page.route("**/api/auth/login", async (route) => {
  25 |       await route.fulfill({
  26 |         status: 401,
  27 |         contentType: "application/json",
  28 |         body: JSON.stringify({ error: "Invalid credentials" }),
  29 |       })
  30 |     })
  31 | 
  32 |     await page.fill('input[type="text"]', "admin")
  33 |     await page.fill('input[type="password"]', "wrong")
  34 |     await page.click('button:has-text("Đăng nhập")')
  35 | 
  36 |     await expect(page.getByText(/invalid/i)).toBeVisible()
  37 |   })
  38 | 
  39 |   test("navigates to dashboard on successful login", async ({ page }) => {
  40 |     await page.goto("/login")
  41 | 
  42 |     await page.route("**/api/auth/login", async (route) => {
  43 |       await route.fulfill({
  44 |         status: 200,
  45 |         contentType: "application/json",
  46 |         body: JSON.stringify({ username: "admin", permissions: ["api", "metrics"] }),
  47 |       })
  48 |     })
  49 | 
  50 |     await page.route("**/api/auth/me", async (route) => {
  51 |       await route.fulfill({
  52 |         status: 200,
  53 |         contentType: "application/json",
  54 |         body: JSON.stringify({ username: "admin", permissions: ["api", "metrics"] }),
  55 |       })
  56 |     })
  57 | 
  58 |     await page.fill('input[type="text"]', "admin")
  59 |     await page.fill('input[type="password"]', "password")
  60 |     await page.click('button:has-text("Đăng nhập")')
  61 | 
  62 |     await expect(page.getByText("MediaMTX Dashboard")).toBeVisible()
  63 |   })
  64 | })
  65 | 
```