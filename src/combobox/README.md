# @tessera/combobox

Browser-only, standalone Angular multi-select combobox. It searches a consumer-supplied Observable source, keeps selected values as removable chips, and supports Angular forms or a two-way signal model. Requires Angular 22.2 and CDK 22.2.1 or a compatible version in the package's peer ranges.

```ts
import { Component } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { Combobox, ComboboxSearchFn } from '@tessera/combobox';
import { of } from 'rxjs';

@Component({
  imports: [Combobox, ReactiveFormsModule],
  template: `
    <label for="learners">Learners</label>
    <t-combobox
      inputId="learners"
      [searchFn]="search"
      [formControl]="learners"
      hint="Search by name."
    />
  `,
})
export class LearnerPicker {
  readonly learners = new FormControl<string[]>([], {
    nonNullable: true,
    validators: Validators.required,
  });
  readonly search: ComboboxSearchFn<string> = (query, page) =>
    of({
      items:
        page === 0
          ? ['Ada', 'Grace'].filter((name) => name.toLowerCase().includes(query.toLowerCase()))
          : [],
      hasMore: false,
    });
}
```

Always supply a visible `<label for>` matching `inputId`, or an `ariaLabel`. The default input id is unique per instance; supply an explicit id when using an external label. An unnamed field reports a development-time integration error. Omitting `searchFn` produces Angular NG0950 when its required signal is read; strict templates also diagnose missing required inputs.

## Inputs and outputs

| Input                 | Default       | Meaning                                                                |
| --------------------- | ------------- | ---------------------------------------------------------------------- |
| `searchFn`            | required      | `(query: string, page: number) => Observable<ComboboxPage<T>>`         |
| `value`               | `[]`          | `T[]` model; use `[(value)]` without forms                             |
| `displayWith`         | `String`      | Item to plain label text                                               |
| `compareWith`         | `Object.is`   | Selection identity comparison                                          |
| `optionDisabled`      | `() => false` | Disables activation of an item                                         |
| `placeholder`         | `''`          | Input placeholder; supply a label separately                           |
| `debounceMs`          | `300`         | Finite, non-negative search delay                                      |
| `minSearchLength`     | `1`           | Non-negative integer; zero searches empty text on opening              |
| `maxSelections`       | `null`        | Non-negative integer limit, or unlimited                               |
| `clearSearchOnSelect` | `false`       | Clears text after adding a value                                       |
| `disabled`            | `false`       | Disables input and every action; cancels requests                      |
| `required`            | `false`       | Required semantics; local validation without forms                     |
| `ariaLabel`           | `null`        | Accessible name when there is no visible label                         |
| `inputId`             | generated     | Id of the actual input                                                 |
| `hint`                | `''`          | Description below the field                                            |
| `error`               | `''`          | Touched-invalid error; empty required values use the localized default |

`opened` and `closed` emit once per transition. `searchChange: string` emits once per committed text change, including below-minimum text. `selectionChange: ComboboxSelectionChange<T>` emits `{added?, removed?, value}` once for each user change. Clear-all supplies only `value: []`. Programmatic writes emit no selection event. The model also provides Angular's `valueChange` output.

Invalid configuration reports `Combobox: invalid debounceMs`, `Combobox: invalid minSearchLength`, or `Combobox: invalid maxSelections` through Angular's error handler. Fix the input before using the component.

## Search and selection

`ComboboxPage<T>` contains `items: T[]`, `hasMore: boolean`, and optional `total: number`. Pages start at zero. The first Observable emission is consumed; synchronous throws, errors and empty completion become recoverable errors. Retry repeats the failed query and page. A successful unchanged query is reused; there is no per-query cache. Changing the source or search configuration invalidates results.

Any edit immediately unsubscribes the preceding request, before the next debounce. IME composition suppresses searches until composition ends. Previous options remain during replacement loading. Responses received after close can update stored results but do not reopen the panel or announce. Scrolling to the list end, arrowing past the last option, and Load more results append a page. An empty page never starts an automatic request loop. `total` supplies option set-size and position semantics; absent total produces neither attribute.

For objects, supply `displayWith` and `compareWith`. Selected objects remain available even when absent from results. Limits block additions while allowing deselection; external values exceeding the limit are preserved.

Reactive forms, template-driven `[(ngModel)]`, and `[(value)]` are supported. Null form writes normalize to `[]`. User changes honor `updateOn: 'blur'` or `'submit'`. Focus movement within chips, input, and popup is internal; genuine exit marks touched. With both a form control and a model, the latest external array write wins without making the control dirty or echoing a selection event. Supply new arrays when writing the model. Angular validators supply form errors; the component detects `Validators.required` and presents touched-invalid errors. For other validators, supply the `error` text.

## Content slots and localization

Import `ComboboxOptionTemplate`, `ComboboxChipTemplate` and `ComboboxEmptyTemplate` alongside `Combobox` to use the corresponding directives:

```html
<t-combobox [searchFn]="search" [displayWith]="label" ariaLabel="Learners">
  <ng-template tComboboxOption let-item let-selected="selected" let-active="active">
    <span>{{ item.name }}</span>
  </ng-template>
  <ng-template tComboboxChip let-item><strong>{{ item.name }}</strong></ng-template>
  <ng-template tComboboxEmpty let-query="query">No learners match {{ query }}</ng-template>
</t-combobox>
```

