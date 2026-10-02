// Records the demo, then inspects and (unless --stage-only) publishes it. See docs/demo/README.md.
import { spawnSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const stageOnly = process.argv.includes('--stage-only');

function run(command, args) {
  const result = spawnSync(command, args, { cwd: root, stdio: 'inherit', shell: false });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

// Start from a clean staging area so an old take can never be mistaken for this one.
rmSync(join(root, 'demo', '.run'), { recursive: true, force: true });
rmSync(join(root, 'test-results', 'demo'), { recursive: true, force: true });

run('node', ['./node_modules/@playwright/test/cli.js', 'test', '-c', 'demo/playwright.config.ts']);
run('node', ['demo/finalize.mjs', 'stage']);
if (!stageOnly) run('node', ['demo/finalize.mjs', 'promote']);
