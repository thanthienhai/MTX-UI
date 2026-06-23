import { test, expect } from "@playwright/test"

test.describe("Login flow", () => {
  test("shows login page and allows authentication", async ({ page }) => {
    // Mock the auth endpoints
    await page.route("**/api/auth/me", async (route) => {
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ error: "Unauthorized" }),
      })
    })

    await page.goto("/")

    // Should redirect to login
    await expect(page).toHaveURL(/\/login/)
    await expect(page.getByText("Bảng điều khiển MediaMTX")).toBeVisible()
  })

  test("shows error on invalid credentials", async ({ page }) => {
    await page.goto("/login")

    await page.route("**/api/auth/login", async (route) => {
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ error: "Invalid credentials" }),
      })
    })

    await page.fill('input[type="text"]', "admin")
    await page.fill('input[type="password"]', "wrong")
    await page.click('button:has-text("Đăng nhập")')

    await expect(page.getByText(/invalid/i)).toBeVisible()
  })

  test("navigates to dashboard on successful login", async ({ page }) => {
    await page.goto("/login")

    await page.route("**/api/auth/login", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ username: "admin", permissions: ["api", "metrics"] }),
      })
    })

    await page.route("**/api/auth/me", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ username: "admin", permissions: ["api", "metrics"] }),
      })
    })

    await page.fill('input[type="text"]', "admin")
    await page.fill('input[type="password"]', "password")
    await page.click('button:has-text("Đăng nhập")')

    await expect(page.getByText("MediaMTX Dashboard")).toBeVisible()
  })
})
