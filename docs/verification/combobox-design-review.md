# Combobox design review

Scope: L1-009–L1-018, L2-022–L2-050, all ten combobox feature designs and their 60 diagram sources/images, and the standalone HTML mock. Production implementation and release certification are outside this artifact review.

## Current review status

Completed **5 consecutive clean checks** after the repairs below, on 2026-10-03. No artifact edits occurred during the clean sequence; only this review record advanced. Each check included cross-artifact review and the complete browser matrix, with the additional focus recorded below. A render or isolated browser check alone was not counted as a full review.

## Repairs in this round

- Aligned diagram ownership of announcements with the instance-owned host live region; removed old CDK LiveAnnouncer dependencies and unresolved theme/icon/window choices.
- Aligned search sequences with immediate invalidation before debounce, optional transport cancellation, minimum-length clearing, guarded paging and append-preserving Retry.
- Aligned opening keys, tooltip-first Escape, standalone required state and focus exits in diagrams.
- Replaced an unspecified Playwright harness adapter with an explicit Chromium TestBed contract fixture. Documented CDK stabilization behavior and manual timing control.
- Exported the harness return type in the proposed public API and replaced the misleading zoom helper with reflow viewport terminology.
- Synchronized the i18n diagram with every documented string key, clarified the one/other localisation limitation, and aligned dual model/form writes and destruction resources.
- Supplied the missing accessible-label diagnostic and mock usage/scope guide.
- Moved mock scrolling into the controlled listbox. Axe recognizes that combobox popup without introducing an extra Tab stop or disabling a rule.
- Fixed the short-height popup layout to reveal the focused input and use its row as the vertical origin when the chip area leaves inadequate room.

- Clarified close focus exceptions and Angular deferred update policies; removed unsupported harness capability claims.

- Aligned the automated zoom criterion with reflow evidence while retaining actual 400% zoom as a required manual check; documented shared chip/action Tab and Escape handling.

- Removed raw-query deduplication wording that would prevent retry after cancellation, and preserved repeated genuine selection messages in the coalescing contract.

- Visual review removed residual live-announcer container labels and the unresolved presentation icon source; synchronized opening modes and announcer method names.

- The combined 320 px / 200% text / spacing check exposed a zero-height options area; the popup maximum and available-room threshold now scale with text and rendered status height.

## Evidence gathered

- PlantUML strict syntax check passed; the bundled renderer regenerated all 60 diagrams with zero reported failures. The latest positioning image was regenerated and visually inspected. All 60 rendered diagrams received visual overview inspection, with detailed inspection of changed behavioral views; the full cross-artifact review is complete.
- Chromium mock inspection: six initial results; Alt+Arrow Down has no active descendant; a failed next page preserves six results; Retry appends to twelve; input focus remains during navigation.
- All eleven mock Preview states reported zero WCAG-tagged axe violations after the scroll repair; 200 selections at 320 CSS px also retained page width with 200% root text.
- Page width stayed within 320, 576, 768, 992, 1200 and 1920 CSS px in the inspected state.
- Axe initially found scrollable-region-focusable on the outer popup; after moving scrolling to the controlled listbox, the inspected open state had zero violations without rule exclusions.
- At 320 by 256 CSS px, the updated popup and input fit the viewport, the listbox retained visible height, and axe reported zero violations. This is reflow evidence, not actual browser zoom.

## Consecutive checks

| Check | Review focus and evidence | Result |
|---|---|---|
| 1 | Cross-artifact behavior alignment; L1/L2 coverage and exact quoted requirements; all relative links; all 60 diagram renders and visual overview; eleven-state axe run and 66 state/width inspections; retry, search, focus, Escape, short-height and enlarged-text/spacing inspection | Clean |
| 2 | Complete requirements/design/mock alignment review with focus on cancellation, composition, opening modes and limits; repeated eleven-state axe and 66 state/width matrix; rapid replacement kept only Ada, composition retained old results until end then showed two Morgans, Arrow Up selected last, minimum query showed zero options, limit blocked addition and allowed removal | Clean |
| 3 | Complete review with focus on ARIA, naming, i18n, announcement ownership, tooltip and chip focus; repeated full matrix; tooltip Escape preserved popup, RTL moved to/from the last chip, removal focused the surviving chip, repeated selection messages stayed ordered, Tab closed normally; 29 L2 definitions and 60 source/render pairs present | Clean |
| 4 | Complete review with focus on responsive layout, theme states, touch, tooltip persistence and release evidence; repeated full matrix; touch toggled once and kept input focus, inspected targets met 24 by 24 CSS px, forced colors/reduced motion had zero axe violations and 0 s animation/transition, truncated-label tooltip stayed visible under hover and dismissed on Escape | Clean |
| 5 | Final complete consistency/completion audit and repeated full browser matrix; all 10 L1 parents, 29 L2 requirements and 10 feature designs accounted for; exact source quotations and relative links resolved; all 60 PlantUML sources passed strict syntax checks; HTML Prettier and git diff whitespace checks passed | Clean |

## Completion audit

| Requested scope | Evidence | Outcome |
|---|---|---|
| Evaluate and improve combobox specifications | L1-009–L1-018 and L2-022–L2-050 reviewed, acceptance conflicts repaired, every parent and detailed requirement accounted for | Complete |
| Evaluate and improve detailed designs | All ten feature READMEs, subsystem overview, 60 sources and 60 PNGs reviewed; behavior, dependencies, types, theme and verification guidance aligned | Complete |
| Evaluate and improve the mock | Eleven-state axe inspection, 66 state/width layout observations per pass, paging/retry/search/focus/Escape checks, short-height and combined enlarged-text/spacing checks, supplementary timing/chip/tooltip/touch/media inspections | Complete |
| Five consecutive clean checks | Five rows above on the same artifact revision, each without a new artifact issue | Complete |

The final artifact fingerprint is SHA-256 `6582f286d4c663ae35bc9b835e628759235dc59330ec999219a6eafc044470ba`. It covers the sorted relative paths and file bytes of both specification files, the complete combobox detailed-design tree, and the mock HTML/guide. This record is excluded. Browser inspection used Chromium 153.0.8010.12 and Node 24.18.0. One-off inspection scripts and screenshots stayed in the system temporary directory; no mock tests or architecture tests were added to the repository.

The common browser matrix opened each of Results, Slow loading, No results, Search error, Next-page error, Minimum 2 characters, Disabled, Required/invalid, Selection limit, 200 selections, and Long label. Each state received WCAG-tagged axe inspection, then layout/focus-reference inspection at 320, 576, 768, 992, 1200 and 1920 CSS px. Each pass also checked append-preserving Retry, Alt+Arrow Down, selection, query replacement, Escape, 320 by 256 reflow, and combined 200% text with spacing overrides. Page errors, horizontal overflow, stale active references, invisible input/popup, collapsed options, and axe violations were findings; none occurred in the clean sequence.

Production implementation, acceptance tests, packed-package smoke execution, performance measurement, screen reader observations, real on-screen keyboards and actual 400% browser zoom remain future release gates, explicitly Not run in the design. This completed artifact review does not claim those production gates passed.
