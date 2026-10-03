import { defineConfig, devices } from '@playwright/test';

const port = Number(process.env['TESSERA_E2E_PORT'] || 4200);

export default defineConfig({
  testDir: './test/e2e',
  testIgnore: 'combobox-packed.spec.ts',
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 1 : 0,
  reporter: process.env['CI'] ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${port}`,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: `node ./node_modules/@angular/cli/bin/ng.js serve e2e-app --port ${port}`,
      url: `http://localhost:${port}`,
      reuseExistingServer: !process.env['CI'],
      timeout: 120_000,
    },
    {
      command:
        'node ./tools/build-wrapper.mjs && node ./tools/build-packages.mjs && node ./tools/course-server.mjs',
      env: { HOST_ORIGIN: `http://localhost:${port}` },
      url: 'http://127.0.0.1:4300/courses/single-sco-12/imsmanifest.xml',
      reuseExistingServer: !process.env['CI'],
    },
  ],
});
