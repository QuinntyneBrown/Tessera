import { Directive, ElementRef, inject, input, signal } from '@angular/core';
import { Highlightable } from '@angular/cdk/a11y';

let nextOptionId = 0;

/** Owns each option's identity, semantics and active indicator. */
@Directive({
  selector: '[tComboboxOptionHost]',
  exportAs: 'tComboboxOptionHost',
  host: {
    role: 'option',
    '[id]': 'id',
    '[attr.aria-selected]': 'selected()',
    '[attr.aria-disabled]': 'disabled',
    '[class.t-combobox-active]': 'active()',
    '[attr.aria-setsize]': 'total()',
    '[attr.aria-posinset]': 'total() === null ? null : position()',
  },
})
export class ComboboxOption implements Highlightable {
  readonly id = `t-combobox-option-${++nextOptionId}`;
  readonly selected = input(false);
  readonly isDisabled = input(false);
  readonly label = input('');
  readonly total = input<number | null>(null);
  readonly position = input(1);
  readonly active = signal(false);
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);
  get disabled(): boolean {
    return this.isDisabled();
  }
  getLabel(): string {
    return this.label();
  }
  setInactiveStyles(): void {
    this.active.set(false);
  }
  setActiveStyles(): void {
    this.active.set(true);
    const element = this.element.nativeElement;
    const list = element.closest<HTMLElement>('[role="listbox"]');
    if (!list) return;
    const row = element.getBoundingClientRect();
    const bounds = list.getBoundingClientRect();
    if (row.top < bounds.top) list.scrollTop -= bounds.top - row.top;
    else if (row.bottom > bounds.bottom) list.scrollTop += row.bottom - bounds.bottom;
  }
}
