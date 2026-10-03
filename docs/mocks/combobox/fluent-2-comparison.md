# Combobox mock: Fluent 2 comparison and improvements

Review date: 2026-10-03. This document compares the [Tessera combobox HTML mock](index.html) with the [Fluent 2 React Combobox usage guidance](https://fluent2.microsoft.design/components/web/react/core/combobox/usage) and lists changes that would improve the mock. It is a design review. It changes no artifact.

## Sources and method

- The Fluent 2 usage page and its five illustrations: single select, multi-select, filtering, the `text` prop, and content.
- Fluent UI React v9 source, used for measurements the usage page omits: `react-combobox` files `useComboboxStyles.styles.ts`, `useCombobox.tsx`, `useOptionStyles.styles.ts`, `useListboxStyles.styles.ts`, and `dropdownKeyActions.ts`.
- The Tessera mock, rendered in Chrome at 1280 × 900 and 320 × 640 CSS px. Computed styles and WCAG contrast ratios were measured in every Preview state.
- [L2-022 to L2-050](../../specs/L2.md) and the [present-accessibly design](../../detailed-designs/combobox/present-accessibly/README.md), which define what the mock should show.

The two components have different jobs. Fluent Combobox is a general control: single or multiple selection, free-form entry, and a fixed option list. Tessera's combobox is an asynchronous multi-select people picker with chips. Fluent's closest equivalent is `@fluentui/react-tag-picker`. This comparison therefore covers what the two share (field, listbox, option, tag, and keyboard model) and the usage guidance. Fluent features that the L2 v1 decisions exclude are listed separately in [Fluent features to leave out](#fluent-features-to-leave-out).

## Summary

The Tessera mock covers much more behavior than the Fluent usage guidance. It shows asynchronous search, loading, empty, error and retry states, paging, live announcements, a selection limit, chip keyboard navigation, RTL, long labels, 200 selections, forced colors and short-viewport positioning. Fluent's page covers none of these. The mock's default contrast is also higher: its field border is 4.34:1 on all sides, while Fluent relies on a single 6.19:1 bottom stroke beside 1.53:1 side borders.

Fluent is tighter visually. It uses one focus treatment for the whole field, compact rows, SVG icons and separate cues for selected, active and hover. It also gives explicit DOM-order advice for VoiceOver on iOS. The mock departs from several of these points, and in some places from Tessera's own detailed design.

The five most valuable improvements are:

1. Draw the focus indicator on the field, not on the inner input ([I-1](#i-1-draw-focus-on-the-field-not-the-inner-input)).
2. Make clear-all unmistakable. It currently looks like a "clear search text" × ([I-2](#i-2-make-clear-all-unmistakable)).
3. Place the popup directly after the input in the DOM so VoiceOver on iOS can swipe from the input to the options ([I-3](#i-3-place-the-popup-after-the-input-in-the-dom)).
4. Bring the mock in line with its design: SVG icons, the spinner, token names, inline chips, and disabled styling ([I-4](#i-4-replace-text-glyph-icons-with-svg) to [I-8](#i-8-reconcile-the-mock-with-the-design-tokens)).
5. Make rows and the status footer denser. At 1280 × 900 only about three options are visible ([I-10](#i-10-tighten-option-rows-and-the-status-footer)).

## What Fluent 2 recommends

- **When to use.** Use a combobox for long lists where filtering or free-form entry helps. Use a dropdown or select for short lists. Use the combobox Field wrapper for helper text and validation.
- **Placeholder.** Use placeholder text as a hint about the options, never as the label. Use `defaultSelectedOptions` to show a default selection.
- **Single select.** Clicking the closed field opens the list. Choosing an option closes it and the choice replaces the placeholder.
- **Multi-select.** Each option has a checkbox. The list stays open until the user clicks away or presses Esc. Selections do not replace the placeholder, so show them some other way, such as tags in the input.
- **Filtering and free form.** Typing filters the options. `freeform` allows submitting a value that is not in the list.
- **The `text` prop.** Give options with rich (JSX) content a plain string, so type-to-find works and the closed field shows the right value.
- **Spacebar.** Space selects the highlighted option when the user is navigating by keyboard. Otherwise it counts as a typed character, because options can contain several words.
- **Screen readers.** Prefer `inlinePopup`, which renders the listbox right after the input in the DOM. Safari does not support `aria-owns`, so this is what lets VoiceOver on iOS swipe from the input to the options.
- **Content.** Write descriptive, short labels. Use parallel construction across options, but do not repeat the same opening word. Include "None" if it is a valid choice. Use sentence-style capitalization.

## Side-by-side comparison

### Scope and behavior

| Topic | Fluent 2 Combobox | Tessera mock |
|---|---|---|
| Selection modes | Single and multi | Multi only (single-select out of v1 scope) |
| Data source | Synchronous children; filtering is the consumer's job | Asynchronous `searchFn` with 300 ms debounce, cancellation and paging |
| Free-form entry | `freeform` prop | Out of v1 scope |
| Showing selections | Advised to use tags in the input; shown with an avatar | Chips in their own row above the input |
| Multi-select close | Stays open until Esc or click-away | Same |
| Loading, empty, error | Not covered | Loading row, "No results", error row with Retry, next-page error |
| Paging | Not covered | Scroll, Arrow Down past the end, and "Load more results" |
| Selection limit | Not covered | Disables further options and announces the limit |
| Clear | `clearable`, single-select only (a console error in multiselect) | Clear-all button required by L2-027 |
| Option groups | `OptionGroup` with a header | Out of v1 scope |
| Live announcements | None specified | Instance-owned live region with coalesced messages |
| RTL | Through the provider | Preview toggle, with mirrored chip arrow keys |
| Long labels | Not covered | Ellipsis plus a hoverable, dismissible tooltip |
| Sizes and appearances | Small, medium and large; outline, underline, filled-darker and filled-lighter | One size and one appearance |
| Themes | Light, dark and high contrast | Light and forced colors. Dark is specified but not shown. |

### Visual anatomy

Fluent values are for the medium size and the web light theme, taken from the v9 source. Mock values are computed styles at 1280 × 900.

| Part | Fluent 2 | Tessera mock | Assessment |
|---|---|---|---|
| Field height | 32 px (24, 32 or 40 px) | 62 px empty; 112 px with two chips | The mock is very tall next to typical 32 to 40 px LMS form fields |
| Field border | 1 px `#d1d1d1` sides (1.53:1); bottom `#616161` (6.19:1) | 1 px `#657f73` on all sides (4.34:1) | The mock is better for SC 1.4.11 |
| Corner radius | 4 px everywhere | Field and popup 8 px, chip 6 px, option and checkbox 4 px | Fluent's single radius is more coherent |
| Focus | 2 px brand underline across the whole field, animated, with a reduced-motion override | 3 px orange outline around the inner input, and the field border turns green | See [I-1](#i-1-draw-focus-on-the-field-not-the-inner-input) |
| Text | 14/20 px regular; secondary text 12 px | 16/24 px; option names weight 650; secondary 12.8 px | The mock's larger text helps legibility, but the bold names compete with the label |
| Placeholder | `#707070` (4.95:1) | `#536763` (6.02:1) | The mock is better |
| Expand icon | 20 px SVG chevron, `role="button"`, `aria-expanded`, named "Open {label}" | Text glyph "⌄" (rendered as a "v"), `tabindex="-1"`, name changes | See [I-4](#i-4-replace-text-glyph-icons-with-svg) and [I-5](#i-5-fix-the-toggle-buttons-initial-name) |
| Listbox | 4 px padding, 2 px gap, shadow16, 4 px radius, up to 80vh | No padding, 4 px option margins, light shadow and 1 px border, 8 px radius, up to 24 rem | Both are acceptable. The mock's border survives forced colors |
| Option row | Single line at least 32 px; two-line persona about 52 px | 71 px plus 8 px of margins | See [I-10](#i-10-tighten-option-rows-and-the-status-footer) |
| Checkbox | 16 px, 2 px radius, brand fill with a white SVG check | 20 px, 4 px radius, accent fill with a white "✓" text glyph | The fill matches Fluent. The glyph should be SVG |
| Selected row | Checkbox only, no tint | Checkbox plus a green row tint | See [I-11](#i-11-separate-selected-active-and-hover) |
| Active option | 2 px focus-stroke outline during keyboard navigation | 2 px accent border | Both distinct |
| Hover | Neutral background on every row | Canvas background on unselected rows only. Selected rows do not change. | See [I-11](#i-11-separate-selected-active-and-hover) |
| Tags or chips | Pill shape, optional avatar, inline with the input | 34 px, 6 px radius, bordered, green fill, separate row | See [I-9](#i-9-flow-the-input-after-the-chips) |
| Invalid | Red border while unfocused; the Field shows an icon and message right under the control | 1 px red border; message under the hint, no icon | See [I-12](#i-12-move-the-error-message-and-add-an-icon) |
| Disabled | Disabled foreground and stroke colors | Background changes to `#f4f7f5` (1.08:1 against white). Text, chips and icons do not change. | See [I-7](#i-7-make-the-disabled-state-perceivable) |

### Keyboard

| Key | Fluent 2 Combobox | Tessera mock (L2-033) |
|---|---|---|
| Arrow Down / Up while closed | Opens | Opens at the first or last enabled result |
| Alt+Arrow Down | Opens | Opens with no active option |
| Enter while open | Selects. Single select also closes. | Toggles the active option, retries an error, or loads more |
| Enter while closed | Opens | Submits the enclosing form (checked: shows "Preview only: 2 learners…") |
| Space | In multiselect, toggles the highlighted option after keyboard navigation; otherwise types | Always types |
| Escape | Closes | Dismisses the tooltip, then closes, then clears the query |
| Home / End | First and last option | Moves the caret (deliberate APG choice in the L2 v1 decisions) |
| Page Up / Page Down | Jumps through options | Not handled |
| Tab | Single select picks the active option, then moves on | Closes and moves on |
| Backspace in an empty input | Not part of Combobox | Removes the last chip |
| Arrow Left at the input start | Not part of Combobox | Moves to the last chip; mirrored in RTL |

### Accessibility

| Topic | Fluent 2 | Tessera mock |
|---|---|---|
| Popup DOM position | Portal with `aria-owns`, or inline (recommended for VoiceOver) | Last child of `<body>`, `aria-controls` only. See [I-3](#i-3-place-the-popup-after-the-input-in-the-dom) |
| Popup wrapper | The listbox itself | `role="region"` named "Learner search results". This adds a landmark while the list is open. |
| Focus model | `aria-activedescendant` | `aria-activedescendant`; input focus kept during navigation |
| Selected summary | Not specified | Hidden summary read through `aria-describedby` |
| Forced colors | Supported | Supported, with system colors for selected and active states |
| Target size | 24 to 40 px fields; icons extend their hit area with `::after` | 44 px input row and icons, 32 px chip remove buttons |
| Reduced motion | Underline transition shortened to 0.01 ms | No motion is authored |

### Content

The mock follows Fluent's content rules. "Learners" is a short, descriptive label. "Search by name or email" is a hint, not a label. Every string uses sentence case. Parallel construction and a "None" option do not apply to a list of people. Two content issues remain: the toggle's name is inconsistent ([I-5](#i-5-fix-the-toggle-buttons-initial-name)), and the empty state could say more ([I-16](#i-16-demonstrate-a-templated-option-and-empty-state)).

## Where the mock is stronger: keep these

- Asynchronous states, Retry that preserves the loaded page, and paging that never duplicates a request.
- Contrast: every text and border token meets or exceeds its target. Fluent's side borders do not meet 3:1 on their own.
- Coalesced live announcements, the selected-values summary, and the assertive failure message.
- Chip keyboard navigation with RTL mirroring, and focus that follows chip removal.
- The selection limit, explained in the hint, in each option's detail text, and by announcement.
- The disabled-option cue is text ("· Account inactive") and a dashed checkbox, not grey text that fails contrast.
- Short-viewport positioning that keeps the focused input visible, and reflow at 320 CSS px.
- The Preview selector that shows every edge state. Fluent's guidance shows only the default path.

## Recommended improvements

Priorities:

- **P1** fixes an accessibility risk, or a place where the mock contradicts the L2 requirements or its detailed design.
- **P2** improves visual quality and closes gaps with Fluent's conventions.
- **P3** needs a decision and possibly an L2 change before the mock should show it.

Each item says what it affects: the mock alone, the detailed design, or L2.

### P1

#### I-1. Draw focus on the field, not the inner input

- **Observation.** The global `:focus-visible` rule draws a 3 px orange outline around the `<input>`, inside a field whose border turns green on `:focus-within`. The result is two nested rectangles in different colors. In the invalid state the orange box sits inside a red border. The design says the field "draws the border and, through `:focus-within`, the focus indicator."
- **Fluent.** One indicator for the whole root: a 2 px brand underline. The input itself sets `outline-style: none`.
- **Recommendation.** Remove the input's outline. Draw the focus-ring token on `.field:has(input:focus-visible)` (3 px, offset 2 px). Chip remove buttons and clear-all keep their own rings. Remove the green border change, so the field shows a single focus cue.
- **Affects.** Mock only.

#### I-2. Make clear-all unmistakable

- **Observation.** Clear-all is a bare "×" beside the chevron, in the place where most inputs put "clear search text." It stays visible while a query is typed and clears selections, not the text ([index.html:1245](index.html#L1245)). One click on it removes all 200 selections in the 200-selection state, with no way to undo. Its "×" is also the same glyph as every chip's remove button.
- **Fluent.** Does not offer clear in multiselect. `clearable` with `multiselect` logs an error.
- **Recommendation.** Keep clear-all, because L2-027 requires it, but give it visible text: "Clear all". Visible text also helps voice-control users (SC 2.5.3). Move it out of the input row, to the end of the chip list or beside the "2 learners selected" count, so it no longer reads as an input affordance. Consider a following "All selections cleared. Undo" status action. That would be an L2-027/L2-036 change.
- **Affects.** Mock; the design's template parts; L2 only if undo is adopted.

#### I-3. Place the popup after the input in the DOM

- **Observation.** `#popup` is the last child of `<body>`, and the input references it only through `aria-controls`. VoiceOver on iOS cannot swipe from the input to the options. L2-049 makes VoiceOver on iOS a release gate, and no design document addresses this.
- **Fluent.** Its guidance explicitly recommends `inlinePopup` for this reason: Safari does not support `aria-owns`.
- **Recommendation.** In the mock, move `#popup` inside `#combobox` directly after `.input-row`. It is already `position: fixed`, so the layout does not change. For production, L2-030 currently requires a CDK overlay, which renders into a shared container at the end of the body. Record an ADR choosing between in-place rendering (for example the native `popover` top layer, which keeps DOM order and still stacks above dialogs for L2-030 criterion 6) and the CDK overlay container with a documented iOS limitation. Also consider dropping `role="region"` from the wrapper. Fluent exposes the listbox directly, and the region adds a landmark only while the list is open.
- **Affects.** Mock; L2-030; open-and-position-list design.

#### I-4. Replace text-glyph icons with SVG

- **Observation.** The chevron is "⌄", which renders as a plain "v" in Inter and Segoe UI. Clear and remove are "×" and the checkmark is "✓". Their size and weight depend on the font. The design specifies "built-in inline SVG path icons [that] use currentColor and aria-hidden for chevron, loading, clear, and checkmark."
- **Fluent.** 20 px `ChevronDown` and `Dismiss` SVGs in `colorNeutralStrokeAccessible`.
- **Recommendation.** Inline SVG paths: a 20 px chevron, a 16 px dismiss and a 12 px check, all in `currentColor` with `aria-hidden="true"`.
- **Affects.** Mock only.

#### I-5. Fix the toggle button's initial name

- **Observation.** The markup names the toggle "Show learners" ([index.html:526](index.html#L526)). Script then changes it to "Hide options" and "Show options". L2-041 lists "Show options" and "Hide options".
- **Fluent.** A stable name ("Open {label}") with `aria-expanded` carrying the state. This matches the APG combobox examples.
- **Recommendation.** Make the initial markup "Show options". Optionally propose in L2-041 a stable name with `aria-expanded` in place of swapping names.
- **Affects.** Mock; L2-041 if the optional change is adopted.

#### I-6. Add the loading spinner

- **Observation.** The loading row is text only ("Loading learners…"). The design defines `span.t-combobox-spinner`, which is decorative and static under reduced motion.
- **Recommendation.** Show the spinner, in the field's icon area or in the loading row, next to the existing text. Animate it only under `prefers-reduced-motion: no-preference`.
- **Affects.** Mock only.

#### I-7. Make the disabled state perceivable

- **Observation.** In the Disabled preview, only the field background changes, to `#f4f7f5` (1.08:1 against white). The input text, placeholder, chips, remove buttons and icons look the same as when enabled. The host page's disabled "Preview assignment" button also looks enabled. Separately, the design's disabled-option cue is "italic text and a dashed checkbox border", but the mock's disabled options are not italic.
- **Fluent.** Disabled foreground and stroke colors on the text, border and icons, and `GrayText` in forced colors.
- **Recommendation.** Apply `--t-combobox-disabled-text` to the input, placeholder, chips and icons. Use a dashed or lighter field border, and mute the chips. Add italic text to disabled options as the design specifies. Style `.button:disabled`.
- **Affects.** Mock only.

#### I-8. Reconcile the mock with the design tokens

- **Observation.** The mock's custom properties (`--ink`, `--muted`, `--line`, `--soft`, `--accent`) do not use the design's `--t-combobox-*` names. The mock also uses colors the design does not define: `--soft` for the selected-row tint and chip fill, `--error`, `#cde4db` for icon hover, `#d8e2df` for dividers, and `white`. Two decisions conflict:
  - **Checkmark.** The design says "checkmark backgrounds use the surface token". The mock fills the checkbox with the accent color and draws a white mark.
  - **Chips.** The design gives chips the surface background, and its token table says chips use `--t-combobox-border`. The same document also says chips keep a `1px solid transparent` border. The mock uses a green fill and a visible border. The design contradicts itself here as well as the mock.
- **Fluent.** A filled brand checkbox with a white check.
- **Recommendation.** Rename the mock's properties to the design token names so the mock works as a live token reference. Adopt the filled checkbox (7.06:1, and a stronger cue than a mark on white) and update the design to match. Settle the chip border in the design and add any chip-fill and error tokens the mock keeps.
- **Affects.** Mock; present-accessibly design.

### P2

#### I-9. Flow the input after the chips

- **Observation.** The chip list is a block above a separate input row, so the input always has its own line. With two chips the field is 112 px tall. The design says the input "takes the free space in the last row of the field" and "falls to its own row when the chips fill a row."
- **Fluent.** Tags sit inline with the input, and the field stays one line high until the tags wrap.
- **Recommendation.** Make `.field` a wrapping flex container. Make the chip `<ul>` a shrinkable flex item and the input `flex: 1 1 8rem`. With one row of chips the input sits beside them. With more chips the list fills the width and the input drops below it. Keep the 8 rem chip-list maximum. Keep the `<ul>` (do not use `display: contents`, which can drop list semantics).
- **Affects.** Mock only.

#### I-10. Tighten option rows and the status footer

- **Observation.** Each option is 71 px tall with 4 px margins. The status footer ("6 of 24 learners" above a 44 px "Load more results" button) is 113 px. In the default open state at 1280 × 900, about three of the six loaded options are visible.
- **Fluent.** 6 × 8 px option padding, 4 px listbox padding, 2 px gaps.
- **Recommendation.** Use 0.5 rem × 0.75 rem option padding and 0.125 rem margins, about 63 px per two-line row. Put the count and a compact "Load more results" button on one footer line that wraps at narrow widths. About five options would then fit in the 24 rem popup. All lengths stay in rem, so 200% text still scales and targets stay above 24 px.
- **Affects.** Mock only.

#### I-11. Separate selected, active and hover

- **Observation.** Selected rows have a checkmark and a green tint. Hovering a selected row changes nothing (checked: the background stays `rgb(228, 242, 236)`), because `.option[aria-selected]` and `.option:hover` have equal specificity and the selected rule comes later. The row tint does not appear in the design's state-cue table. It can also look like a second "current row" next to the active outline.
- **Fluent.** Selection is shown by the checkbox only. Hover is a neutral background on every row. The active option gets an outline.
- **Recommendation.** Drop the selected-row tint, because the checkmark is the required non-color cue. Apply the hover background to every row under `@media (hover: hover)`, as the design specifies. Keep the active outline token. This meets L2-037 criterion 4 with fewer visual layers.
- **Affects.** Mock only.

#### I-12. Move the error message and add an icon

- **Observation.** The required error appears below the hint, in red text, with no icon, next to a 1 px red border.
- **Fluent.** The Field component puts the validation message directly under the control, before the hint, with an error icon.
- **Recommendation.** Order the parts field, error, then hint. Prefix the error text with an `aria-hidden` SVG error icon. `aria-describedby` already includes the message.
- **Affects.** Mock; the integrate-forms design if it fixes the order.

#### I-13. Stop the placeholder clipping at 320 px

- **Observation.** At 320 CSS px the input has 132 px of content width but the placeholder needs 174 px, so it shows as "Search by name or". At 200% text it needs 348 px and has 140 px. The two 44 px icon buttons take most of the room.
- **Recommendation.** Shorten the placeholder to "Name or email". Reduce the icon buttons to 2 rem (still above the 24 px minimum), or move clear-all out of the row as in [I-2](#i-2-make-clear-all-unmistakable). The hint already says everything the placeholder does, so any remaining clipping at 200% text loses no information.
- **Affects.** Mock only.

#### I-14. Reduce the field height and unify the radius

- **Observation.** The empty field is 62 px tall: a 44 px input plus 16 px of padding. It uses three different corner radii.
- **Fluent.** 32 px medium and 40 px large, with a 4 px radius throughout.
- **Recommendation.** Aim for a field about 40 px tall with 32 px chips, and keep at least 24 × 24 px targets with hit areas extended by padding. Optionally restore 44 px under `@media (pointer: coarse)`. Choose one radius for the field and popup, and one for chips and options.
- **Affects.** Mock; design layout rules.

#### I-15. Show the dark theme

- **Observation.** The design defines dark defaults (text `#f4f7f5`, surface `#18312e`, focus `#ffbf69`, and so on), but the mock renders only the light theme, so nobody can check dark-theme contrast or states.
- **Recommendation.** Add a Theme control (Light, Dark, System) to the Preview controls, driven by the renamed tokens from [I-8](#i-8-reconcile-the-mock-with-the-design-tokens).
- **Affects.** Mock only.

#### I-16. Demonstrate a templated option and empty state

- **Observation.** Fluent's examples use persona options (avatar, name, presence) and avatar tags. L2-042 defines `tComboboxOption`, `tComboboxChip` and `tComboboxEmpty`, but the mock shows only the default content. The default empty text "No results" gives no guidance.
- **Recommendation.** Add one Preview state with custom content: initials, name, and email or role, plus an empty template such as "No learners match “Zed”. Check the spelling or search by email." This tests the slot design without changing the defaults.
- **Affects.** Mock only.

### P3: decide before changing

#### I-17. Space toggles after arrow navigation

Fluent toggles the highlighted option on Space, but only when the user is navigating by keyboard. Otherwise Space types. Users of checkbox-style lists expect Space to toggle. The mock always types a space. Adopting Fluent's rule requires an L2-033 criterion and a design note.

#### I-18. Enter on a closed list

Fluent opens the list. The mock lets the browser submit the form. Keeping native submission is the simpler choice and matches text-input expectations, but L2-029 or L2-033 should state it so the production component does not differ by accident.

#### I-19. Page Up and Page Down

Fluent jumps through options. With paged results this would also give a faster way to reach "load more". Add it only if a requirement asks for it.

### Fluent features to leave out

These are Fluent capabilities that the L2 v1 decisions exclude, or that add code without a requirement. AGENTS.md asks for the least code that satisfies the criteria, so the mock should not show them:

- single-select mode, `freeform` entry and option groups (excluded in the L2 v1 decisions)
- Home and End navigating options (L2-033 criterion 10 keeps them for the caret, following APG)
- three sizes and four appearances. One size meets the requirements; add variants only when a consumer needs them.
- a field-level clear button for single select (not applicable)
- the underline focus animation. The design declares no motion by default, and reduced motion is respected either way.

## Next steps

1. P1 items that affect only the mock (I-1, I-2 visual part, I-3 DOM move, I-4 to I-7) can be done directly. Mocks are design artifacts, so AGENTS.md requires no ATDD and no tests for them.
2. I-3 (production popup placement) and I-8 (checkmark and chip tokens) need design updates. I-3 also needs an ADR and an L2-030 change.
3. P2 items are visual refinements and can be batched.
4. P3 items need an L2 decision first.
5. Any change to the mock, its guide, the specifications or the designs changes the SHA-256 fingerprint recorded in [the combobox design review](../../verification/combobox-design-review.md). Repeat that review after these changes.

## Resolution

Applied on 2026-10-03. The list below says, for each item, what changed and where. "Mock" is [index.html](index.html). "Design" is the [combobox detailed design](../../detailed-designs/combobox/). L2 is the [detailed requirements](../../specs/L2.md).

- **I-1, field focus ring.** The ring is drawn on the field while the input has focus; the input's own outline and the green border change are gone. Mock; design: present-accessibly, expose-to-assistive-tech.
- **I-2, clear-all.** Now a visible "Clear all selections" text button below the field, at the end of the hint row. No undo, by decision. Mock; design: present-accessibly, select-values, operate-by-keyboard.
- **I-3, popup DOM position.** The popup follows the field, and `role="region"` is gone. Production uses the CDK popover with `withPopoverLocation('inline')`. Mock; L2-030 criterion 7; design: open-and-position-list, verify-and-document; [ADR-0001](../../adr/frontend/0001-render-combobox-panel-as-inline-popover.md).
- **I-4, icons.** Inline SVG chevron, dismiss, check, spinner and error icons. Mock; design icon list.
- **I-5, toggle name.** The initial name is "Show options". The L2-041 strings are kept. Mock.
- **I-6, spinner.** A spinner sits in the field while a request is in flight; it is static unless the motion duration is overridden. Mock.
- **I-7, disabled state.** Dashed field, chip and button borders, the disabled-text token, and italic disabled options. Mock; design state cues.
- **I-8, tokens.** The mock uses the `--t-combobox-*` names. The checkbox is filled with the selected-mark token. `--t-combobox-chip-bg` and `--t-combobox-error` are added, and the contradictory chip-border sentence is removed. Mock; design: present-accessibly.
- **I-9, inline chips.** Chips and the input share the field's wrapping rows. Mock; design: present-accessibly, select-values.
- **I-10, density.** Options are about 60 px tall, and the status row is one line. A 24 rem panel shows at least five options. Mock; design default metrics.
- **I-11, state cues.** The selected-row tint is removed, and every row shows hover. Mock; design state cues.
- **I-12, error placement.** The error sits directly below the field, before the hint, with an icon; `aria-describedby` lists the error first. Mock; L2-031 criterion 9, L2-035 criterion 5; design: integrate-forms, expose-to-assistive-tech.
- **I-13, placeholder.** "Name or email" fits at 320 CSS px. Mock.
- **I-14, size and radius.** The empty field is 40 px tall. Coarse pointers get 2.75 rem targets. One radius is used for the field and panel, another for chips and options. Mock; design default metrics.
- **I-15, dark theme.** A Theme selector offers Light, Dark and System. Mock.
- **I-16, templates.** A Custom templates Preview state shows initials avatars and a guiding empty message. Mock.
- **I-17, Space.** Adopted: Space toggles after keyboard navigation. L2-033 criterion 15; design: operate-by-keyboard; mock.
- **I-18, Enter on a closed list.** The native submission is kept and is now stated in L2. L2-033 criterion 6; design: operate-by-keyboard.
- **I-19, Page Up / Page Down.** Adopted: they move by one visible page. L2-033 criterion 16; design: operate-by-keyboard; mock.

The combobox design review was repeated after these changes; see [the review record](../../verification/combobox-design-review.md).
