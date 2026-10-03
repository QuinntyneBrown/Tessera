import { ChangeDetectionStrategy, Component, DestroyRef, inject, input } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, debounce, switchMap, take, timer } from 'rxjs';
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
  private readonly queries = new Subject<string>();

  constructor() {
    this.queries
      .pipe(
        debounce(() => timer(300)),
        switchMap((query) => this.searchFn()(query, 0).pipe(take(1))),
        takeUntilDestroyed(inject(DestroyRef)),
      )
      .subscribe();
  }

  protected onInput(event: Event): void {
    this.queries.next((event.target as HTMLInputElement).value);
  }
}
