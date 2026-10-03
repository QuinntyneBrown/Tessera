import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { ComboboxSearchFn } from './types';

let nextInstance = 0;

/** Browser-only multi-selection control. Implemented in acceptance-tested slices. */
@Component({
  selector: 't-combobox',
  templateUrl: './combobox.html',
  styleUrl: './combobox.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Combobox<T> {
  readonly searchFn = input.required<ComboboxSearchFn<T>>();
  readonly inputId = input(`t-combobox-${++nextInstance}-input`);
  readonly ariaLabel = input<string | null>(null);
}
