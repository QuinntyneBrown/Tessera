# Combobox implementation record

The automated combobox implementation is complete. Production slices use Chromium Playwright acceptance tests through ComboboxDemoPage. Existing behavior is recorded as already green; the harness sequencing deviation is recorded explicitly. No mock or architecture tests are added. The manual release gates in L2-049 remain pending.

| Slice | Criterion | Red evidence | Green evidence |
|---|---|---|---|
| Accessible field and package | L2-035 AC1, L2-048 AC1 | Named Learners combobox absent; toBeVisible failed before production code | Named closed input and axe pass; ng build combobox passes; existing extracted-course SCORM acceptance passes |
| Default search debounce | L2-022 AC1 | No `ad:0` request at the 300 ms boundary | Both combobox tests and SCORM loading pass; library build passes. Request telemetry avoids measuring Angular's later render task. |
| Configured debounce | L2-022 AC2 | A request fired before the configured 500 ms pause | All three Chromium combobox tests and their axe checks pass on the isolated port 4210. |
| Minimum query | L2-022 AC3 | `a:0` was requested with minimum 2 | Four combobox tests and axe pass. |
| Completed query reuse | L2-022 AC5 | `ada:0` requested twice | Five combobox tests and axe pass. |
| Composition | L2-022 AC6, AC10 | Search requested unfinished composed text | Six combobox tests and axe pass. Immediate in-flight cancellation is covered in the cancellation slice. |
| Inline results popup | L2-029 AC2, L2-030 AC7, L2-035 AC3/6 | No rendered options | Seven combobox tests and axe pass. Fixed list naming to read the visible input label. |
| Immediate cancellation | L2-023 AC1/6 | No unsubscribe after input edit | Eight combobox tests and axe pass; fixture retains synchronous zero-delay responses to distinguish completed from cancelled searches. |
| Loading state | L2-024 AC1/2 | Listbox lacked aria-busy | Nine combobox tests and axe pass; previous options remain available. |
| Recoverable search errors | L2-024 AC4/5 | Retry missing for observable errors, synchronous throws and empty completion | Twelve combobox tests and axe pass; failed sources do not terminate the search stream. |
| Empty results | L2-024 AC3/7 | No results row absent | Thirteen combobox tests and axe pass. |
| Below-minimum query | L2-022 AC8 | Minimum-length instruction absent and old results retained | Fourteen combobox tests and axe pass. |
| Explicit opening and dismissal | L2-029 AC1/2/3/4 | Keyboard/pointer open and dismissal tests failed at expanded state; toggle absent | 24 combobox tests and axe pass; ng-packagr production build passes. |
| Empty-query opening | L2-022 AC4 | No empty-query results appeared | Targeted opening, reuse, composition and default-debounce regressions pass with axe. |
| Debounced output | L2-022 AC7 | searchChange was not emitted | 26 combobox tests and axe pass. Fixture console telemetry allows exact timer-boundary assertions without waiting for Angular render tasks. |
| Pointer selection | L2-026 AC1/2/3/5 | Activating Ada left aria-selected false | Selection, popup and debounce regressions plus axe pass. |
| Chips and removal | L2-027 AC1–6 | External values rendered no chips | Selection and popup regressions pass with axe; removal focuses a surviving chip before deleting its node. |
| Object identity and labels | L2-028 AC1/2 | Object chip rendered [object Object] | Three selection tests and axe pass. Earlier fixture target-size finding fixed before this production slice. |
| Owned live region | L2-036 AC1/2/12 | No instance live region existed | Announcement and selection regressions pass with axe. |
| String overrides | L2-041 AC2/3/4 | Localized chip list and actions absent | Five customization, announcement and selection tests pass with axe. |
| Announcement queue and failures | L2-036 AC5/6/7/11 | Rapid selections announced nothing; queued results announced immediately; failure stayed polite | Eight related tests and axe pass. Selection messages within the quiet window are joined in arrival order, per the reviewed design. The below-field clear action is reached after dismissing the panel. |
| Limits and disabled options | L2-028 AC3/4, L2-026 AC6 | Options lacked disabled state | Nine selection/announcement tests and axe pass. Disabled activation uses trusted pointer input so Playwright's enabled check does not bypass the component guard. |
| Optional query clearing | L2-026 AC4 | Input retained ad with clearSearchOnSelect | Ten selection/announcement tests and axe pass. |
| Active-descendant navigation | L2-029 AC5, L2-033 AC1–4, L2-035 AC4/7, L2-037 AC1 | Arrow modes lacked option ids and active descendants | Ten keyboard/selection tests and axe pass. Alt+ArrowDown's existing no-active behavior also remains verified. |
| Enter and native submission | L2-033 AC5/6/7, L2-026 AC6 | Enter submitted instead of selecting/retrying | Sixteen keyboard/popup tests and axe pass. |
| Editing and page keys | L2-033 AC10/11/15/16 | Space inserted text after navigation; PageDown did not activate; empty Backspace kept chip | Nine keyboard tests and axe pass. |
| Chip keys, RTL and Escape | L2-034 AC1/2/3/5, L2-033 AC8/9/12 | Backspace/Delete kept chips; horizontal keys did not focus chips; closed Escape retained text | Sixteen keyboard tests and axe pass. Native Enter/Space chip removal also remained green. |
| Component disabled state | L2-023 AC3, L2-022 AC9, L2-031 AC3/4 | Input remained enabled after disable | Seventeen form/search tests and axe pass; cancelled qualifying queries can be reissued on reopening. |
| Value accessor | L2-031 AC1/2/3/4, L2-032 AC1/2 | Reset/disable left an enabled stale clear action under Angular's implicit model interoperability | Five form tests and axe pass with explicit CVA; model and template binding regressions remain green. |
| Focus exit and deferred updates | L2-031 AC2/5/6, L2-034 AC4 | No touched state or deferred blur commit after genuine exit | Seven form tests and axe pass. |
| Required, error and descriptions | L2-031 AC7–11, L2-035 AC5, L2-036 AC10 | aria-required and descriptions absent | Nine form tests and axe pass; control-event subscription refreshes validation/reset state. |
| Explicit paging and positions | L2-025 AC5/8, L2-036 AC9 | aria-setsize missing, Load more action absent | 33 search, keyboard and paging tests pass with axe. Appending preserves existing options and reports the appended count. |
| Keyboard paging and retry | L2-025 AC2/3/6/7/8 | ArrowDown and no-active Enter issued no next-page request | 20 paging/keyboard tests pass with axe. Retry and query reset already passed in the prior slice. |
| Scroll paging and delayed loading speech | L2-025 AC1/3, L2-036 AC4 | Scroll issued no request; live region remained empty after one second | Ten paging/announcement tests and axe pass. Empty pages never loop automatically. |
| Search configuration and integration errors | Search design, L2-023 AC6, L2-043 AC7 | Completed results reused after source replacement; invalid values raised no error | Twenty search/configuration tests pass. Angular reports effect errors through ErrorHandler console output; the POM now captures that channel as well as pageerror. |
| Template content slots | L2-042 AC1–5 | Custom chip and empty content absent | Nine customization/selection tests and axe pass; option context changes with active and selected state. |
| Dual form/model synchronization | L2-032 AC3/4 | Model write left FormControl unchanged | Ten form tests and axe pass. An array identity guard prevents model/control echoes and preserves deferred user commits. |
| Form replacement and submit boundary | L2-031 AC2/11 | No new production failure: bridge and accessor already satisfy these behaviors | Replacement/old-control isolation and updateOn submit pass. The POM dismisses the panel before activating the external submit button. |
| Responsive presentation and state cues | L2-027 AC7/8, L2-037 AC3/4, L2-038 AC2–4, L2-039 AC1/3/4/5 | Chip area was 896 px tall; long labels caused overflow; disabled cue absent | Nine presentation tests pass across six widths, 200% text, spacing, forced colors and reduced motion, with axe. Selection/keyboard regressions pass. Fixture telemetry itself needed wrapping at narrow widths. |
| Popup reflow and tracking | L2-030 AC1–4, L2-039 AC2/6 | Container resize kept the old width; ancestor scroll detached the list; short viewport obscured input | Seventeen positioning/presentation/paging tests pass, then eight positioning/paging regressions pass with runtime-error capture. Resize events needed a Node guard. |
| Full-label tooltip | L2-027 AC7/9 | No tooltip on hover or focus | Eighteen tooltip/keyboard tests pass with axe. Escape dismisses tooltip before the popup; pointer transfer and focus exit are verified. |
| Modal dialog fallback | L2-030 AC6/7 | Native dialog intercepted pointer events on the body-attached fallback | Seventeen dialog, geometry and dismissal tests pass with axe. The component-scoped container stays inside its native dialog and routes fallback focus/key events once. |
| Fallback theme inheritance | L2-038 AC1/4 | Fallback panel became transparent instead of the host surface | All four native/CDK dialog cases pass with matching panel surfaces and axe. |
| Touch and destruction regression | L2-040 AC1–3, L2-046 AC2–5 | Existing interaction and destruction paths already satisfy the added criteria | Touch, cancellation and 100 real mount/destroy cycles pass with axe; pane and document-listener counts return to a measured warm baseline. |
| Consumer harness | L2-047 AC1–5, L2-046 AC1 | Initial fixture type error was corrected; then contract returned ComboboxHarness unavailable with export removed | Browser TestBed contract passes under zoneless change detection, including two-instance isolation and missing-option rejection. Harness implementation was started before the fixture error was understood; this ATDD sequencing deviation was reported and the expected unavailable-harness failure was subsequently demonstrated. |
| Text safety, contrast and performance | L2-044 AC1–5, L2-038 AC1, L2-045 AC1–5 | Existing behavior already meets these added checks | Four security/contrast checks and all five performance checks pass. Each latency check takes ten warm-ups and 100 samples; rendering/toggling use 4× CPU slowdown. Raw final metrics are preserved in the performance evidence. |
| Naming and keyboard completion | L2-035 AC2, L2-043 AC4/8, L2-033 AC15/16 | Unlabelled field raised no diagnostic; pointer cursor move still toggled on Space; PageDown did not page | Twenty-nine configuration/keyboard/paging tests pass with axe. Angular's required-input NG0950 already passed. |
| Adoption examples | L2-050 AC2/3 | Combobox examples heading absent | Five runnable examples pass their acceptance scenario with axe and build in the dev app. |
| Packed consumer | L2-043 AC5 | Existing packaged implementation satisfied this new adoption check | Separate strict-template Angular app uses the tarball installed into its own node_modules, with no Tessera aliases, and passes forms, label, focus and axe checks. Pinned peer dependencies are shared through filesystem links. |
| Mixed pending announcements | L2-036 AC5/11 | Closing retained search speech in a mixed pending write; failure dropped a pending selection | Thirteen announcement/selection checks pass. Pending messages retain separate search and selection parts throughout the region reset gap. |
| Stale retry guard | L2-023 AC6, L2-025 AC7/9 | Editing during debounce reissued the failed `ad:1` descriptor | All 23 search/paging checks pass; pending edits and composition prevent Retry of stale descriptors. |
| Persistent paging action | L2-025 AC8/9 | Load more results disappeared after an append error | The action remains visible and disabled while Retry is required; all 25 paging/keyboard regressions pass. |
| Strict adoption and README compilation | L2-042 AC1–3, L2-043 AC5, L2-050 AC1 | Existing API and templates satisfy these additional consumer checks | The packed host compiles object content slots, reactive forms and both shipped README snippets under strict templates. `tools/package-docs-compile/combobox.mjs` includes snippets from the installed tarball in that build. |

