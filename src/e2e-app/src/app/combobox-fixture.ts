import { Component, signal } from '@angular/core';
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
      <ul aria-label="Search requests">
        @for (request of requests(); track $index) {
          <li>{{ request }}</li>
        }
      </ul>
    </main>
  `,
})
export class ComboboxFixture {
  readonly requests = signal<string[]>([]);
  readonly search = (query: string, page: number) => {
    console.info(`combobox-fixture-request:${query}:${page}`);
    this.requests.update((requests) => [...requests, `${query}:${page}`]);
    return of({ items: [] as string[], hasMore: false });
  };
}
