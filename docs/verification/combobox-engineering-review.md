# Combobox engineering review

**Review date:** 2026-10-03. **Perspective:** Senior Product Engineer reviewing maintainability, implementation rationale, payload, and browser performance.

**Audited implementation:** `dca2a8a02daa0714575211f0794916d703e4de63`, unchanged by the subsequent evidence-only commit `6120b37`. Angular/CDK 22.2.1; browser-only library. This review changes documentation only.

## Assessment

The combobox is maintainable for its current feature set, but its central component is reaching the point where additional behavior will become expensive to reason about. The public API, small collaborators, acceptance coverage, and resource cleanup are good foundations. The main component combines search coordination, forms synchronization, keyboard interaction, popup geometry, tooltips, and announcements in 931 lines. Responsibility coupling matters more than the line count itself.

Web performance practices are partly applied: OnPush, signals, debounced requests, cancellation, stable list tracking, and bounded visual heights are all useful. Two implementation choices undermine those benefits: geometry work runs after unrelated application renders, and option selection is repeatedly derived by scanning the entire selected-value array. Both deserve attention before using the control extensively in a busy LMS screen or with large combined result and selection counts.

There is measured unnecessary layout work, including forced synchronous layout in the CDK positioning path. There is no evidence that the component recreates its entire DOM on every keypress. Its arithmetic is cheap, and its stylesheet contains no `calc()` expressions. Optimizing calculation syntax would miss the actual costs.

Existing latency samples meet their acceptance thresholds. That is useful evidence for the tested workloads, not a guarantee of smooth interaction under all host workloads. The recommendations below are engineering priorities; this review does not establish a new functional defect or replace the project's pending manual accessibility release gates.

| Question                                          | Conclusion                                                                                                                                                                                                               |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Is it maintainable?                               | Yes today, with moderate extension risk from the component's multiple lifecycles and interacting flags. Extract the geometry responsibility first.                                                                       |
| Are file sizes appropriate?                       | Template, stylesheet, and collaborators are proportionate. The 931-line component is a refactoring candidate because of its responsibilities. Payload needs a consumer-level baseline before setting a component budget. |
| Are performance best practices used?              | Several important ones are. Application-wide geometry updates, redundant selected-state derivation, and full-list PageUp/PageDown measurement are gaps.                                                                  |
| Are expensive DOM operations consequential?       | Yes: ten unrelated host updates caused 30 layouts with the popup open in a production build, versus none with it closed. Costs were small on this fixture but unnecessary.                                               |
| Are calculations or forced rerenders the problem? | Repeated comparison scans and browser layout are the problems. No blanket forced component rerender or wholesale DOM rebuild was observed.                                                                               |

## Evidence and limits

The [diagnostic evidence JSON](combobox-engineering-review-evidence.json) records operation counts, production browser metrics, layout-stack summaries, source sizes, and a configuration probe. Inspection covered the component, template, styles, option directive, announcer, template directives, overlay container, internationalization, public API, harness, acceptance fixture, page object, tests, and build configuration.

Browser diagnostics used headless Chromium 153.0.8010.12 on Windows 10.0.26200, a Snapdragon X 12-core X1E80100, and Node 22.23.2. Development probes wrapped selected component methods and DOM APIs to count work. Production probes used CDP metrics without those wrappers. A separate development trace also omitted method spies and captured layout call stacks. Each probe allowed initial rendering to settle and observed a quiet window after the action.

These are diagnostic scenarios, not a statistical latency benchmark. Wrappers and development verification add overhead. The 200 selected values intentionally did not match the loaded options, exercising the full comparison scan. Ten-key bursts can coalesce into fewer render passes; their totals must not be divided into a supposed per-key cost. CDP duration deltas are aggregate browser work during the observation window, measured in seconds in the JSON. Element counts cover component descendants, not the whole document. The JSON's `hiddenCount` field is incidental probe output and is not used for any conclusion.

The probes and synthetic bundle experiments were temporary diagnostic scripts, not additions to the acceptance suite. They do not provide reusable regression protection. Any follow-up production change must add behavioral acceptance coverage through the Chromium page object under the repository's ATDD rules.

## Findings by priority

