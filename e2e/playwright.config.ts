import { defineConfig } from '@playwright/test';

// Default target: local stack via docker compose (http://localhost:8080).
// Override with THOTH_BASE_URL to point at another environment.
const baseURL = process.env.THOTH_BASE_URL ?? 'http://localhost:8080';

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: true,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL,
    trace: 'on-first-retry',
    ignoreHTTPSErrors: true,
  },
});
