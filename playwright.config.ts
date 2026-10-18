import { defineConfig, devices } from "@playwright/test";

// E2E runs against the local demo mode (in-browser store, no Firebase needed).
// Set E2E_BASE_URL to reuse a running dev server started with NEXT_PUBLIC_DEMO_MODE=1.
const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3200";

export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  use: { baseURL, locale: "es-CO", screenshot: "only-on-failure", ...devices["Pixel 7"] },
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: "npx next dev -p 3200",
        url: baseURL,
        timeout: 180_000,
        reuseExistingServer: true,
        env: { NEXT_PUBLIC_DEMO_MODE: "1" },
      },
});