## Final automated verification — 2026-10-03

- Chromium acceptance/regression suite: **191 passed**, including all existing SCORM scenarios. Run with `TESSERA_E2E_PORT=4210` and `playwright test --grep-invert "render-latency samples" --workers=4`.
- Existing SCORM unit regression: **96 passed** across nine files with `ng test scorm-player --watch=false`.
- `ng build combobox`, `ng build scorm-player`, `ng build dev-app` and `ng build e2e-app`: **passed**.
- Both API Extractor golden checks: **passed**. The existing tool warns that its bundled TypeScript 5.9.3 is older than project TypeScript 6.0.3.
- `npm run e2e:packed`: **passed** in a separate strict Angular consumer. The package comes from its tarball; pinned peers reuse workspace dependencies through filesystem links. No Tessera source aliases exist in the consumer.
- `prettier --check .` and `git diff --check`: **passed**.
- Isolated performance run: **five checks passed**, using one Chromium worker; raw measurements are recorded in [the performance evidence](combobox-performance.md). Measurements describe browser frame opportunities in headless Chromium, not certified display latency.
- Desktop and 320 CSS px screenshots inspected: focus, selected/active state and field/panel alignment remain visible. These inspections do not substitute for actual zoom or assistive technology verification.

The first full regression attempt was stopped after discovering that the course fixture's CORS origin still pointed at port 4200. The Playwright course-server environment now follows the configured app port. Two announcement assertions were made deterministic by waiting for the preceding results announcement or advancing the clock to the limit announcement before the search completes; their expected messages were retained. The subsequent full run passed all 191 tests.

