import { defineConfig } from "vitest/config"
import react from "@vitejs/plugin-react"
import path from "path"

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./scripts/test-setup.ts"],
    include: ["scripts/**/*.test.{ts,tsx}"],
    exclude: ["node_modules", ".next"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname),
    },
  },
})