The exported contexts are `ComboboxOptionContext<T>`, `ComboboxChipContext<T>` and `ComboboxEmptyContext`. Templates supply non-interactive content only. Do not nest controls or links, supply conflicting roles, or replace component interaction with event handlers. The component owns option roles, generated ids, selection semantics, decorative checkboxes, and chip removal.

Provide `{provide: COMBOBOX_I18N, useValue: {noResults: 'Sin resultados', removeChip: 'Quitar {label}'}}` at application, route or component scope. `ComboboxStrings` describes every owned string; `DEFAULT_COMBOBOX_STRINGS` exposes the complete English defaults. Partial overrides retain other defaults. `{label}`, `{n}`, `{max}`, `{min}` and `{labels}` are substituted literally in one pass. Singular and plural keys support one versus other; there is no ICU parser. Recreate the component with new providers to change locale. Consumer labels, placeholder, hint, error and template content remain consumer-owned.

## Keyboard and accessibility

| Key                                          | Behavior                                                                                                               |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Arrow Down / Arrow Up                        | Open; navigate without wrapping. Arrow Up opening activates the last option                                            |
| Alt+Arrow Down / Alt+Arrow Up                | Open with no active option / close                                                                                     |
| Enter                                        | Open: toggle enabled active option, Retry on error, or load more with no active option. Closed: native form submission |
| Space                                        | Toggle after explicit option navigation; otherwise edit text. Text/cursor changes reset this intent                    |
| Page Down / Page Up                          | Move by fully visible rows; Page Down at the last option can load the next page                                        |
| Home / End                                   | Native text cursor movement                                                                                            |
| Escape                                       | Dismiss full-label tooltip, then popup, then non-empty query; propagate only when closed and empty                     |
| Tab / Shift+Tab                              | Close and follow normal focus order                                                                                    |
| Backspace with empty input                   | Remove the last chip                                                                                                   |
| Previous-direction arrow at input start      | Focus the last chip; Left in LTR, Right in RTL                                                                         |
| Arrows on a chip                             | Move among chips and back to input; mirrored in RTL                                                                    |
| Enter / Space / Backspace / Delete on a chip | Remove it and focus the next surviving chip, previous chip, or input                                                   |

Input focus stays put during option navigation and selection. Active and selected state are separate. Disabled options can be read through arrow navigation. The component owns one live region; search messages coalesce for 150 ms and queued selection messages keep their order. Slow requests announce after one second. Hints, errors and selected-value summaries are descriptions of the input.

The list uses a CDK inline popover in the browser top layer to retain reading order and avoid ancestor clipping. The non-popover fallback has a scoped container inside a native dialog; inline reading order is unavailable in that fallback. Very short viewports anchor vertically to the input row, with the field's full width. Chips wrap in a bounded vertical scroll area. Ellipsized labels retain their full text and removal name and show dismissible, hoverable tooltips. Options wrap without truncation.

Light/dark defaults, forced colors, reduced motion, RTL, 24 CSS px targets, narrow reflow, 200% text and text spacing have automated coverage. Override `--t-combobox-*` theme tokens while preserving contrast. The palette, state and layout tokens are listed in the [presentation design](../../docs/detailed-designs/combobox/present-accessibly/README.md).

The multi-select extension to the editable combobox pattern requires manual assistive-technology verification. Automated axe results do not certify compatibility. Manual screen reader observations, real touch keyboards, and actual 400% browser zoom are **Not run**; see the [release matrix](../../docs/verification/combobox-screen-reader-matrix.md).

## Consumer testing and examples

Import `ComboboxHarness` and `ComboboxOptionState` from `@tessera/combobox`; no secondary entry point is needed. Its methods are `open`, `isOpen`, `search`, `getOptions`, `toggleOption(labelOrIndex)`, `getChips`, and `removeChip(labelOrIndex)`. Missing items reject with a descriptive error. Search timing follows the harness environment; explicitly advance fake time or await real results, using CDK `manualChangeDetection` for timing-sensitive TestBed tests.

The [five runnable examples](../components-examples/tessera/combobox/combobox-examples.ts) demonstrate reactive forms, template forms, the model, custom content and paging. Run `pnpm start` for the dev app. The acceptance app exposes the same examples at `/?screen=combobox-examples`.

All built-in data rendering is text. The host owns template markup, authentication, authorization, transport encoding and data access. The package persists no learner data and sends no telemetry.

Release definition of done: all L2-022–L2-050 acceptance criteria pass, axe reports zero violations, the manual matrix is signed off, packed-package adoption works, performance thresholds pass, and zoneless operation is verified. Implementation evidence lives in [the verification record](../../docs/verification/combobox-implementation.md).

## Shared design tokens

Install `@tessera/theme` alongside this package. Both Tessera components share semantic `--t-<tokenName>` properties and typed light/dark themes. See the [theme API and adoption guide](../theme/README.md). Existing `--t-combobox-*` properties override the shared theme on either a container or the component host. Detached popups and tooltips track ancestor style/class and system media changes while open. Arbitrary stylesheet replacements take effect on the next opening.
