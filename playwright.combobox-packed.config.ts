import { defineConfig, devices } from '@playwright/test';
import { resolve } from 'node:path';
export default defineConfig({
  testDir: './test/e2e',
  testMatch: 'combobox-packed.spec.ts',
  workers: 1,
  use: { baseURL: 'http://localhost:4220', trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `node "${resolve('node_modules/@angular/cli/bin/ng.js')}" serve consumer --port 4220`,
    cwd: resolve('.angular/combobox-packed-consumer'),
    url: 'http://localhost:4220',
    timeout: 120000,
  },
});
