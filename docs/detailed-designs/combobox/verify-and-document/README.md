# Verify and document

## Overview

`t-combobox` ships with the means to test it, to prove its accessibility, and to adopt it. This feature describes those means: a harness for consumers' tests, automated accessibility checks, a manual screen reader procedure with a record, and a documentation page with runnable examples. It describes tooling and documents. It makes no claim that any verification has taken place.

**Component harness** — class that wraps one component's DOM behind a stable test API, built on the CDK `ComponentHarness`

**Page object** — class that owns the selectors and interactions of one screen, so that tests state intent only

**axe-core** — rule engine that detects accessibility defects in a rendered page

**Screen reader** — assistive technology that presents on-screen content as speech or braille

**Verification matrix** — table that records, for each screen reader and browser combination, the date, version, result, and defects

**Definition of done** — list of conditions under which the component counts as complete

Automated tests cannot judge what a screen reader says, so the design pairs two kinds of verification. Chromium Playwright tests cover keyboard behavior, layout, and axe-core rules on every change. Manual runs with five screen readers cover speech output and are recorded in the repository. The harness serves consumers, who write tests against the component without knowing its markup.

The feature belongs to the combobox subsystem and refines `L1-018`. It depends on every other slice, because each slice ships its acceptance tests through the same page object and the same axe check.

## Description

**ComboboxHarness**

- `ComboboxHarness` extends the CDK `ComponentHarness` with host selector `t-combobox`. It lives in `src/combobox/testing/combobox-harness.ts`, and `public-api.ts` re-exports it, so a consumer imports it from `@tessera/combobox`, as the `scorm-player` harness does. The package has no secondary entry point.
- `ComboboxOptionState` is a plain data type with `label: string`, `selected: boolean`, and `disabled: boolean`.

| Method | Behavior |
|--------|----------|
| `open()` | Clicks the field when the list is closed. It does nothing when the list is open. |
| `isOpen()` | Returns true when the input has `aria-expanded="true"`. |
| `search(text)` | Focuses the input, clears it, and sends the characters as key events, which open the list. It then calls `forceStabilize()`. It does not advance time. |
| `getOptions()` | Returns a `ComboboxOptionState[]` for the rendered options in order. |
| `toggleOption(labelOrIndex)` | Opens the list when closed, finds the option by label or zero-based index, and clicks it. It rejects with a message that names the missing label or index. |
| `getChips()` | Returns the chip labels as `string[]` in selection order. |
| `removeChip(labelOrIndex)` | Finds the chip by label or index and clicks its remove button. It rejects when no chip matches. |

- The debounce is the consumer's to elapse. Under fake timers the consumer test advances 300 ms, or the configured `debounceMs`, after `search()`. Under real timers the consumer test waits the same time. Results then appear for `getOptions()` (`L2-047` AC2). Whether `search()` should wait for results itself is `<TO SUPPLY>`.
- The harness reads only the package's public surface: ARIA roles (`combobox`, `listbox`, `option`), `aria-expanded`, `aria-controls`, `aria-selected`, `aria-disabled`, and the semantic chip list. Because the listbox lives in a CDK overlay outside the host, the harness locates it with `documentRootLocatorFactory()` and the `aria-controls` identifier of its own input. This keeps two comboboxes on one page separate (`L2-047` AC5).
- An option label is the text of the component-owned content wrapper, which excludes the decorative checkbox. A chip label is the text of the chip's label wrapper, which holds either `displayWith(item)` or custom template content. The wrappers carry package-owned class hooks that only the harness reads.
- The harness has no filter predicate. A consumer with more than one combobox picks one with `getAllHarnesses()`. Whether to add `with()` filters is `<TO SUPPLY>`.
- The harness spec, `src/combobox/testing/combobox-harness.spec.ts`, runs through the `ng test combobox` builder with `TestbedHarnessEnvironment` and imports `ComboboxHarness` from the package entry. A host component with a synchronous `searchFn` double and fake timers drives each `L2-047` criterion. The runner shall execute in Chromium to follow `AGENTS.md`. The runner configuration is `<TO SUPPLY>`, because the existing `scorm-player` unit tests use a jsdom runner.

**ComboboxDemoPage and the end-to-end application**

- `ComboboxDemoPage` in `test/e2e/pages/combobox-demo-page.ts` owns every selector and interaction for the combobox screen in `src/e2e-app/`. Tests contain no selector. Its name avoids a clash with the `ComboboxPage<T>` data type.
- `ComboboxHostFixture` in `src/e2e-app/` hosts the component for tests. It reads a `ComboboxScenario` from the query string and configures the component and its mock `searchFn` from it. It uses `createMockUserSearch` from the examples folder, so one mock serves the examples, the dev app, and the tests.
- `ComboboxScenario` is a plain object that `ComboboxDemoPage.open(scenario)` serializes into the query string. Each slice adds the fields it needs. This slice and the neighbouring slices use these fields.

