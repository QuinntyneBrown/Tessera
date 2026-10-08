import { defineConfig } from '@playwright/test';

const port = Number(process.env['VIDEO_PLAYER_DEMO_PORT'] || 4331);

/** One continuous recorded take; kept apart from the acceptance suite and its commit gates. */
export default defineConfig({
  testDir: '.',
  testMatch: 'record.story.ts',
  workers: 1,
  fullyParallel: false,
  retries: 0,
  timeout: 10 * 60_000,
  expect: { timeout: 20_000 },
  outputDir: process.env['VIDEO_PLAYER_DEMO_RUN'] + '/capture',
  reporter: 'list',
  use: {
    browserName: 'chromium',
    baseURL: `http://127.0.0.1:${port}`,
    viewport: { width: 1280, height: 720 },
    video: { mode: 'on', size: { width: 1280, height: 720 } },
    launchOptions: { slowMo: 120 },
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    trace: 'retain-on-failure',
  },
  webServer: {
    command: `node ./node_modules/@angular/cli/bin/ng.js serve e2e-app --port ${port} --host 127.0.0.1`,
    cwd: '../..',
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