| ID  | Priority | Finding                                                                                                       | Confidence                                                                                        |
| --- | -------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| E1  | High     | Unconditional popup geometry after application renders causes redundant layout and positioning.               | Source, development counts, independent trace, and production metrics agree.                      |
| E2  | High     | Repeated selected-state scans scale with loaded options × selected values, including navigation-only updates. | Source and instrumented development counts agree; production comparison counts were not measured. |
| E3  | Medium   | Several independent lifecycle responsibilities are concentrated in the main component.                        | Source/AST inspection; maintainability judgment.                                                  |
| E4  | Medium   | All appended options remain mounted; PageUp/PageDown measures every row.                                      | Source and DOM/rectangle counts agree.                                                            |
| E5  | Medium   | Changing only `maxSelections` invalidates and repeats the current search.                                     | Source and isolated configuration probe agree.                                                    |
| E6  | Medium   | Current performance coverage misses combined worst-case state and host-driven geometry work.                  | Test and page-object inspection.                                                                  |
| E7  | Low      | Additional style, label, and tooltip reads offer smaller optimization opportunities.                          | Source inspection; no evidence that these dominate runtime.                                       |

### E1: Popup geometry has too many triggers and no unchanged-result guard

The [render callback](https://github.com/QuinntyneBrown/Tessera/blob/dca2a8a02daa0714575211f0794916d703e4de63/src/combobox/combobox.ts#L309) always calls `updatePopupGeometry()` while open. Angular documents `afterEveryRender` as application-wide, so it still executes when an unrelated host renders and the combobox's OnPush view is skipped. [Angular lifecycle documentation](https://angular.dev/guide/components/lifecycle).

The [popup setup](https://github.com/QuinntyneBrown/Tessera/blob/dca2a8a02daa0714575211f0794916d703e4de63/src/combobox/combobox.ts#L540) also installs CDK reposition-on-scroll, a ResizeObserver, capture-phase document scrolling, window resizing, and visual-viewport resizing. Some events can reach more than one positioning path. There is no shared dirty-state scheduler, frame coalescing, or geometry equality check. Capture scrolling excludes events inside the popup, which is a useful guard.

The [geometry method](https://github.com/QuinntyneBrown/Tessera/blob/dca2a8a02daa0714575211f0794916d703e4de63/src/combobox/combobox.ts#L718) reads the input, field, input row, root font size, panel scroll height, and status-row rectangles. It can first scroll the input into view. It then writes the maximum-height custom property and unconditionally calls `withPositions`, `updateSize`, and `updatePosition`.

Inspection of the installed CDK 22.2.1 implementation, `node_modules/@angular/cdk/fesm2022/_overlay-module-chunk.mjs`, confirms that `updatePosition()` calls the positioning strategy; its `apply()` resets styles before measuring viewport, origin, overlay, and container geometry. Repeated calls therefore include mixed style writes and reads, even when Tessera's computed width or position has not changed.

| Scenario                                                         | Geometry calls   | Direct rectangle reads | Browser layouts | Style recalculations |
| ---------------------------------------------------------------- | ---------------- | ---------------------- | --------------- | -------------------- |
| Development: open, 50 options, ten unrelated host signal changes | 10               | 80                     | 30              | 30                   |
| Development: closed, ten unrelated host signal changes           | 0                | 0                      | 0               | 0                    |
| Production: open, 50 options, ten unrelated host events          | Not instrumented | Not instrumented       | 30              | 30                   |
| Production: closed, ten unrelated host events                    | Not instrumented | Not instrumented       | 0               | 0                    |

The production open case spent approximately **5.14 ms in layout and 5.39 ms in style recalculation across all ten events**. This is not 10 ms per event or proof of a slow interaction. It establishes repeated avoidable work in an otherwise unchanged popup. More component instances, frequent host updates, and a more complex document could amplify the cost; those combinations were not measured.

The independent three-update trace recorded nine layout events; six carried JavaScript stacks, split equally between `_getNarrowedViewportRect` and `_getContainerRect`, both reached through `apply → updatePosition → updatePopupGeometry`. That supports a forced-layout finding, rather than inferring one merely from the presence of `getBoundingClientRect()`. Layout reads become problematic when they require resolving preceding geometry/style changes. [Browser layout guidance](https://web.dev/articles/avoid-large-complex-layouts-and-layout-thrashing).

**Recommendation:** introduce one small internal owner for popup geometry and its tracking lifecycle. Coalesce relevant invalidations, measure the required geometry together, and skip unchanged writes and unnecessary CDK positioning calls. Use explicit render phases where helpful; moving the existing CDK call into a phase alone will not eliminate its internal mixed operations. Retain immediate input visibility, variable status heights, short viewports, text scaling, dialogs, viewport changes, and scroll attachment. Cancel pending scheduled work on close and destroy. Validate the full dependency set before caching; a stable field width alone does not mean the popup position is stable.

### E2: Selection derivation repeats during active-option changes

[`isSelected`](https://github.com/QuinntyneBrown/Tessera/blob/dca2a8a02daa0714575211f0794916d703e4de63/src/combobox/combobox.ts#L462) calls `value().some(compareWith)`. The [default option template](https://github.com/QuinntyneBrown/Tessera/blob/dca2a8a02daa0714575211f0794916d703e4de63/src/combobox/combobox.html#L120) calls it separately for the option input, checked class, and checkmark branch. A custom option template adds another call, and disabled-state calculation can add one when the selection limit is reached.

For N loaded options and S selected values, a view check can perform O(N × S) comparisons even when only the active option changed. The consumer's comparator is arbitrary code; cost grows further if it performs serialization, normalization, or deep comparison. Reading `compareWith()` inside each predicate invocation adds avoidable signal-access work too.

A single ArrowDown with **250 options and 200 unmatched selections** caused **1,500 `isSelected` calls and 300,000 comparator invocations** in the instrumented development application. Angular development checking contributes to that count. The source has three default-template scans per row, implying up to 150,000 comparisons for one ordinary production template evaluation at the same N and S; that is a static inference, not a measured production count or latency.

The same action created or removed no elements. The expensive work is repeated derivation, not rebuilding every option. OnPush reduces checks for unrelated activity but does not eliminate checking in response to interaction within the control. [Angular OnPush guidance](https://angular.dev/best-practices/skipping-subtrees).

**Recommendation:** derive selected/disabled row state once from results, value, comparator, selection limit, and disabled predicate, independently of active-index changes. Read the comparator once per derivation. Cache only bounded state tied to current inputs. Consider labels similarly when `displayWith` is costly. Computed signals suit this dependency-based derivation because they cache values until dependencies change. [Angular signals documentation](https://angular.dev/guide/signals).

Preserve comparator semantics. A naïve `Set` does not implement arbitrary `compareWith`, and its equality differs from `Object.is` for signed zero. This optimization should not require consumers to adopt a new identity API or assume that selected entities are the same object instances as search results.

Before memoizing consumer callbacks, define their purity and invalidation expectations. A callback that reads mutable external state can change its result without changing its function identity. Caching must preserve the supported update contract rather than silently making displayed labels or disabled states stale.

### E3: The component's responsibility count is a maintenance concern

An AST count found **90 property declarations, 39 methods, and a 176-line constructor**. The property count includes readonly inputs, outputs, computed signals, queries, injected dependencies, IDs, references, and callbacks; it does not mean 90 mutable state variables.

The constructor wires forms synchronization, input validation/reset, disabled-state cancellation, post-render geometry and key-manager setup, debounced query handling, request handling, announcements, and destruction. State such as `queryPending`, `completedQuery`, `committedQuery`, `openingMode`, `needsActivation`, `navigationIntent`, and `composing` is changed across handlers, effects, and observable callbacks. Understanding one new transition can require reading several distant sections.

Central ownership is understandable for an initial accessibility-intensive control: focus, DOM availability, forms, and asynchronous results are tightly related. The existing small announcer, option directive, typed template directives, and i18n helpers already provide useful boundaries. A rewrite or a service per flag would add indirection without automatically reducing complexity.

**Recommendation:** extract geometry/tracking first because it has a clear lifecycle and a measured cost. Consider a private search coordinator only if it makes query/request transitions easier to inspect. Keep closely coupled keyboard and focus behavior together. Name important internal timing and geometry constants and explain why they exist: the 150 ms announcement quiet period, 32 ms empty-region interval, 1,000 ms loading announcement, and 100 ms tooltip dismissal are behavior-sensitive. Removing their delays as a generic performance cleanup could break announcements or hover interaction.

This aligns with Angular's preference for focused files and independent logic outside presentation classes; the guidance does not establish a universal line-count ceiling. [Angular style guide](https://angular.dev/style-guide).

### E4: Visual bounds do not bound DOM or navigation work

Pagination appends with `[...results(), ...page.items]`. It preserves the loaded list and copies its growing array on every append. All options remain mounted. The 24 rem popup maximum and 8 rem chip-list maximum constrain visual height, not the number of nodes.

| Loaded options | Selected chips | Component descendant elements |
| -------------- | -------------- | ----------------------------- |
| 50             | 0              | 163                           |
| 250            | 0              | 762                           |
| 50             | 200            | 1,165                         |
| 250            | 200            | 1,765                         |

These counts describe the default fixture, not universal DOM limits. Consumer templates can add much more content.

The [PageUp/PageDown handler](https://github.com/QuinntyneBrown/Tessera/blob/dca2a8a02daa0714575211f0794916d703e4de63/src/combobox/combobox.ts#L627) measures every list child to count fully visible rows. With 250 options and 200 chips, one PageDown produced 260 direct rectangle reads, versus nine for ArrowDown. It remains an O(N) scan although only a small visible window matters. Those row reads are grouped without intervening per-row writes; 260 reads do not imply 260 forced layouts. The observed total was three layouts in this scenario.

**Recommendation:** optimize selected-state derivation first, then investigate a bounded visible-row calculation or appropriately invalidated visible-count cache. Rows can have variable height and custom templates, so uniform-row assumptions are unsafe. Define the intended operational range for loaded results and selected values and test it in combination.

Virtualization may eventually be appropriate but changes DOM identity, focus, and `aria-activedescendant` responsibilities. It is not a simple v1 performance patch. Do not silently remove loaded results or selected chips to meet a node-count target.

### E5: Selection configuration unnecessarily couples to request invalidation

The [configuration effect](https://github.com/QuinntyneBrown/Tessera/blob/dca2a8a02daa0714575211f0794916d703e4de63/src/combobox/combobox.ts#L264) reads debounce, minimum length, maximum selections, and search function. Any of these changing cancels the pending request, clears results, and immediately requests page zero when the open query is eligible.

In the isolated probe, changing only `maxSelections` to 3 changed request telemetry from `['ad:0']` to `['ad:0', 'ad:0']`. That is unnecessary network and rendering work if the maximum only affects selection eligibility. The behavior is documented in the existing design, so this is a rationale/product-cost concern rather than an implementation/design mismatch.

**Recommendation:** validate selection limits separately from search invalidation unless the product contract intentionally requires a fresh search. Changing the search function should still invalidate old results. Clarify the desired behavior, then implement the change through a small acceptance-tested slice.

### E6: Existing performance tests prove a narrower workload

The [existing performance record](combobox-performance.md) contains 100 samples after ten warm-ups for each workload:

| Workload                               | CPU throttle | Recorded p95 | Acceptance limit | Samples within limit |
| -------------------------------------- | ------------ | ------------ | ---------------- | -------------------- |
| Typing with slow search pending        | 1×           | 8.8 ms       | 100 ms           | 100/100              |
| Rendering 50 options                   | 4×           | 61.2 ms      | 200 ms           | 100/100              |
| Toggling with 200 chips and 50 options | 4×           | 86.4 ms      | 200 ms           | 100/100              |
| Navigating 250 options                 | 1×           | 20.0 ms      | 100 ms           | 100/100              |

These are prior implementation results, not fresh runs performed for this review. Navigation does not combine 250 options with 200 selections and is not CPU-throttled. The suite does not establish performance for many component instances, unrelated host rendering, scroll/resize bursts, complex consumer templates, expensive comparators, or a large LMS document.

The [page object's measurement](https://github.com/QuinntyneBrown/Tessera/blob/dca2a8a02daa0714575211f0794916d703e4de63/test/e2e/pages/combobox-demo-page.ts#L612) starts in a keydown capture listener and samples DOM state at animation-frame opportunities. It records the first matching-frame duration and resolves after another frame opportunity. It does not include input delay before the listener or certify display presentation. Consequently it is not an INP measurement; INP includes more of the interaction lifecycle. [INP documentation](https://web.dev/articles/inp).

**Recommendation:** add behavioral performance scenarios for combined N/S state and representative host interaction, with production profiling as supporting evidence. Use the existing Chromium POM convention. Keep thresholds tied to product expectations and representative hardware; satisfying a 100 ms navigation threshold does not itself guarantee a frame every approximately 16.7 ms on a 60 Hz display. Avoid tests that assert source layout, names, or file size.

### E7: Smaller DOM costs are secondary opportunities

| Operation                                                                      | Assessment                                                                                                                                                                  |
| ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `previousChipKey()` reads computed direction in the input key handler          | It executes even for ordinary typing because the comparison is unconditional. Restrict direction reads to relevant horizontal-arrow handling, preserving live RTL changes.  |
| `listLabel()` queries the input and reads label text during view checks        | Usually small. Use the existing input reference and consider explicit invalidation if caching; external labels can change.                                                  |
| Fallback theme inheritance enumerates computed CSS properties                  | Runs on attachment when the pane is outside the host; inline panes skip it. A cold-path cost, not the main hot path.                                                        |
| Tooltip overflow checks and positioning read layout                            | Legitimate measurements for truncated labels and placement. Reuses an attached tooltip for the same chip; switching chips disposes/recreates it. Profile before optimizing. |
| Active option directive reads option/list rectangles and conditionally scrolls | Bounded per-navigation work with a clear visibility purpose. Retain it unless an equivalent mechanism preserves keyboard visibility.                                        |

`Math.min`, `Math.max`, offsets, and simple viewport arithmetic are not significant by themselves. CSS has no animation/transition loop or `calc()` expression in this component. The scoped `:has` focus selector is not evidence of a bottleneck. Prioritize repeated derivation and measured read/write/layout sequences rather than removing useful responsive or accessible behavior.

## Implementation choices worth retaining

The signal API is explicit and typed. OnPush, readonly inputs/queries, computed form state, and computed selection summaries avoid unnecessary recomputation in several places. Protected template members keep implementation details out of the intended public component API.

Search uses debounce for request reduction and immediate invalidation for stale work. `switchMap`, `takeUntil`, `defer`, `take(1)`, empty-completion detection, and error recovery cover realistic provider failures without terminating future searches. Loading, pending-query, and completed-query guards prevent duplicate pagination. This is more robust than debounce alone. It still cannot make an expensive synchronous consumer callback cheap or guarantee transport cancellation for every observable implementation.

Tracked chips preserve unchanged object identities; index-tracked options preserve hosts when pages append. The diagnostic toggle added only two element nodes in the observed mutation records, rather than rebuilding the list. Index tracking can reuse an option's custom child-template state for a different entity after query replacement; document and verify expectations if stateful templates become common. Replacing chips with new but comparator-equivalent object instances can likewise differ from preserving the original instances.

Resources have explicit cleanup: request subscriptions, the form subscription, key manager, popup/tooltip overlays, observers, popup listeners, and timers. No leak was identified in this review, but source cleanup and prior lifecycle tests are not a heap-retention certification. The single live region coalesces search messages while preserving selection order. Its timer count is limited, although the queued selection text is not a fixed-capacity buffer.

Native controls, safe text interpolation, typed template contexts, i18n injection, flexible layout, forced-colors styling, text wrapping, and deliberate focus movement support the product's accessibility goals. Consumer slots are a reasonable extension mechanism. These details explain part of the template and stylesheet size. They should remain intact during performance work.

## File size and shipped payload

Measured source sizes at the audited revision:

| File                            | Physical lines | Bytes  | Assessment                                                                                                                                  |
| ------------------------------- | -------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `combobox.ts`                   | 931            | 33,194 | Too many responsibilities for comfortable growth; 896 nonblank lines. Extract a coherent subsystem rather than splitting by arbitrary size. |
| `combobox.html`                 | 211            | 6,741  | Reasonable for chips, editable input, popup states, slots, live region, and tooltip. Repeated derivation needs attention.                   |
| `combobox.scss`                 | 276            | 6,122  | Reasonable feature coverage; compiled application style budget warning needs triage.                                                        |
| `combobox-announcer.ts`         | 85             | 2,611  | Focused and appropriately sized.                                                                                                            |
| `combobox-option.ts`            | 48             | 1,627  | Focused identity/ARIA/highlight behavior.                                                                                                   |
| `combobox-templates.ts`         | 52             | 1,648  | Small typed extension contracts.                                                                                                            |
| `i18n.ts`                       | 71             | 2,446  | Proportionate default strings and formatting.                                                                                               |
| `combobox-overlay-container.ts` | 14             | 560    | Small purposeful collaborator.                                                                                                              |
| `testing/combobox-harness.ts`   | 65             | 2,778  | Compact consumer test API.                                                                                                                  |
| `types.ts`                      | 18             | 488    | Appropriately small contracts.                                                                                                              |
| `public-api.ts`                 | 16             | 605    | Explicit exports.                                                                                                                           |

Source bytes are not download bytes. The fresh ng-packagr FESM was **75,421 bytes**, **13,960 gzip bytes**. A synthetic esbuild minification retaining all exports was 59,996 bytes / 12,470 gzip bytes. A component-only export with all dependency packages external was **58,263 bytes / 11,870 gzip bytes**, with no harness in the output.

Those synthetic results exclude Angular/CDK/RxJS and retain partial-compilation metadata without an Angular consumer linker pass. They are neither a complete production download size nor a reliable marginal consumer budget. They show that the harness is removable in this experiment; exporting it from the same module does not automatically ship it to every application. The package declares `sideEffects: false`.

The production acceptance application built successfully with **510.90 kB initial raw size / 136.44 kB estimated transfer size**, exceeding its 500 kB warning budget by 10.90 kB. Combobox compiled styles were **5.19 kB**, exceeding the 4 kB warning budget by 1.19 kB. The lazy harness-contract chunk was 575.92 kB / 129.07 kB estimated transfer and includes test/compiler infrastructure; it is not core combobox payload. These are application figures, not isolated library costs.

**Recommendation:** compare real production consumer builds with and without the combobox, accounting for already-shared Angular/CDK code. Review the style and initial-bundle warnings with that baseline. Raising budgets merely to silence warnings would not address their cause. Breaking source into smaller files does not by itself reduce shipped bytes.

## Verification status

| Check                                 | Evidence and scope                                                                                                                                                                                                                                                                                       |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fresh library build                   | `pnpm exec ng build combobox` passed against the audited source.                                                                                                                                                                                                                                         |
| Fresh production acceptance-app build | `pnpm exec ng build e2e-app --configuration production --output-path C:/Users/quinn/AppData/Local/Temp/tessera-engineering-prod` passed with the two budget warnings described above.                                                                                                                    |
| Public API reports                    | `pnpm api:check` passed for both packages during the review. API Extractor warned about its bundled TypeScript 5.9.3 versus project TypeScript 6.0.3.                                                                                                                                                    |
| Diagnostic browser work               | Development operation counts, independent layout trace, production CDP probe, and isolated configuration probe are recorded in the linked JSON.                                                                                                                                                          |
| Prior acceptance coverage             | [Implementation/design review](combobox-implementation-design-review.md) records 113 passing Chromium combobox regressions. [Implementation record](combobox-implementation.md) records 191 broader acceptance tests and 96 SCORM unit tests. These suites were not rerun for this documentation review. |
| Accessibility release status          | [Manual screen-reader/release matrix](combobox-screen-reader-matrix.md) remains pending. Automated axe and keyboard evidence does not prove manual JAWS, NVDA, VoiceOver, TalkBack, or Narrator behavior, actual browser zoom, or device performance.                                                    |

No production code, public API, acceptance criterion, or test expectation was changed by this review.

## Recommended sequence

1. Address E1 in a small geometry/lifecycle slice. Preserve placement and visibility behavior, add representative host/viewport interaction coverage, and compare production layout traces before and after.
2. Address E2 with cached row derivation. Cover custom comparison, selected items outside the current result set, changing predicates/limits, and combined large result/selection state. Keep active navigation independent of unchanged selection derivation.
3. Separate selection-limit validation from search reset if the intended product contract supports that distinction. Prove request telemetry and existing cancellation/retry behavior.
4. Optimize PageUp/PageDown measurement and establish practical combined-state performance coverage. Consider broader rendering strategies only if measured operational needs justify them.
5. Review the consumer payload baseline and complete the existing manual release matrix before claiming release readiness.

Each production slice must begin with Given-When-Then criteria and a failing behavioral acceptance test, then implementation and relevant regression checks. Maintainability improvements should reduce ownership and repeated work while retaining the complete accessible interaction contract.
