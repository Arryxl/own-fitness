import { defineConfig, devices } from "@playwright/test";

// End-to-end tests run against the Firebase emulators (auth + firestore) with
// a fake AI (AI_FAKE=1): nothing touches the real project or Gemini.
//   npm run test:e2e
const PORT = 3300;
const baseURL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "e2e",
  timeout: 240_000,
  expect: { timeout: 30_000 },
  workers: 1,
  use: { baseURL, locale: "es-CO", screenshot: "only-on-failure", ...devices["Pixel 7"] },
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: `npx next dev -p ${PORT}`,
        url: baseURL,
        timeout: 240_000,
        reuseExistingServer: false,
        env: {
          NEXT_PUBLIC_USE_EMULATORS: "1",
          NEXT_PUBLIC_FIREBASE_PROJECT_ID: "demo-ironlog",
          NEXT_PUBLIC_FIREBASE_API_KEY: "demo-key",
          NEXT_PUBLIC_FIREBASE_APP_ID: "demo-app",
          NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "demo-ironlog.firebaseapp.com",
          FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080",
          FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:9099",
          FIREBASE_SERVICE_ACCOUNT: "",
          GEMINI_TIER: "free",
          AI_FAKE: "1",
          AI_DAILY_MESSAGES: "2",
          ADMIN_EMAILS: "",
        },
      },
});
