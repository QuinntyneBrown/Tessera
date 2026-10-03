# Combobox HTML mock

Open [index.html](index.html) directly in Chrome. It needs no build, server, network, or account. All learners are fictional; Preview assignment displays a local message and saves nothing.

This is a design artifact for [the combobox requirements](../../specs/L2.md) and [detailed design](../../detailed-designs/combobox/). It simulates search, selection, chips, keyboard navigation, paging, retry, required state, selection limits, RTL, and long or numerous values. It does not implement Angular forms, signals, CDK overlays, custom templates, injectable localisation, package exports, a consumer harness, or the production release matrix. Its light theme illustrates the proposed defaults; dark theme remains specified in the design.

The Preview selector exposes results, slow loading, empty results, first-page error, next-page error, minimum-length gating, disabled, invalid, selection limit, 200 selections, and a long label. Switching scenarios resets local state. Reset restores the default with two selected learners.

The mock uses 300 ms typing debounce, 450 ms simulated response time (5 seconds for Slow loading), six results per page, and empty-query browsing (`minSearchLength: 0`). The proposed production default is `minSearchLength: 1`. Next-page error fails the first appended page once; Retry preserves the first page and appends that page. Search error changes back to Results after Retry so recovery can be explored.

Keyboard interaction:

- Arrow Down opens at the first enabled result; Arrow Up opens at the last loaded result; Alt+Arrow Down opens without an active result.
- Arrows navigate without wrapping; Enter toggles the active enabled result, retries an error, or loads more when no result is active.
- Arrow Down at the last result, list scrolling, and Load more results request another page.
- Escape dismisses a full-label tooltip first, then closes the popup, then clears the query. Tab closes the popup and follows the form sequence.
- Backspace in an empty input removes the last chip. Arrow Left reaches the last chip remove button; chip arrows mirror in RTL. Enter/Delete/Backspace removes a focused chip.

The input retains focus during result navigation and selection. Result IDs come from a local counter, and data renders as text. The live region belongs to the combobox host. Long labels have a tooltip available by hover or remove-button focus, which remains available while hovered and dismisses with Escape.

The controlled listbox scrolls, with status actions outside it and outside the Tab sequence. The preferred popup height scales with root text size (24 rem) and is bounded by the visual viewport. When status content and a visible option portion do not fit around the full field, the popup anchors vertically to the input row while retaining field width; opening/reflow keeps the focused input visible. This may cover chips, but does not cover the input.

One-off Chromium inspection and axe checks are design review evidence, not a production acceptance suite. No tests are added for this mock, as required by AGENTS.md. A 320 by 256 CSS px viewport checks reflow; it is not actual 400% browser zoom. Screen reader observations, real touch keyboards, and production accessibility/performance certification remain separate execution work.
