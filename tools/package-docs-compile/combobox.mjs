import { readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';

/** Compile the shipped snippets as part of the separate packed-package consumer build. */
export function includeComboboxDocumentation(consumer) {
  const readme = readFileSync(
    join(consumer, 'node_modules', '@tessera', 'combobox', 'README.md'),
    'utf8',
  );
  const typescript = /```ts\r?\n([\s\S]*?)\r?\n```/.exec(readme)?.[1];
  const html = /```html\r?\n([\s\S]*?)\r?\n```/.exec(readme)?.[1];
  if (!typescript || !html) throw new Error('Combobox README adoption snippets are missing.');
  writeFileSync(join(consumer, 'combobox-doc-ts.ts'), typescript);
  writeFileSync(
    join(consumer, 'combobox-doc-html.ts'),
    `
import { Component } from '@angular/core';
import { Combobox, ComboboxSearchFn, ComboboxOptionTemplate, ComboboxChipTemplate, ComboboxEmptyTemplate } from '@tessera/combobox';
import { of } from 'rxjs';
@Component({
  imports: [Combobox, ComboboxOptionTemplate, ComboboxChipTemplate, ComboboxEmptyTemplate],
  template: ${JSON.stringify(html)}
})
export class ReadmeContentSlots {
  readonly search: ComboboxSearchFn<{name: string}> = () => of({items: [{name: 'Ada'}], hasMore: false});
  readonly label = (item: {name: string}) => item.name;
}
`,
  );
  appendFileSync(
    join(consumer, 'main.ts'),
    "\nimport './combobox-doc-ts';\nimport './combobox-doc-html';\n",
  );
}