| Field | Effect |
|-------|--------|
| `searchDelayMs` | Latency of the mock `searchFn` |
| `pageSize`, `pageCount` | Page size and number of pages before `hasMore` turns false |
| `failure` | `always`, `first-request`, or `next-page` |
| `valueSize` | Number of items in the initial `value` |
| `maxSelections`, `required`, `disabled`, `rtl`, `dialog` | Component or host configuration |
| `templates` | `custom` supplies option, chip, and empty templates |
| `hostile`, `instances` | Hostile labels and two instances, as used by [Secure and perform](../secure-and-perform/) |

- `ComboboxDemoPage` offers these verification helpers. `useViewport(width)` sets one of 320, 576, 768, 992, 1200, or 1920 CSS px. `useZoom(400)` applies the 320 by 256 CSS px viewport with a device scale factor of 4, as the [present accessibly](../present-accessibly/) design specifies. `enlargeTextTo200Percent()` and `applyTextSpacingOverrides()` inject the style overrides, as `PlayerPage` does. `expectNoHorizontalScroll()` and `expectNoAccessibilityViolations()` complete the set.
- `expectNoAccessibilityViolations()` runs `AxeBuilder` from `@axe-core/playwright` with the tags `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, and `wcag22aa`. It includes `t-combobox` and the CDK overlay container, because the open list renders outside the host. It asserts an empty `violations` array.

**Automated accessibility verification**

- `ComboboxState` is a union of nine names. `ComboboxDemoPage.enterState(state)` opens a scenario and drives the screen into that state. `test/e2e/verify-and-document.spec.ts` runs one test per state and calls `expectNoAccessibilityViolations()` (`L2-048` AC1).

| State | Scenario and actions |
|-------|----------------------|
| `closed` | Default scenario, no interaction |
| `open-with-results` | Type "ad" and wait for the list |
| `loading` | `searchDelayMs` of 5 s, type "ad", assert the loading row |
| `empty` | Type a query the mock answers with an empty page |
| `error` | `failure: always`, type "ad", assert the error row |
| `invalid` | `required`, focus the field and leave it |
| `disabled` | `disabled` |
| `max-reached` | `maxSelections: 2`, select two options |
| `custom-templates` | `templates: custom`, open with results and one chip |

- Every slice's acceptance spec ends with `expectNoAccessibilityViolations()` in the state that slice introduced, so no component change ships without an axe check.
- Each keyboard row of `L2-033` and `L2-034` has at least one test in `test/e2e/operate-by-keyboard.spec.ts`, which uses `ComboboxDemoPage` actions such as `pressKey`, `typeText`, and `expectActiveOption` (`L2-048` AC2).
- The responsive tests in `test/e2e/present-accessibly.spec.ts` loop over the six widths, then run the 400% zoom, 200% text, and text-spacing cases (`L2-048` AC3).
- Test files follow the existing `test/e2e/<feature>.spec.ts` naming. Each file opens with a header comment that lists the L2 requirements it covers, and each test carries an `// L2-nnn ACn` comment as in `operate-player.spec.ts`. Review enforces the comment rule. No test parses the comments or the specifications, because `AGENTS.md` forbids such tests (`L2-048` AC4).
- All frontend tests run in Chromium only, the single project in `playwright.config.ts`. Axe results do not replace manual verification. Axe cannot judge speech output.

**Manual screen reader verification**

- The verification matrix lives in a repository document at `docs/verification/combobox-screen-reader-matrix.md`. The path is proposed. The document holds one table row per combination, and each row has the columns `Combination`, `Date`, `Version`, `Result`, and `Defects`. The `Version` cell records the screen reader, browser, operating system, and `@tessera/combobox` versions (`L2-049` AC3). The exact meaning of "version" in the requirement is `<TO SUPPLY>`.

| Combination | Result at design time |
|-------------|-----------------------|
| NVDA with Firefox | Not run |
| NVDA with Chrome | Not run |
| JAWS with Chrome | Not run |
| VoiceOver with Safari on macOS | Not run |
| VoiceOver with Safari on iOS | Not run |
| TalkBack with Chrome on Android | Not run |
| Narrator with Edge on Windows | Not run |

- Each combination follows one checklist. A tester records pass or fail for each item and links a defect for each failure (`L2-049` AC2).

| Item | Observation | Related requirement |
|------|-------------|---------------------|
| a | Label, role, and current selection are read on focus | `L2-035`, `L2-036` AC10 |
| b | Expanded and collapsed state is announced | `L2-035` AC1 |
| c | The result count is announced after typing | `L2-036` AC2 |
| d | Each option is read with its selected state while arrowing | `L2-035` AC7 |
| e | Selecting and removing are announced | `L2-036` AC6, AC7 |
| f | Error and required state are announced | `L2-031` AC7, `L2-036` AC5 |
| g | A keyboard-only run-through works without a mouse | `L2-033`, `L2-034` |
| h | Behavior is correct at 200% zoom, at 320 px width, in forced-colors mode, and with reduced motion | `L2-038`, `L2-039` |