Non-blocking build warnings remain: combobox component styles are 5.19 kB against a 4 kB warning threshold (below the 8 kB error threshold); the e2e app's initial bundle is 510.90 kB against a 500 kB warning threshold (below the 1 MB error threshold). Existing budgets are unchanged.

Manual screen-reader verification, real on-screen keyboards and actual browser zoom are **Not run**. See [the pending matrix](combobox-screen-reader-matrix.md). This record does not certify release readiness.

## PR #2 host-layout review fix — 2026-10-04

One ATDD slice extends L2-030 with AC8: given a focused field and open list, expanding or collapsing host content above the unchanged-size field must preserve popup alignment, query, selection, and input focus.

Before changing production code, `TESSERA_E2E_PORT=4210 corepack pnpm exec playwright test test/e2e/combobox-positioning.spec.ts --grep "host content expansion" --workers=1` failed at the geometry assertion immediately after expansion. The fixture adds 100 CSS px above the field through a host signal; the page object dispatches the host event without moving input focus. The same test passes after the fix, including collapse, retained input/selection, and axe checks.

The open-state render callback now schedules a geometry check through the existing animation-frame scheduler. This intentionally retains measurements after application renders because host layout changes do not necessarily change a combobox signal or the field's size. The existing geometry key prevents unchanged panel styles, overlay size, and CDK positioning from being written again. Frame coalescing and close/destroy cancellation remain in place.

Validation:

- All nine Chromium positioning scenarios pass, including the existing unrelated-host-render layout-count check with its original threshold.
- The full Chromium acceptance run with four workers passed 191 of 193 cases; the missing-search-input page load and short-viewport case timed out. Both pass in an isolated `playwright test --last-failed --workers=1` run with unchanged assertions and timeouts. All 193 cases have therefore passed across these runs; the initial full run was not clean.
- All five isolated performance scenarios pass with `corepack pnpm e2e:performance`, including four sets of 100 latency samples at their existing thresholds.
- `corepack pnpm build`, `corepack pnpm api:check`, `corepack pnpm lint`, and `git diff --check` pass.
- The default SCORM unit runner failed to start its fork workers before any tests executed. All 96 tests across nine files pass with `corepack pnpm exec ng test scorm-player --watch=false --runner-config=tmp/pr2-vitest.config.mjs`, using a temporary config exporting `{ test: { pool: 'threads', maxWorkers: 1 } }`. The temporary config is not committed; no tests or checked-in runner settings changed.

Manual screen-reader verification remains **Not run** because it could not be performed in this tool session. The [manual matrix](combobox-screen-reader-matrix.md) includes the host-layout scenario for the required platform checks. The manual accessibility gate remains open.
