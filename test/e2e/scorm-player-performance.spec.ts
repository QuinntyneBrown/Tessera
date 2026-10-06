// Acceptance test. Traces to L2-019 AC1.
import { test } from '@playwright/test';
import { cpus, platform, release, totalmem } from 'node:os';
import { execFileSync } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { PlayerPage } from './pages/player-page';

const revision = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();

test.setTimeout(600_000);

test('shows the player shell and loading status within 2 s in 95 of 100 render-latency samples', async ({
  page,
  browser,
}, info) => {
  // L2-019 AC1: Given an extracted-manifest fixture, a warm bundle and 4x CPU slowdown, the shell
  // and its loading status render within 2 seconds in at least 95 of 100 runs.
  const player = new PlayerPage(page);
  const durations = await player.measureShellRender({ runs: 100, cpuSlowdown: 4 });
  const metricsPath = info.outputPath('player-shell-timings.json');
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
        revision,
        chromium: browser.version(),
        throttle: 4,
        durations,
      },
      null,
      2,
    ),
  );
  await info.attach('player-shell-timings', { contentType: 'application/json', path: metricsPath });
  player.expectShellTimings(durations, { limitMs: 2000, required: 95 });
});
