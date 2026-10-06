import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { format, resolveConfig } from 'prettier';

const root = new URL('../src/theme/', import.meta.url);
const { light, dark } = JSON.parse(readFileSync(new URL('theme-values.json', root), 'utf8'));
const map = (theme) =>
  Object.entries(theme)
    .map(([name, value]) => `  '${name}': ${JSON.stringify(value)},`)
    .join('\n');
const changedDark = Object.fromEntries(
  Object.entries(dark).filter(([name, value]) => light[name] !== value),
);
const ids = Object.fromEntries(Object.keys(light).map((name, index) => [name, String(index)]));
const style = `// Generated from theme-values.json by tools/generate-theme-styles.mjs.
@use 'sass:map';
$ids: (
${Object.entries(ids)
  .map(([name, id]) => `  '${name}': ${id},`)
  .join('\n')}
);
$light: (
${map(light)}
);
$dark: (
${map(changedDark)}
);
@function token($name) {
  @if not map.has-key($ids, $name) { @error 'Unknown Tessera token: #{$name}'; }
  @return var(--_t-#{map.get($ids, $name)});
}
@mixin defaults($names: map.keys($light)) {
  :host {
    @each $name in $names {
      @if not map.has-key($light, $name) { @error 'Unknown Tessera token: #{$name}'; }
      --_t-#{map.get($ids, $name)}: var(--t-#{$name}, #{map.get($light, $name)});
    }
  }
  @media (prefers-color-scheme: dark) {
    :host {
      @each $name in $names {
        @if map.has-key($dark, $name) {
          --_t-#{map.get($ids, $name)}: var(--t-#{$name}, #{map.get($dark, $name)});
        }
      }
    }
  }
}
`;
mkdirSync(fileURLToPath(new URL('styles/', root)), { recursive: true });
const options = await resolveConfig(fileURLToPath(new URL('styles/_tokens.scss', root)));
writeFileSync(
  new URL('styles/_tokens.scss', root),
  await format(style, { ...options, parser: 'scss' }),
);
const types = `// Generated from theme-values.json by tools/generate-theme-styles.mjs.\n/** Supported semantic design decisions, expressed as CSS strings. */\nexport interface Theme {\n${Object.keys(
  light,
)
  .map((name) => `  readonly ${name}: string;`)
  .join('\n')}\n}\n`;
writeFileSync(
  new URL('theme-types.ts', root),
  await format(types, { ...options, parser: 'typescript' }),
);
