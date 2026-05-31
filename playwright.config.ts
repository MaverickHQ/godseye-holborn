import { defineConfig, devices, chromium, firefox, webkit } from '@playwright/test';
import fs from 'node:fs';

const blockingProjects = [
  {
    name: 'chromium',
    use: { ...devices['Desktop Chrome'] },
  },
];

const advisoryProjectCandidates = [
  {
    name: 'chromium',
    use: { ...devices['Desktop Chrome'] },
  },
  {
    name: 'firefox',
    use: { ...devices['Desktop Firefox'] },
  },
  {
    name: 'webkit',
    use: { ...devices['Desktop Safari'] },
  },
  {
    name: 'Mobile Chrome',
    use: { ...devices['Pixel 5'] },
  },
  {
    name: 'Mobile Safari',
    use: { ...devices['iPhone 12'] },
  },
];

function isBrowserRuntimeAvailable(name: string): boolean {
  if (name === 'firefox') {
    return fs.existsSync(firefox.executablePath());
  }
  if (name === 'webkit' || name === 'Mobile Safari') {
    return fs.existsSync(webkit.executablePath());
  }
  return fs.existsSync(chromium.executablePath());
}

const advisoryProjects = advisoryProjectCandidates.filter(project =>
  isBrowserRuntimeAvailable(project.name),
);

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://127.0.0.1:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: process.env.PW_ADVISORY_MATRIX === '1' ? advisoryProjects : blockingProjects,
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 3000',
    url: 'http://127.0.0.1:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});
