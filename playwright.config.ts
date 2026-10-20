import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;
const isCI = Boolean(process.env.CI);

/**
 * End-to-end tests run against the production build (Express serving the built SPA),
 * with a separate SQLite file and the JSON email transport, so nothing is really sent.
 * Locally they use the installed Google Chrome; CI installs Playwright's Chromium.
 */
export default defineConfig({
  testDir: "./e2e",
  workers: 1,
  retries: isCI ? 1 : 0,
  reporter: isCI ? [["github"], ["list"]] : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    channel: isCI ? undefined : "chrome",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], channel: isCI ? undefined : "chrome" }, testIgnore: /mobile/ },
    { name: "mobile", use: { ...devices["Pixel 7"], channel: isCI ? undefined : "chrome" }, testMatch: /mobile/ },
  ],
  webServer: {
    command: "npm run build && node apps/api/dist/index.mjs",
    url: `http://localhost:${PORT}/api/health`,
    reuseExistingServer: !isCI,
    timeout: 180_000,
    env: {
      PORT: String(PORT),
      DATABASE_PATH: "./data/e2e.db",
      EMAIL_MODE: "json",
      NODE_ENV: "production",
    },
  },
});
