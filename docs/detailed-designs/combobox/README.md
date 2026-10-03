# Combobox subsystem

## Overview

`@tessera/combobox` provides `t-combobox`, a browser-only Angular form control for searching a consumer data source and selecting multiple values as removable chips.

**Combobox** — text input paired with a popup list of options, using combobox input-focus conventions with a multi-select listbox extension

**Chip** — removable token that shows one selected value inside the field

**Option** — selectable entry in the popup list

**Live region** — visually hidden element whose text changes assistive technology reads aloud

The component serves data sets too large to load up front, such as assigning users to a course by typing part of a name. The design covers Angular forms, keyboard interaction, and assistive-technology exposure. The consuming application supplies an accessible name and a `searchFn`; the component owns option semantics, focus management, and announcements. Consumer templates supply accessible content within the component-owned hosts.

The requirements are in [L1](../../specs/L1.md) (`L1-009` to `L1-018`) and [L2](../../specs/L2.md) (`L2-022` to `L2-050`). These repository specifications are the source of truth. The [HTML mock](../../mocks/combobox/index.html) and its [guide](../../mocks/combobox/README.md) illustrate interactions without implementing Angular contracts.

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

The package has no secondary entry points. Its source layout follows `AGENTS.md`, mirrors `src/scorm-player/`, and uses Angular CLI and ng-packagr. The package depends on `@angular/cdk` for the overlay, the active-descendant key manager, and the component-harness base.

The package keeps interaction and data state in one component. Small collaborators own option semantics, announcement queueing, template slots, and fallback overlay placement.

| Building block | Responsibility |
|----------------|----------------|
| `Combobox<T>` | Standalone OnPush component; owns search, value/model/forms, keyboard handling, popup and tooltip references, and template bindings |
| `ComboboxOption` | Internal non-generic `Highlightable` directive; owns option ID, ARIA state, active styling, and listbox scrolling |
| `ComboboxAnnouncer` | Internal text queue with message/priority signals; the component template owns the instance live-region DOM |
| `ComboboxOverlayContainer` | Component-scoped CDK fallback container; keeps non-popover content inside the nearest open native dialog |
| Three template directives | `ComboboxOptionTemplate`, `ComboboxChipTemplate`, and `ComboboxEmptyTemplate` expose typed content slots |
| `COMBOBOX_I18N` and `ComboboxStrings` | Partial string overrides merged by the component over English defaults |
| Page, search, and selection types | `ComboboxPage<T>`, `ComboboxSearchFn<T>`, and `ComboboxSelectionChange<T>` define consumer data and event contracts |
| `ComboboxHarness` and `ComboboxOptionState` | Root-exported consumer test API and option-state type |

Signal state drives the Angular view. RxJS Subjects carry debounced queries, request descriptors, and immediate invalidation. `viewChildren` discovers option hosts directly. `DestroyRef` and `takeUntilDestroyed` release component-owned resources.

Public example usages live in `src/components-examples/tessera/combobox/`, a demonstration page in `src/dev-app/`, and the public API golden in `goldens/combobox/`.

These v1 decisions come from the requirements: selected options are not pinned to the top of the list, Home and End move the text cursor, the component has no "Select all results" action, and results are not cached per query. Free-text option creation, grouped options, virtual scrolling, and single-select mode are out of scope.

