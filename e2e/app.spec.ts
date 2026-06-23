import { test, expect } from "@playwright/test"

test.describe("Login flow", () => {
  test("shows login page when unauthenticated", async ({ page }) => {
    await page.route("**/api/auth/me", async (route) => {
      await route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({}) })
    })

    await page.goto("/")
    await expect(page.getByText("Bảng điều khiển MediaMTX")).toBeVisible()
    await expect(page.getByRole("button", { name: "Đăng nhập" })).toBeVisible()
  })

  test("shows error on invalid credentials", async ({ page }) => {
    await page.route("**/api/auth/login", async (route) => {
      await route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ error: "Sai thông tin đăng nhập" }) })
    })

    await page.goto("/login")
    await page.fill("#username", "admin")
    await page.fill("#password", "wrong")
    await page.click('button:has-text("Đăng nhập")')
    await expect(page.getByText(/Sai thông tin/)).toBeVisible()
  })

  test("navigates to dashboard on successful login", async ({ page }) => {
    await page.goto("/login")

    await page.route("**/api/auth/login", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ username: "admin", permissions: ["api", "metrics"] }) })
    })

    await page.route("**/api/auth/me", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ username: "admin", permissions: ["api", "metrics"] }) })
    })

    await page.fill("#username", "admin")
    await page.fill("#password", "adminpass")
    await page.click('button:has-text("Đăng nhập")')
    await expect(page.getByText("MediaMTX Dashboard")).toBeVisible()
  })
})

test.describe("Path CRUD", () => {
  test.beforeEach(async ({ page }) => {
    // Mock auth globally
    await page.route("**/api/auth/me", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ username: "admin", permissions: ["api", "metrics", "read", "playback"] }) })
    })
    await page.route("**/api/auth/login", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({}) })
    })
  })

  test("displays path list", async ({ page }) => {
    await page.route("**/api/mediamtx/v3/config/paths/list**", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ items: [{ name: "test-cam", source: "rtsp://192.168.1.100:554/stream" }] }) })
    })
    await page.route("**/api/mediamtx/v3/paths/list**", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ items: [] }) })
    })
    await page.route("**/api/mediamtx/v3/config/pathdefaults/get**", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({}) })
    })

    await page.goto("/")
    await expect(page.getByText("Path stream")).toBeVisible()
  })

  test("renders login gate for public config page", async ({ page }) => {
    await page.route("**/api/public/config/*/login", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({}) })
    })

    await page.goto("/public/config/test-token-123")
    await expect(page.getByText("Cấu hình sự kiện")).toBeVisible()
    await expect(page.getByText("Nhập mã đăng nhập")).toBeVisible()
  })
})

test.describe("Recording", () => {
  test("shows recording status controls", async ({ page }) => {
    await page.route("**/api/auth/me", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ username: "admin", permissions: ["api"] }) })
    })

    await page.route("**/api/mediamtx/v3/config/paths/list**", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ items: [{ name: "cam1", source: "rtsp://192.168.1.100/stream" }] }) })
    })
    await page.route("**/api/mediamtx/v3/paths/list**", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ items: [{ name: "cam1", source: { type: "rtsp" }, tracks: ["video"], readers: 1, bytesReceived: 1024, bytesSent: 512 }] }) })
    })
    await page.route("**/api/mediamtx/v3/config/pathdefaults/get**", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({}) })
    })

    await page.goto("/")
    await page.getByText("Ghi hình").click()
    await expect(page.getByText("Trạng thái ghi hình")).toBeVisible()
  })
})

test.describe("Playback", () => {
  test("shows playback page", async ({ page }) => {
    await page.route("**/api/auth/me", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ username: "admin", permissions: ["api", "playback"] }) })
    })
    await page.route("**/api/mediamtx/v3/config/paths/list**", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ items: [{ name: "cam1" }] }) })
    })

    await page.goto("/")
    await page.getByText("Ghi hình").click()
    await expect(page.getByText("Playback bản ghi")).toBeVisible()
  })
})
