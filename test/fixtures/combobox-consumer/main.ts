import { Component, provideZonelessChangeDetection } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import {
  Combobox,
  ComboboxChipTemplate,
  ComboboxOptionTemplate,
  ComboboxEmptyTemplate,
  ComboboxSearchFn,
} from '@tessera/combobox';
import { of } from 'rxjs';

@Component({
  selector: 'packed-root',
  imports: [
    Combobox,
    ComboboxChipTemplate,
    ComboboxOptionTemplate,
    ComboboxEmptyTemplate,
    ReactiveFormsModule,
  ],
  template: `<main>
    <h1>Packed combobox consumer</h1>
    <label for="packed-learners">Packed learners</label>
    <t-combobox
      inputId="packed-learners"
      [searchFn]="search"
      [formControl]="value"
      [displayWith]="label"
    >
      <ng-template tComboboxOption let-item let-selected="selected" let-active="active">
        <span>{{ item.name }}</span>
      </ng-template>
      <ng-template tComboboxChip let-item
        ><strong>{{ item.name }}</strong></ng-template
      >
      <ng-template tComboboxEmpty let-query="query">No learners match {{ query }}</ng-template>
    </t-combobox>
    <output aria-label="Packed value">{{ names() }}</output>
  </main>`,
})
class PackedConsumer {
  readonly value = new FormControl<{ name: string }[]>([], { nonNullable: true });
  readonly label = (item: { name: string }) => item.name;
  readonly search: ComboboxSearchFn<{ name: string }> = () =>
    of({ items: [{ name: 'Ada' }, { name: 'Grace' }], hasMore: false });
  names(): string {
    return this.value.value.map(this.label).join(', ');
  }
}
bootstrapApplication(PackedConsumer, { providers: [provideZonelessChangeDetection()] }).catch(
  console.error,
);
