# Combobox HTML mock

Open [index.html](index.html) directly in Chrome. It needs no build, server, network, or account. All learners are fictional; Preview assignment displays a local message and saves nothing.

This is a design artifact for [the combobox requirements](../../specs/L2.md) and [detailed design](../../detailed-designs/combobox/). It simulates search, selection, chips, keyboard navigation, paging, retry, required state, selection limits, RTL, themes, custom templates, and long or numerous values. It does not implement Angular forms, signals, CDK overlays, injectable localisation, package exports, a consumer harness, or the production release matrix. It does model the [inline popover placement](../../adr/frontend/0001-render-combobox-panel-as-inline-popover.md): the fixed-position popup follows the field in the DOM, so the reading order is label, field, list, error, hint. Component colors use the design's `--t-combobox-*` token names with their light and dark defaults; host-page colors use separate `--page-*` variables. The [Fluent 2 comparison](fluent-2-comparison.md) records why the current layout and states were chosen.

The Preview selector exposes results, slow loading, empty results, first-page error, next-page error, minimum-length gating, disabled, invalid, selection limit, 200 selections, a long label, and custom templates. Custom templates show an initials avatar in each option and a guiding empty message for a query with no matches; they stand in for `tComboboxOption` and `tComboboxEmpty` content. Switching scenarios resets local state. The Theme selector shows the light or dark tokens, or follows the system preference. Reset restores the default: two selected learners, light theme, left-to-right.

The mock uses 300 ms typing debounce, 450 ms simulated response time (5 seconds for Slow loading), six results per page, and empty-query browsing (`minSearchLength: 0`). The proposed production default is `minSearchLength: 1`. Next-page error fails the first appended page once; Retry preserves the first page and appends that page. Search error changes back to Results after Retry so recovery can be explored.

Keyboard interaction:

- Arrow Down opens at the first enabled result; Arrow Up opens at the last loaded result; Alt+Arrow Down opens without an active result.
- Arrows navigate without wrapping. Page Down and Page Up move by the number of fully visible results; Page Down on the last result requests another page.
- Enter toggles the active enabled result, retries an error, or loads more when no result is active. With the list closed, Enter submits the form as the browser normally does.
- After Arrow or Page navigation, Space toggles the active result. After typing or moving the text cursor, Space types a space.
- Arrow Down at the last result, list scrolling, and Load more results request another page.
- Escape dismisses a full-label tooltip first, then closes the popup, then clears the query. Tab closes the popup and follows the form sequence.
- Backspace in an empty input removes the last chip. Arrow Left reaches the last chip remove button; chip arrows mirror in RTL. Enter/Delete/Backspace removes a focused chip.

The input retains focus during result navigation and selection. Chips and the input share the field's wrapping rows; the input sits beside the chips while they fit on one row. The focus ring is drawn on the field while the input has focus, and a focused chip remove button shows only its own ring. "Clear all selections" is a text button below the field, at the end of the hint row, so it cannot be mistaken for a control that clears the typed text. The required error appears directly below the field, before the hint, with an icon. Result IDs come from a local counter, and data renders as text. The live region belongs to the combobox host, outside the popup. Long labels have a tooltip available by hover or remove-button focus, which remains available while hovered and dismisses with Escape.

The controlled listbox scrolls, with a one-line status row outside it and outside the Tab sequence. The preferred popup height scales with root text size (24 rem) and is bounded by the visual viewport. When status content and a visible option portion do not fit around the full field, the popup anchors vertically to the input row while retaining field width; opening/reflow keeps the focused input visible. This may cover chips, but does not cover the input.

One-off Chromium inspection and axe checks are design review evidence, not a production acceptance suite. No tests are added for this mock, as required by AGENTS.md. A 320 by 256 CSS px viewport checks reflow; it is not actual 400% browser zoom. Screen reader observations, real touch keyboards, and production accessibility/performance certification remain separate execution work.
