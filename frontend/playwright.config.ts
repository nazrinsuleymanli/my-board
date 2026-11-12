import { defineConfig, devices } from "@playwright/test";

// Runs against the real backend serving the built frontend, with a throw-away data dir.
export default defineConfig({
  testDir: "./e2e",
  workers: 1,
  timeout: 30_000,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:8765",
    timezoneId: "Europe/Prague",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1400, height: 900 } } },
    { name: "iphone", use: { ...devices["iPhone 13"], browserName: "chromium" }, testMatch: /mobile\.spec/ },
  ],
  webServer: {
    command:
      "rm -rf /tmp/myboard-e2e && cd ../backend && DATA_DIR=/tmp/myboard-e2e STATIC_DIR=../frontend/dist python3 -m uvicorn app.main:app --port 8765",
    url: "http://localhost:8765/api/health",
    reuseExistingServer: false,
    timeout: 30_000,
  },
});
