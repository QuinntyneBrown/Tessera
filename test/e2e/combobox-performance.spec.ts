// Acceptance tests. Traces to L2-022, L2-045, L2-046, L2-048.
import { test } from '@playwright/test';
import { cpus, platform, release, totalmem } from 'node:os';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { writeFile } from 'node:fs/promises';
import { ComboboxDemoPage } from './pages/combobox-demo-page';

const testRequire = createRequire(process.cwd() + '/package.json');
const revision = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const dirty = !!execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim();

test.describe.configure({ mode: 'serial' });
test.setTimeout(180000);

test('ten characters 50ms apart cause exactly one default-debounce request', async ({ page }) => {
  // L2-045 AC2: Given a typing burst, one request follows the final pause.
  const box = new ComboboxDemoPage(page);
  await box.open();
  await box.typeBurst();
  await box.expectNoAccessibilityViolations();
});

for (const kind of ['typing', 'rendering', 'toggling', 'navigation'] as const) {
  test(`meets 95 of 100 ${kind} render-latency samples`, async ({ page, browser }, info) => {
    // L2-045 AC1/3/4/5: After ten warm-ups, at least 95 of 100 samples meet the requirement's limit.
    const box = new ComboboxDemoPage(page);
    await box.open(
      {
        performance: true,
        results: 'normal',
        debounceMs: kind === 'typing' ? 300 : 0,
        responseDelay: kind === 'typing' ? 5000 : 0,
        pageSize: 50,
        pageCount: kind === 'navigation' ? 5 : 1,
        ...(kind === 'toggling' ? { valueSize: 200 } : {}),
      },
      true,
    );
    const durations =
      kind === 'typing'
        ? await box.measureTyping()
        : kind === 'rendering'
          ? await box.measureRendering()
          : kind === 'toggling'
            ? await box.measureToggling()
            : await box.measureNavigation();
    const metricsPath = info.outputPath(`${kind}-timings.json`);
    await writeFile(
      metricsPath,
      JSON.stringify(
        {
          date: new Date().toISOString(),
          platform: platform(),
          os: release(),
          cpu: cpus()[0].model,
          ram: totalmem(),
          node: process.version,
          playwright: testRequire('@playwright/test/package.json').version,
          revision,
          dirty,
          powerMode: process.env['TESSERA_PERFORMANCE_POWER_MODE'] || 'Not recorded',
          chromium: browser.version(),
          mode: 'headless Chromium; browser frame opportunity, not certified display latency',
          throttle: ['rendering', 'toggling'].includes(kind) ? 4 : 1,
          durations,
        },
        null,
        2,
      ),
    );
    await info.attach(`${kind}-timings`, {
      contentType: 'application/json',
      path: metricsPath,
    });
    box.expectTimings(durations, ['rendering', 'toggling'].includes(kind) ? 200 : 100);
    await box.expectNoAccessibilityViolations();
  });
}
