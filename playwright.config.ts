import { defineConfig } from "@playwright/test"

export default defineConfig({
  testDir: "./e2e",
  timeout: 30000,
  retries: 1,
  use: {
    baseURL: "http://localhost:3000",
    headless: true,
  },
  webServer: {
    command: "npm run build && node .next/standalone/server.js",
    port: 3000,
    timeout: 120000,
    reuseExistingServer: true,
  },
})
