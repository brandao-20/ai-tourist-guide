import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8080';
const serverUrl = new URL(baseURL);
const serverHost = serverUrl.hostname || '127.0.0.1';
const serverPort = serverUrl.port || (serverUrl.protocol === 'https:' ? '443' : '80');
const chromiumExecutablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || '';

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  use: {
    baseURL,
    trace: 'on-first-retry',
    launchOptions: chromiumExecutablePath ? { executablePath: chromiumExecutablePath, args: ['--no-sandbox', '--disable-dev-shm-usage'] } : undefined,
  },
  webServer: process.env.PLAYWRIGHT_SKIP_WEBSERVER ? undefined : {
    command: `npm --prefix frontend start -- --host ${serverHost} --port ${serverPort}`,
    url: baseURL,
    reuseExistingServer: true,
    timeout: 120_000,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});
