import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, symlinkSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { includeComboboxDocumentation } from './package-docs-compile/combobox.mjs';

const workspace = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const consumer = join(workspace, '.angular', 'combobox-packed-consumer');
mkdirSync(consumer, { recursive: true });
cpSync(join(workspace, 'test', 'fixtures', 'combobox-consumer'), consumer, { recursive: true });
const modules = join(consumer, 'node_modules');
mkdirSync(modules, { recursive: true });
for (const name of ['@angular', '@types', 'rxjs', 'tslib', 'typescript']) {
  const target = join(modules, name);
  if (!existsSync(target))
    symlinkSync(
      join(workspace, 'node_modules', name),
      target,
      process.platform === 'win32' ? 'junction' : 'dir',
    );
}
const installed = join(modules, '@tessera', 'combobox');
mkdirSync(installed, { recursive: true });
execFileSync(
  'tar',
  [
    '-xzf',
    join(workspace, 'dist', 'packages', 'tessera-combobox-0.0.1.tgz'),
    '--strip-components=1',
    '-C',
    installed,
  ],
  { stdio: 'inherit' },
);
// The package itself is installed from its tarball. Peers reuse pinned workspace dependencies.
// This host has no Tessera source aliases and runs Angular's strict template compiler.
includeComboboxDocumentation(consumer);
execFileSync(
  process.execPath,
  [
    join(workspace, 'node_modules', '@playwright', 'test', 'cli.js'),
    'test',
    '--config=playwright.combobox-packed.config.ts',
  ],
  { cwd: workspace, stdio: 'inherit' },
);
