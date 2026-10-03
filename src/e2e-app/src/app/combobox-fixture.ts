import { Component } from '@angular/core';
import { Combobox } from '@tessera/combobox';
import { of } from 'rxjs';

/** Production-component host; scenario configuration grows with each acceptance slice. */
@Component({
  selector: 'tsr-combobox-fixture',
  imports: [Combobox],
  template: `
    <main>
      <h1>Assign learners</h1>
      <label for="learners">Learners</label>
      <t-combobox inputId="learners" [searchFn]="search" />
    </main>
  `,
})
export class ComboboxFixture {
  readonly search = () => of({ items: [] as string[], hasMore: false });
}
