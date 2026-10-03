# Combobox subsystem

## Overview

`@tessera/combobox` is Tessera's second package. It provides `t-combobox`, a form control that lets a user search a remote data source by typing, select many results from a popup list, and see each selection as a removable chip.

**Combobox** — text input paired with a popup list of options, following the WAI-ARIA 1.2 combobox pattern

**Chip** — removable token that shows one selected value inside the field

**Option** — selectable entry in the popup list

**Live region** — visually hidden element whose text changes assistive technology reads aloud

The component serves data sets too large to load up front, such as assigning users to a course by typing part of a name. It behaves as an Angular form control and is fully operable by keyboard and screen reader. The consuming application supplies a visible label and a `searchFn`; the component supplies every other accessibility behavior.

The requirements are in [L1](../../specs/L1.md) (`L1-009` to `L1-018`) and [L2](../../specs/L2.md) (`L2-022` to `L2-050`). The source product requirements document is `multi-select-combobox-prd.md`.

## Description

Ten vertical features cover the full L2 requirement set for the combobox:

| Feature | Capability |
|---------|------------|
| [Search options](search-options/) | `L2-022`, `L2-023`, `L2-024`, `L2-025` |
| [Select values](select-values/) | `L2-026`, `L2-027`, `L2-028` |
| [Open and position the list](open-and-position-list/) | `L2-029`, `L2-030` |
| [Integrate with forms](integrate-forms/) | `L2-031`, `L2-032` |
| [Operate by keyboard](operate-by-keyboard/) | `L2-033`, `L2-034` |
| [Expose state to assistive technology](expose-to-assistive-tech/) | `L2-035`, `L2-036`, `L2-037` |
| [Present the component accessibly](present-accessibly/) | `L2-038`, `L2-039`, `L2-040` |
| [Customize, localise, and publish the API](customize-and-localise/) | `L2-041`, `L2-042`, `L2-043` |
| [Secure and perform](secure-and-perform/) | `L2-044`, `L2-045`, `L2-046` |
| [Verify and document](verify-and-document/) | `L2-047`, `L2-048`, `L2-049`, `L2-050` |

The package runs entirely in the host application's browser. It has no backend of its own. Data comes from the consumer's `searchFn`, which may call any server or in-memory source. Server-side rendering is not supported.

The package has no secondary entry points. Its proposed source layout follows `AGENTS.md`, mirrors `src/scorm-player/`, and uses Angular CLI and ng-packagr. The package depends on `@angular/cdk` for the overlay, the active-descendant key manager, the live announcer, and the component-harness base.

Shared building blocks, all proposed because `src/combobox/` does not exist yet:

| Name | Kind | Responsibility |
|------|------|----------------|
| `Combobox<T>` | Standalone OnPush component, selector `t-combobox` | Owns the template, the `query`, `isOpen`, and `activeIndex` signals, and the `value` model; implements `ControlValueAccessor` through `NG_VALUE_ACCESSOR` and reads the injected `NgControl` for invalid and touched state |
| `ComboboxSearch<T>` | Component-scoped class | Runs the asynchronous search pipeline: `toObservable(query)`, `debounceTime`, `distinctUntilChanged`, and `switchMap(searchFn)` with `catchError` inside the inner stream; appends pages through a page trigger and `scan`; exposes `results`, `status` (`idle`, `loading`, or `error`), `hasMore`, `total`, `replaceCount` (increments when a first-page response replaces the results), `pageLoaded` (emits `{ page, count }` for each response that belongs to the current query), `retry()`, `loadNextPage()`, and `cancel()` |
| `ComboboxOption<T>` | Directive | Owns the `role="option"` host element and its ARIA attributes; implements CDK `Highlightable`; registers with its parent through the `COMBOBOX_PARENT` `InjectionToken` |
| `ComboboxPopup` | Class | Wraps CDK `Overlay` with a `FlexibleConnectedPositionStrategy` and the reposition scroll strategy; keeps the overlay width equal to the field width with a `ResizeObserver` |
| `ComboboxAnnouncer` | Class | Wraps CDK `LiveAnnouncer`; debounces messages; reads every string from `COMBOBOX_I18N` |
| `COMBOBOX_I18N`, `ComboboxStrings`, `DEFAULT_COMBOBOX_STRINGS` | Injection token, interface, constant | Supply every owned string with English defaults |
| `ComboboxOptionTemplate`, `ComboboxChipTemplate`, `ComboboxEmptyTemplate` | Directives on `ng-template` | Select the `tComboboxOption`, `tComboboxChip`, and `tComboboxEmpty` slots; supply content only |
| `ComboboxPage<T>` | Interface | Result of one `searchFn` call: `items`, `hasMore`, and optional `total` |
| `ComboboxSelectionChange<T>` | Interface | Payload of `selectionChange`: optional `added`, optional `removed`, and `value` |
| `ComboboxHarness` | CDK `ComponentHarness` in `src/combobox/testing/` | Lets consumer tests operate the component without depending on its DOM |
| `ComboboxDemoPage` | Playwright page object in `test/e2e/pages/` | Owns every selector and interaction for the e2e combobox screen; named to avoid colliding with the `ComboboxPage<T>` data type |

Component state uses signals. Derived state, such as the selected identifiers, the remaining selection capacity, and the `aria-describedby` list, uses `computed()`. Cleanup uses `takeUntilDestroyed` and `DestroyRef.onDestroy`. Instance identifiers are generated once and stay stable for the instance's lifetime.

