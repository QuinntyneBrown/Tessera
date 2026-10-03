import { Component, signal } from '@angular/core';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  Combobox,
  ComboboxChipTemplate,
  ComboboxEmptyTemplate,
  ComboboxOptionTemplate,
} from '@tessera/combobox';
import { EXAMPLE_LEARNERS, ExampleLearner, createMockUserSearch } from './mock-user-search';

/** Runnable adoption examples shared by the dev app and acceptance screen. */
@Component({
  selector: 'tsr-combobox-examples',
  imports: [
    Combobox,
    ComboboxChipTemplate,
    ComboboxEmptyTemplate,
    ComboboxOptionTemplate,
    FormsModule,
    ReactiveFormsModule,
  ],
  styles: [
    'main {max-width: 42rem; margin: 1rem auto; padding: 1rem;} section {margin-block: 2rem;} label, output {display: block; margin-block: .5rem;}',
  ],
  template: `
    <main>
      <h1>Combobox examples</h1>
      <section>
        <h2>Reactive forms</h2>
        <label for="reactive-learners">Reactive learners</label>
        <t-combobox
          inputId="reactive-learners"
          [searchFn]="search"
          [displayWith]="display"
          [compareWith]="compare"
          [formControl]="control"
          hint="Search by learner name."
        />
        <output aria-label="Reactive value">{{ labels(reactiveValue()) }}</output>
      </section>
      <section>
        <h2>Template-driven forms</h2>
        <form (submit)="$event.preventDefault()">
          <label for="template-learners">Template learners</label>
          <t-combobox
            inputId="template-learners"
            name="learners"
            [searchFn]="search"
            [displayWith]="display"
            [compareWith]="compare"
            [(ngModel)]="templateValue"
          />
        </form>
        <output aria-label="Template value">{{ labels(templateValue()) }}</output>
      </section>
      <section>
        <h2>Two-way model</h2>
        <label for="model-learners">Model learners</label>
        <t-combobox
          inputId="model-learners"
          [searchFn]="search"
          [displayWith]="display"
          [compareWith]="compare"
          [(value)]="modelValue"
        />
        <output aria-label="Model value">{{ labels(modelValue()) }}</output>
      </section>
      <section>
        <h2>Custom content</h2>
        <label for="custom-learners">Custom learners</label>
        <t-combobox
          inputId="custom-learners"
          [searchFn]="search"
          [displayWith]="display"
          [compareWith]="compare"
          [(value)]="customValue"
        >
          <ng-template tComboboxOption let-item let-active="active" let-selected="selected"
            ><span
              >{{ item.name }} <small>({{ item.team }})</small></span
            ></ng-template
          >
          <ng-template tComboboxChip let-item
            ><strong>{{ item.name }}</strong></ng-template
          >
          <ng-template tComboboxEmpty let-query="query"
            ><span>No learners match {{ query }}</span></ng-template
          >
        </t-combobox>
      </section>
      <section>
        <h2>Paging</h2>
        <label for="paging-learners">Paging learners</label>
        <t-combobox
          inputId="paging-learners"
          [searchFn]="pagedSearch"
          [displayWith]="display"
          [compareWith]="compare"
          [(value)]="pagingValue"
          hint="Use Load more results or arrow past the last option."
        />
      </section>
    </main>
  `,
})
export class ComboboxExamples {
  readonly search = createMockUserSearch();
  readonly pagedSearch = createMockUserSearch(3);
  readonly display = (item: ExampleLearner) => item.name;
  readonly compare = (a: ExampleLearner, b: ExampleLearner) => a.id === b.id;
  readonly control = new FormControl<ExampleLearner[]>([], { nonNullable: true });
  readonly reactiveValue = toSignal(this.control.valueChanges, {
    initialValue: this.control.value,
  });
  readonly templateValue = signal<ExampleLearner[]>([]);
  readonly modelValue = signal<ExampleLearner[]>([]);
  readonly customValue = signal([EXAMPLE_LEARNERS[0]]);
  readonly pagingValue = signal<ExampleLearner[]>([]);
  labels(items: ExampleLearner[]): string {
    return items.map(this.display).join(', ');
  }
}
