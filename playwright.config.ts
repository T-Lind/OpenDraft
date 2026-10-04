import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI
    ? [['github'], ['html', { open: 'never' }]]
    : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:5173',
    browserName: 'chromium',
    viewport: { width: 1440, height: 1000 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'], viewport: { width:1440,height:1000 } } },
    { name: 'android-chromium', use: { ...devices['Pixel 7'], browserName:'chromium' } },
    { name: 'ios-webkit', use: { ...devices['iPhone 13'], browserName:'webkit' } },
  ],
  webServer: {
    command: 'npx next dev --hostname 127.0.0.1 --port 5173',
    url: 'http://localhost:5173/api/workshop',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      ...process.env,
      NODE_ENV: 'development',
      SOURCE_REPOSITORY_URL: 'https://github.com/T-Lind/OpenDraft',
    },
  },
});