- The platform-specific scripts and the observed results are `<TO SUPPLY>`, as the subsystem README records. Scripts for VoiceOver on iOS and TalkBack need a decision on external-keyboard use for item g.
- A release shall not proceed while any row reads `Not run`, or reads `Fail` with an open defect. The release procedure is `<TO SUPPLY>`.
- Manual runs are separate from automated tests, which run only in Chromium. A passing automated suite does not complete a manual row.

**Documentation and examples**

- The documentation page is `src/combobox/README.md`, as `src/scorm-player/README.md` is for the player. Compiling the page and its examples through `tools/package-docs-compile` is `<TO SUPPLY>`. The page has these sections, which `L2-050` AC1 names or implies.

| Section | Content |
|---------|---------|
| Installation and use | Import, minimal template, required `searchFn` |
| Label requirement | A visible `<label for>` bound through `inputId`, or `ariaLabel`; the development-time error otherwise |
| Inputs and outputs | The tables from [Customize, localise, and publish the API](../customize-and-localise/) |
| Forms and `[(value)]` | Reactive, template-driven, and two-way use |
| Template slots | The three slots, their contexts, and the consumer's responsibility for slot markup |
| Localisation | `COMBOBOX_I18N`, the string keys, and placeholders |
| Keyboard map | Every row of `L2-033` and `L2-034` |
| Accessibility behavior | Roles, announcements, focus rules, and zoom, touch, and forced-colors support |
| Testing | `ComboboxHarness` usage |
| Security notes | Text rendering and query encoding |
| Definition of done | The statement below |

- The definition-of-done section states the conditions: all `L2-022` to `L2-050` acceptance criteria pass, axe reports zero violations, the manual matrix is signed off, and the component works under zoneless change detection (`L2-050` AC4). The page states conditions. It does not assert that they hold. The matrix records sign-off.
- `src/components-examples/tessera/combobox/` holds five example components and a shared mock. The folder's `index.ts` exports them, as the `scorm-player` examples folder does (`L2-050` AC2).

| File | Demonstrates |
|------|--------------|
| `combobox-reactive-forms-example.ts` | `FormControl` with `required` and an error message |
| `combobox-template-driven-example.ts` | `ngModel` |
| `combobox-two-way-example.ts` | `[(value)]` bound to a signal |
| `combobox-custom-templates-example.ts` | `tComboboxOption`, `tComboboxChip`, and `tComboboxEmpty` |
| `combobox-paging-example.ts` | `hasMore` and `total` across pages |
| `mock-user-search.ts` | `createMockUserSearch(options)`, a `searchFn` factory with delay, page size, and optional failure |

- Each example is a standalone OnPush component that follows the existing `tsr-` selector convention. The `ng build dev-app` build compiles all of them, which satisfies "when they are built".
- `ComboboxDevPage` in `src/dev-app/src/app/` adds a combobox section to the existing single-page dev app. It renders the examples with `createMockUserSearch`, so the page demonstrates the component with a mock `searchFn` (`L2-050` AC3).

Production work follows `AGENTS.md`. The first slices are the harness criteria in order, then the nine axe states, then the examples build and the dev app page. Each slice has one failing test before any production change.

## Requirements

Source: [L2 detailed requirements](../../../specs/L2.md). The table quotes source wording exactly, including its use of `must`.

| L2 ID | Refines (L1) | Requirement |
|-------|--------------|-------------|
| `L2-047` | `L1-018` | The package must ship a component harness in `src/combobox/testing/` that lets consumers' tests operate and inspect the combobox without depending on its DOM. |
| `L2-048` | `L1-018` | Every component change must ship with automated accessibility tests, and the automated verification must run in Chromium with Playwright using page objects. |
| `L2-049` | `L1-018` | Before the component is released, manual verification must be completed with the assistive technology and browser combinations below, and the results recorded. |
| `L2-050` | `L1-018` | The package must ship a documentation page and runnable examples for adopting the combobox. |

## Diagrams

The context view shows the three people who use the verification and documentation kit: the consumer developer, the maintainer, and the accessibility tester. It also shows the external browsers and screen readers.

![C4 context: Verify and document](diagrams/c4-context.png)

The container view separates the package, its examples, the dev app, the end-to-end application, the Playwright tests, and the repository documents.

![C4 containers: Verify and document](diagrams/c4-container.png)

The component view shows the harness, the page object, the fixture, the spec files, and the documents that make up the kit.

![C4 components: Verify and document](diagrams/c4-component.png)

The class view records the harness API, the page object helpers, the scenario fields, and the structure of a matrix record.

![Class structure: Verify and document](diagrams/class-structure.png)

A consumer test operates the combobox through the harness, which finds the listbox through the input's `aria-controls` identifier.

![Sequence diagram: Operate the combobox from a consumer test](diagrams/sequence-consumer-harness.png)

A Playwright test enters a state through `ComboboxDemoPage` and runs axe over the host and the overlay. Responsive and keyboard checks use the same page object.

![Sequence diagram: Run automated accessibility verification](diagrams/sequence-axe-verification.png)
