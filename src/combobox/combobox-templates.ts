import { Directive, TemplateRef, inject } from '@angular/core';

/** Content context for a result option. */
export interface ComboboxOptionContext<T> {
  $implicit: T;
  selected: boolean;
  active: boolean;
}
/** Content context for a selected chip. */
export interface ComboboxChipContext<T> {
  $implicit: T;
}
/** Content context for an empty search result. */
export interface ComboboxEmptyContext {
  query: string;
}

/** Non-interactive content inside the component-owned option host. */
@Directive({ selector: 'ng-template[tComboboxOption]' })
export class ComboboxOptionTemplate<T> {
  readonly template = inject<TemplateRef<ComboboxOptionContext<T>>>(TemplateRef);
  static ngTemplateContextGuard<T>(
    _directive: ComboboxOptionTemplate<T>,
    context: unknown,
  ): context is ComboboxOptionContext<T> {
    return true;
  }
}

/** Non-interactive chip content; removal remains owned by the component. */
@Directive({ selector: 'ng-template[tComboboxChip]' })
export class ComboboxChipTemplate<T> {
  readonly template = inject<TemplateRef<ComboboxChipContext<T>>>(TemplateRef);
  static ngTemplateContextGuard<T>(
    _directive: ComboboxChipTemplate<T>,
    context: unknown,
  ): context is ComboboxChipContext<T> {
    return true;
  }
}

/** Content shown when the current search has no results. */
@Directive({ selector: 'ng-template[tComboboxEmpty]' })
export class ComboboxEmptyTemplate {
  readonly template = inject<TemplateRef<ComboboxEmptyContext>>(TemplateRef);
  static ngTemplateContextGuard(
    _directive: ComboboxEmptyTemplate,
    context: unknown,
  ): context is ComboboxEmptyContext {
    return true;
  }
}