The design uses the [APG combobox](https://www.w3.org/WAI/ARIA/apg/patterns/combobox/) focus and editing conventions with a [multi-select listbox](https://www.w3.org/WAI/ARIA/apg/patterns/listbox/). This extends APG's single-select combobox example. The manual release matrix records verification of the resulting interaction pattern.

The feature pages describe the search, selection, form, overlay, keyboard, localisation, presentation, and lifecycle contracts. Automated evidence and measured performance are recorded separately in the [implementation record](../../verification/combobox-implementation.md) and [performance evidence](../../verification/combobox-performance.md).

The [manual release matrix](../../verification/combobox-screen-reader-matrix.md) remains Not run for screen-reader speech, real on-screen keyboards, and actual browser zoom. These designs explain the product's behavior and its release conditions; they do not certify those pending checks.

## Requirements

Each feature page lists its L2 requirements with their exact source wording. This table maps every combobox L2 requirement to its L1 parent and primary feature.

| L2 ID | Refines (L1) | Requirement |
|-------|--------------|-----------------|
| `L2-022` | `L1-009` | Typing in the input must trigger a search through the consumer's `searchFn(query, page)` after the `debounceMs` pause, subject to `minSearchLength`. Identical consecutive queries must not re-fetch. A search must not fire while an input method editor (IME) composition is in progress. |
| `L2-023` | `L1-009` | A new query must cancel the in-flight request, and a response for an outdated query must never replace newer results. Disabling the component must cancel any in-flight request. |
| `L2-024` | `L1-009` | The list must show a loading indicator while a request is in flight, a "No results" row when the result set is empty, and an error row with a Retry action when the request fails. A failure in `searchFn` must never throw out of the component, and later searches must still work after a failure. |
| `L2-025` | `L1-009` | When a page reports `hasMore: true`, the component must load and append the next page when the user scrolls to the end of the list or arrows past the last option. A page request must not duplicate an in-flight page request. |
| `L2-026` | `L1-010` | Activating an option by pointer or keyboard must toggle its selection, keep the list open and the input focused, and keep selected options in the list shown as selected. The search text must be kept unless `clearSearchOnSelect` is true. |
| `L2-027` | `L1-010` | Each selected value must render as a chip with a remove button, even when the value is not in the current results. A clear-all button must remove every value. Long labels and many selections must not break the layout. |
| `L2-028` | `L1-010` | Selected values must be matched by `compareWith` (default `Object.is`) so that new object instances for the same entity are recognised. When `maxSelections` is reached, unselected options must be disabled and the limit announced. |
| `L2-029` | `L1-011` | The list must open on typing, Arrow Down, Arrow Up, Alt+Arrow Down, or a click on the field or toggle button, and must not open on focus alone. It must close on Escape, Tab, an outside click, Alt+Arrow Up, or a click on the toggle while open. Closing itself must not move focus; Tab, an outside interaction, or disabling may move focus through browser behavior. |
| `L2-030` | `L1-011` | The results list must render in a CDK overlay attached to the field, with the field's width, flipping above the field when there is no room below, and repositioning on scroll and resize. The open list must not hide the focused input. |
| `L2-031` | `L1-012` | The component must implement `ControlValueAccessor` with a `T[]` value so that it works with Angular reactive and template-driven forms. `onTouched` must fire only when focus leaves the whole component. The component must support `required` and reflect the control's invalid state once touched. |
| `L2-032` | `L1-012` | The component must be usable without Angular forms through a two-way `[(value)]` model binding of type `T[]` with default `[]`. |
| `L2-033` | `L1-013` | With focus in the input, the keyboard must operate the combobox exactly as the following behaviors specify. Arrow navigation must not wrap. |
| `L2-034` | `L1-013` | With focus on a chip remove button, the keyboard must remove chips and move between them. In right-to-left layouts, Arrow Left and Arrow Right must be mirrored. |
| `L2-035` | `L1-014` | The input, listbox, options, chips, and buttons must expose the roles, states, and properties of the WAI-ARIA 1.2 combobox pattern, and the component must own the `role="option"` host so consumers cannot break the pattern. |
| `L2-036` | `L1-014` | The component must announce changes through one instance-owned visually hidden live region that exists before any message is written and lives outside the popup. It is polite by default and assertive for failures. Search announcements must be coalesced so rapid typing does not flood the queue; selection messages must not be lost. |
| `L2-037` | `L1-014` | DOM focus must stay on the input while the user navigates options, the active option must be scrolled into view, and every focusable control must show a visible, high-contrast focus indicator. |
| `L2-038` | `L1-015` | The combobox's colors, states, motion, and forced-colors rendering must conform to WCAG 2.2 AA. |
| `L2-039` | `L1-015` | The combobox must remain fully usable at extra-small, small, medium, large, and extra-large viewport widths, at up to 400% browser zoom, with enlarged text, and with text-spacing overrides, without horizontal scrolling or loss of content or functionality. Pointer targets must be at least 24 by 24 CSS pixels. |
| `L2-040` | `L1-015` | Touch interaction must toggle options without dismissing the on-screen keyboard. |
| `L2-041` | `L1-016` | Every user-visible and assistive-technology string the component owns, including live-region messages and button names, must come from an injectable i18n token with English defaults, so a consumer can localise them without forking the component. |
| `L2-042` | `L1-016` | The component must accept `ng-template` slots for custom option content (`tComboboxOption`), chip content (`tComboboxChip`), and the empty state (`tComboboxEmpty`). Templates supply content only; the component owns the host elements and their ARIA attributes. |
| `L2-043` | `L1-016` | The component must be consumable as the standalone `@tessera/combobox` Angular package with the documented inputs, outputs, and types below, in addition to the `value` model. |
| `L2-044` | `L1-017` | Data returned by `searchFn` and written to the value is untrusted. The component must render it as text, must not interpret it as HTML, and must not derive element ids or ARIA references from it. |
| `L2-045` | `L1-017` | The component must stay responsive while requests are in flight, must not issue a request per keystroke, and must render a page of options promptly. |
| `L2-046` | `L1-017` | The component must use OnPush change detection, must work with `provideZonelessChangeDetection()` and not require zone.js or application `NgZone` calls, and must release its requests, overlay, observers, and listeners when destroyed. |
| `L2-047` | `L1-018` | The package must ship a component harness in `src/combobox/testing/` that lets consumers' tests operate and inspect the combobox without depending on its DOM. |
| `L2-048` | `L1-018` | Every component change must ship with automated accessibility tests, and the automated verification must run in Chromium with Playwright using page objects. |
| `L2-049` | `L1-018` | Before the component is released, manual verification must be completed with the assistive technology and browser combinations below, and the results recorded. |
| `L2-050` | `L1-018` | The package must ship a documentation page and runnable examples for adopting the combobox. |

Shared requirements recur where two features enforce the same behavior. `L2-027` and `L2-034` share chip focus movement. `L2-024` and `L2-033` share the Enter-key Retry behavior. `L2-036` and `L2-041` share announcement strings. `L2-039` and `L2-040` share the 24 CSS px target size.

## Diagrams

Each feature contains C4 context, container, and component views, a class diagram, and two behavioral sequence diagrams. Each diagram has a PlantUML source and an inline PNG sibling.

C4 diagrams use offline `<C4/...>` macros. The combobox is a frontend package, so sequence boxes distinguish the host Angular application, the `@tessera/combobox` package, Angular CDK, and the consumer's data source. A consumer API box appears only where a diagram shows `searchFn` reaching a server.
