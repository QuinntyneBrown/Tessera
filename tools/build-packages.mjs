// Builds the ZIP packages used by the e2e suite from the fixture courses (and a few deliberately broken ones).
import { zipSync, strToU8 } from 'fflate';
import { randomFillSync } from 'node:crypto';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const fixtures = fileURLToPath(new URL('../test/fixtures/courses', import.meta.url));
const out = fileURLToPath(new URL('../dist/packages', import.meta.url));

async function folder(name) {
  const files = {};
  for (const file of await readdir(join(fixtures, name))) {
    files[file] = new Uint8Array(await readFile(join(fixtures, name, file)));
  }
  return files;
}

const good = await folder('single-sco-12');
const { 'sco.html': _launchPage, ...withoutLaunchPage } = good;

/** About 56 MB once compressed: 64 files of 1 MB drawn from 128 symbols, so inflating takes noticeable time. */
function largeCourse() {
  const files = { ...good };
  for (let i = 0; i < 64; i++) {
    const bytes = new Uint8Array(1024 * 1024);
    randomFillSync(bytes);
    for (let j = 0; j < bytes.length; j++) bytes[j] = (bytes[j] & 127) + 32;
    files[`data/${i}.bin`] = bytes;
  }
  return files;
}

const packages = {
  'single-sco-12': good,
  'single-sco-2004-2nd': await folder('single-sco-2004-2nd'),
  'single-sco-2004-3rd': await folder('single-sco-2004-3rd'),
  'single-sco-2004-4th': await folder('single-sco-2004-4th'),
  'no-manifest': { 'sco.html': good['sco.html'] },
  'traversal-entry': { ...good, '../evil.html': strToU8('<p>escaped</p>') },
  'missing-launch': withoutLaunchPage,
  'not-a-zip': undefined,
  'many-entries': {
    ...good,
    ...Object.fromEntries(Array.from({ length: 20 }, (_, i) => [`extra/${i}.txt`, strToU8('x')])),
  },
  'large-50mb': largeCourse(),
  'large-expanded': { ...good, 'padding.bin': new Uint8Array(2 * 1024 * 1024) },
};

await mkdir(out, { recursive: true });
for (const [name, files] of Object.entries(packages)) {
  await writeFile(
    join(out, `${name}.zip`),
    files ? zipSync(files, { level: 1 }) : strToU8('this is not a zip archive'),
  );
}
