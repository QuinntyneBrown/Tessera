import { defineConfig } from '@playwright/test';

// A separate configuration for recording the demo: it never runs as part of the acceptance suite.
export default defineConfig({
  testDir: '.',
  testMatch: '**/*.demo.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 12 * 60_000,
  expect: { timeout: 30_000 },
  outputDir: '../test-results/demo',
  reporter: 'list',
  use: {
    browserName: 'chromium',
    viewport: { width: 1280, height: 720 },
    video: { mode: 'on', size: { width: 1280, height: 720 } },
    launchOptions: { slowMo: 120 },
    actionTimeout: 30_000,
    navigationTimeout: 30_000,
    trace: 'retain-on-failure',
  },
  // Never reuse a server already listening: its identity and data would be unknown.
  webServer: [
    {
      command:
        'node ./node_modules/@angular/cli/bin/ng.js serve dev-app --port 4200 --host localhost',
      cwd: '..',
      url: 'http://localhost:4200',
      reuseExistingServer: false,
      timeout: 180_000,
    },
    {
      command: 'node ./tools/build-wrapper.mjs && node ./tools/course-server.mjs',
      cwd: '..',
      url: 'http://127.0.0.1:4300/courses/multi-sco-12/imsmanifest.xml',
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
});