Public example usages live in `src/components-examples/tessera/combobox/`, a demonstration page in `src/dev-app/`, and the public API golden in `goldens/combobox/`.

These v1 decisions come from the requirements: selected options are not pinned to the top of the list, Home and End move the text cursor, the component has no "Select all results" action, and results are not cached per query. Free-text option creation, grouped options, virtual scrolling, and single-select mode are out of scope.

The following decisions remain `<TO SUPPLY>` before their affected production slices:

| Decision | Affected design | Required resolution |
|----------|-----------------|---------------------|
| Theme tokens | [Present the component accessibly](present-accessibly/) | Choose colors, borders, and focus-indicator styling that meet the 4.5:1 and 3:1 contrast targets in light, dark, and forced-colors modes |
| Icon source | [Present the component accessibly](present-accessibly/) | Choose the source of the chevron, spinner, clear, and checkmark icons |
| Truncated-chip tooltip | [Select values](select-values/) | Choose how the full label appears on hover and focus |
| Announcement coalescing window | [Expose state to assistive technology](expose-to-assistive-tech/) | Choose the interval within which the announcer keeps only the latest message |
| Reference conditions | [Secure and perform](secure-and-perform/) | Define the reference machine and measurement method for the `L2-045` timings |
| Manual verification scripts | [Verify and document](verify-and-document/) | Supply the platform-specific screen reader scripts and record observed results |

Production work follows `AGENTS.md`: one Given-When-Then criterion, one failing acceptance test, the least production change, then relevant regression checks. Frontend acceptance tests use Chromium Playwright and `ComboboxDemoPage`. Automated accessibility checks accompany every component change. Manual verification covers JAWS, NVDA, VoiceOver, TalkBack, and Narrator on their supported platforms.

A practical dependency order is: search, select, open and position, forms, keyboard, assistive technology, presentation, customization, hardening, then verification and documentation. Accessible behavior participates in every slice.

These artifacts do not implement production code or add architecture tests. They do not claim completed accessibility verification.

## Requirements

Each feature page lists its L2 requirements with their exact source wording. This table maps every combobox L2 requirement to its L1 parent and primary feature.

| L2 ID | Refines (L1) | Primary feature |
|-------|--------------|-----------------|
| `L2-022` | `L1-009` | [Search options](search-options/) |
| `L2-023` | `L1-009` | [Search options](search-options/) |
| `L2-024` | `L1-009` | [Search options](search-options/) |
| `L2-025` | `L1-009` | [Search options](search-options/) |
| `L2-026` | `L1-010` | [Select values](select-values/) |
| `L2-027` | `L1-010` | [Select values](select-values/) |
| `L2-028` | `L1-010` | [Select values](select-values/) |
| `L2-029` | `L1-011` | [Open and position the list](open-and-position-list/) |
| `L2-030` | `L1-011` | [Open and position the list](open-and-position-list/) |
| `L2-031` | `L1-012` | [Integrate with forms](integrate-forms/) |
| `L2-032` | `L1-012` | [Integrate with forms](integrate-forms/) |
| `L2-033` | `L1-013` | [Operate by keyboard](operate-by-keyboard/) |
| `L2-034` | `L1-013` | [Operate by keyboard](operate-by-keyboard/) |
| `L2-035` | `L1-014` | [Expose state to assistive technology](expose-to-assistive-tech/) |
| `L2-036` | `L1-014` | [Expose state to assistive technology](expose-to-assistive-tech/) |
| `L2-037` | `L1-014` | [Expose state to assistive technology](expose-to-assistive-tech/) |
| `L2-038` | `L1-015` | [Present the component accessibly](present-accessibly/) |
| `L2-039` | `L1-015` | [Present the component accessibly](present-accessibly/) |
| `L2-040` | `L1-015` | [Present the component accessibly](present-accessibly/) |
| `L2-041` | `L1-016` | [Customize, localise, and publish the API](customize-and-localise/) |
| `L2-042` | `L1-016` | [Customize, localise, and publish the API](customize-and-localise/) |
| `L2-043` | `L1-016` | [Customize, localise, and publish the API](customize-and-localise/) |
| `L2-044` | `L1-017` | [Secure and perform](secure-and-perform/) |
| `L2-045` | `L1-017` | [Secure and perform](secure-and-perform/) |
| `L2-046` | `L1-017` | [Secure and perform](secure-and-perform/) |
| `L2-047` | `L1-018` | [Verify and document](verify-and-document/) |
| `L2-048` | `L1-018` | [Verify and document](verify-and-document/) |
| `L2-049` | `L1-018` | [Verify and document](verify-and-document/) |
| `L2-050` | `L1-018` | [Verify and document](verify-and-document/) |

Shared requirements recur where two features enforce the same behavior. `L2-027` and `L2-034` share chip focus movement. `L2-024` and `L2-033` share the Enter-key Retry behavior. `L2-036` and `L2-041` share announcement strings. `L2-039` and `L2-040` share the 24 CSS px target size.

## Diagrams

Each feature contains C4 context, container, and component views, a class diagram, and two behavioral sequence diagrams. Each diagram has a PlantUML source and an inline PNG sibling.

C4 diagrams use offline `<C4/...>` macros. The combobox is a frontend package, so sequence boxes distinguish the host Angular application, the `@tessera/combobox` package, Angular CDK, and the consumer's data source. A consumer API box appears only where a diagram shows `searchFn` reaching a server.
