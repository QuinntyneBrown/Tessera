// Builds the ZIP packages used by the e2e suite from the fixture courses (and a few deliberately broken ones).
import { zipSync, strToU8 } from 'fflate';
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

const packages = {
  'single-sco-12': await folder('single-sco-12'),
};

await mkdir(out, { recursive: true });
for (const [name, files] of Object.entries(packages)) {
  await writeFile(join(out, `${name}.zip`), zipSync(files));
}
