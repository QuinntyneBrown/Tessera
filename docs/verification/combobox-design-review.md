# Combobox design review

Scope: L1-009–L1-018, L2-022–L2-050, all ten combobox feature designs and their 60 diagram sources/images, and the standalone HTML mock. Production implementation and release certification are outside this artifact review.

## Current review status

Repair round in progress. Consecutive clean checks: **0 of 5**. This record shall advance only after complete reviews find no new issues; any fix resets the count. A render or isolated browser check alone does not count as a full clean review.

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

## Evidence gathered

- PlantUML strict syntax check passed; the bundled renderer regenerated all 60 diagrams with zero reported failures. The latest positioning image was regenerated and visually inspected. Other changed renders and the full cross-artifact review remain in progress.
- Chromium mock inspection: six initial results; Alt+Arrow Down has no active descendant; a failed next page preserves six results; Retry appends to twelve; input focus remains during navigation.
- All eleven mock Preview states reported zero WCAG-tagged axe violations after the scroll repair; 200 selections at 320 CSS px also retained page width with 200% root text.
- Page width stayed within 320, 576, 768, 992, 1200 and 1920 CSS px in the inspected state.
- Axe initially found scrollable-region-focusable on the outer popup; after moving scrolling to the controlled listbox, the inspected open state had zero violations without rule exclusions.
- At 320 by 256 CSS px, the updated popup and input fit the viewport, the listbox retained visible height, and axe reported zero violations. This is reflow evidence, not actual browser zoom.

## Remaining review work

Complete the cross-artifact review, inspect rendered diagrams, run the full mock state/interaction/accessibility/layout matrix, and perform five consecutive complete clean checks. Production screen reader and actual-device release observations remain Not run, as stated by the verification design.
