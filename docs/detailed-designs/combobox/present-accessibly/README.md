# Present the component accessibly

## Overview

`t-combobox` is a form control that lets a user search a data source by typing, select multiple results from a popup list, and see each selection as a removable chip. This feature specifies how the control looks and how pointer and touch input reach it. Users who see poorly, zoom the page, enlarge text, rely on high-contrast modes, avoid motion, or use a touch screen operate the same component as everyone else.

**Design token** — named CSS custom property that carries one visual decision, such as a color, so a theme changes it in one place

**Contrast ratio** — ratio of the relative luminance of two colors, from 1:1 (identical) to 21:1 (black on white)

**Forced-colors mode** — operating-system mode, such as Windows High Contrast, in which the browser replaces authored colors with a small set of system colors

**Reduced-motion preference** — operating-system setting that asks applications to avoid animation, exposed to CSS as `prefers-reduced-motion: reduce`

**Reflow** — rearrangement of content to fit a narrow viewport without horizontal scrolling

**Pointer target** — area that a mouse, pen, or finger activates

The feature applies WCAG 2.2 AA. The relevant success criteria are 1.4.1 (use of color), 1.4.3 and 1.4.11 (contrast), 1.4.4 (text resize), 1.4.10 (reflow), 1.4.12 (text spacing), 2.3.3 (animation, an additional AAA target), and 2.5.8 (target size). The feature has no logic beyond a few mouse handlers. Its design is the template structure, the style contract, and the rules that tie them together.

Keyboard operation, ARIA exposure, and list positioning belong to sibling features. The visual rules for focus indicators and for the active option follow from [Expose state to assistive technology](../expose-to-assistive-tech/).

## Description

The slice is the template and the stylesheet of `Combobox<T>`, plus the pointer handlers that keep focus on the input.

**Template parts.** Class names are proposed. Every interactive part is a native element, so the browser supplies its pointer and touch behavior.

| Part | Element and class | Notes |
|------|-------------------|-------|
| Field | `div.t-combobox-field` | Flex container with wrapping. Draws the border and, through `:focus-within`, the focus indicator. |
| Chip list | `ul.t-combobox-chips` of `li.t-combobox-chip` | Each chip holds `span.t-combobox-chip-label` and `button.t-combobox-chip-remove`. |
| Input | `input.t-combobox-input` | Takes the free space in the last row of the field. |
| Spinner | `span.t-combobox-spinner` | Decorative, `aria-hidden="true"`. Shown while a request is in flight. |
| Clear-all button | `button.t-combobox-clear` | Rendered while a value exists. |
| Toggle button | `button.t-combobox-toggle` | `tabindex="-1"`. Mouse and touch affordance. |
| Panel | `div.t-combobox-panel` in the CDK overlay | Holds the listbox and the status rows. Scrolls vertically inside the space the overlay grants. |
| Option | `li.t-combobox-option` | Holds `span.t-combobox-checkbox` (decorative) and the content. |

**Icons.** Built-in inline SVG path icons use currentColor and aria-hidden for chevron, loading, clear, and checkmark. No icon package or background image is needed. Loading always has text, and a static indicator is sufficient under reduced motion.

**Design tokens.** Light defaults: text #18312e, placeholder/disabled text #536763, surface #ffffff, border #657f73, focus #b35c14, active outline/selected mark #126454, and hover #f4f7f5. Dark defaults: text #f4f7f5, placeholder/disabled text #b6cbc3, surface #18312e, border #8fa9a0, focus #ffbf69, active outline/selected mark #8fd5ba, and hover #244b42. Checkmark backgrounds use the surface token. The chip area defaults to 8 rem and motion duration to 0 ms. Consumers may override tokens while retaining contrast targets.

| Token | Applies to | Target | Forced-colors value |
|-------|------------|--------|---------------------|
| `--t-combobox-text` | Input, chip label, option text, hidden summary | 4.5:1 against the surface | `CanvasText` |
| `--t-combobox-placeholder` | Placeholder text | 4.5:1 against the surface | `GrayText` |
| `--t-combobox-surface` | Field, chip, and panel background | Reference color for the text targets | `Canvas` |
| `--t-combobox-border` | Field, chip, panel, and checkbox borders; icons | 3:1 against the adjacent color | `ButtonText` |
| `--t-combobox-focus-ring` | Focus indicator of the field, chip remove buttons, and clear-all | 3:1 against the adjacent colors | `Highlight` |
| `--t-combobox-active-outline` | Outline of the active option | 3:1 against the surface | `Highlight` |
| `--t-combobox-hover-bg` | Hover background of an option | Distinct from the surface | `Canvas` |
| `--t-combobox-selected-mark` | Checkmark of a selected option | 3:1 against the checkbox background | `CanvasText` |
| `--t-combobox-disabled-text` | Text of a disabled option | 4.5:1, so no inactive-component exemption is relied on | `GrayText` |
| `--t-combobox-motion-duration` | Overlay and chip transitions | Not applicable | Not applicable |
| `--t-combobox-chip-list-max-height` | Chip-list height before it scrolls vertically, in `rem` | Not applicable | Not applicable |

The values above settle the default theme decision. A block under `@media (forced-colors: active)` reassigns the tokens in the right-hand column. The component code therefore needs no second set of rules for forced-colors mode (`L2-038` criterion 4). The field, chip, checkbox, and panel use real `border` declarations, because `box-shadow` is removed in forced-colors mode. A transparent border still appears there, so chips keep a `1px solid transparent` border in the normal themes. The focus indicator and the active outline use `outline`, which forced-colors mode keeps. The panel carries a border in every mode, because its elevation shadow disappears.

**State cues beyond color (`L2-038` criterion 2).**

| State | Color cue | Non-color cue |
|-------|-----------|---------------|
| Selected | `--t-combobox-selected-mark` | Checkmark inside the checkbox; `aria-selected="true"` |
| Active | `--t-combobox-active-outline` | 2 px outline inset on the option row |
| Hover | `--t-combobox-hover-bg` | Background change under `@media (hover: hover)` only |
| Disabled | `--t-combobox-disabled-text` | Italic text and a dashed checkbox border; `aria-disabled="true"` |

The disabled treatment is a default. It remains distinct from the other three states in each theme.

**Reduced motion (`L2-038` criterion 3).** The base styles declare no transition and no animation. Overlay opening, overlay closing, chip entry, chip removal, and the spinner rotation are declared only inside `@media (prefers-reduced-motion: no-preference)`, with the duration read from `--t-combobox-motion-duration`. Under `reduce`, those rules do not apply, so nothing runs for longer than 0 ms and the spinner shows as a static icon. The loading row also carries text. Scrolling the active option into view is instant under every preference. Hover rules sit under `@media (hover: hover)`, so a tap on a touch screen leaves no sticky hover state.

**Layout rules (`L2-039`).** One stylesheet serves every width. It has no breakpoints, and no script switches the template by width, so a resize changes styles only.

- `t-combobox` is `display: block` with `max-width: 100%` and `min-width: 0`. The chip area and input row use wrapping flex layouts. Their children have `min-width: 0`, so a long child shrinks rather than overflows.
- The input takes `flex: 1 1` with a `rem` basis, so it falls to its own row when the chips fill a row, and it stays visible at 320 CSS px.
- `.t-combobox-chip` has `max-width: 100%`. `.t-combobox-chip-label` has `overflow: hidden`, `text-overflow: ellipsis`, and `white-space: nowrap`. This ellipsis is the single documented truncation. The full label stays available as the text content, as the name of the remove button, and as a tooltip. The dismissible, hoverable tooltip mechanism is defined in [Select values](../select-values/).
- Option text wraps with `overflow-wrap: anywhere`. Options and status rows never truncate.
- Lengths use `rem` and `em`, so text and spacing scale with the user's text size. No text container sets a fixed `height` or a pixel `line-height`. Rows use `min-height` only. At 200% text and under the text-spacing overrides (line height 1.5, paragraph spacing 2, letter spacing 0.12, word spacing 0.16 times the font size), rows grow, and nothing clips or overlaps.
- The panel has `overflow-y: auto` and a `max-height` bounded by the room the overlay grants. At 400% zoom in a 1280 by 1024 window, the viewport is 320 by 256 CSS px, and the list scrolls inside the panel. The page does not scroll horizontally. [Open and position the list](../open-and-position-list/) sizes the overlay and keeps the focused input visible.
- A resize or a zoom change reflows CSS only. The `ResizeObserver` in `ComboboxPopup` updates the overlay width and position. The component keeps `value`, `query`, and `isOpen`, and no DOM node is recreated, so the typed text, the selection, and the focused input persist (`L2-039` criterion 6).

**Target size (`L2-039` criterion 5).** The chip remove button, the clear-all button, the toggle button, and each option set `min-width: 24px` and `min-height: 24px`. These minimums use CSS pixels because the criterion is stated in CSS pixels. Surrounding padding uses `rem`. Options span the full panel width. The glyph of a button may be smaller than its target.

**Pointer and touch handling (`L2-040`).**

- `Combobox<T>.onKeepFocusMousedown(event)` prevents a default focus change on options and popup actions for mouse and compatibility events. Touch pointerdown is not cancelled, so native drag scrolling remains available. A completed touch click toggles once and synchronously restores input focus. Toggle and clear-all use this policy. Chromium touch emulation checks focus; the manual device matrix checks the real on-screen keyboard.
- The option template binds `click` to `Combobox<T>.toggle(item)`, the single entry point specified in [Select values](../select-values/). A touch scroll raises no `click`, so dragging the list never toggles an option. The list stays open and the input keeps focus (`L2-040` criterion 1).
- The clear-all and remove buttons bind `click` to `clearAll()` and `removeChip(item)`. Their focus rules come from `L2-027`. The toggle button's `click` behavior comes from [Open and position the list](../open-and-position-list/). Each button meets the 24 px target (`L2-040` criterion 2).
- Outside taps use the path that outside clicks use. `ComboboxPopup.outsidePointerEvents` relays the CDK `OverlayRef` stream, and `Combobox<T>` calls `close()` unless the target lies inside the host element or the overlay pane ([Open and position the list](../open-and-position-list/)). A tap raises a `click`, and the CDK dispatcher includes a workaround for iOS Safari, so a tap on a non-interactive area closes the list (`L2-040` criterion 3).

**Acceptance tests.** `ComboboxDemoPage` owns the selectors. Tests run in Chromium only. Each viewport width from the criterion is set on the page. Automated reflow uses a 320 by 256 CSS px viewport. This is not actual browser zoom; the manual procedure also checks Chrome at real 400% zoom in a 1280 by 1024 window. The 200% text case sets the root font size to 200%. The text-spacing case injects a stylesheet with the four override values. Reduced motion and forced colors use Playwright media emulation. The contrast test reads computed colors for each state against the adjacent color. The target test reads `boundingBox()` for each target. Touch tests use a context with touch enabled and `tap()`, and assert that `document.activeElement` stays the input. Manual verification of forced-colors mode, zoom, and touch screen readers belongs to [Verify and document](../verify-and-document/).

**Acceptance criteria coverage.**

| Criterion | Where the design satisfies it |
|-----------|-------------------------------|
| `L2-038` 1 | Design tokens and their targets; the contrast test |
| `L2-038` 2 | State cue table |
| `L2-038` 3 | Reduced-motion rules |
| `L2-038` 4 | Forced-colors token block; borders and outlines |
| `L2-039` 1, 2 | Wrapping field; no breakpoints; panel scrolling |
| `L2-039` 3, 4 | Relative units; no fixed heights; the documented chip ellipsis |
| `L2-039` 5 | 24 px minimum on each target |
| `L2-039` 6 | CSS-only reflow; `ResizeObserver` updates the overlay |
| `L2-040` 1 | `onKeepFocusMousedown`; `toggle(item)` on `click` |
| `L2-040` 2 | Click handlers and the 24 px targets |
| `L2-040` 3 | `outsidePointerEvents` |

## Requirements

Source: [L2 detailed requirements](../../../specs/L2.md). The table quotes source wording exactly, including its use of `must`.

| L2 ID | Refines (L1) | Requirement |
|-------|--------------|-------------|
| `L2-038` | `L1-015` | The combobox's colors, states, motion, and forced-colors rendering must conform to WCAG 2.2 AA. |
| `L2-039` | `L1-015` | The combobox must remain fully usable at extra-small, small, medium, large, and extra-large viewport widths, at up to 400% browser zoom, with enlarged text, and with text-spacing overrides, without horizontal scrolling or loss of content or functionality. Pointer targets must be at least 24 by 24 CSS pixels. |
| `L2-040` | `L1-015` | Touch interaction must toggle options without dismissing the on-screen keyboard. |

## Diagrams

The context view shows the user, the host application, and the browser and operating system that supply zoom, text size, forced colors, reduced motion, and the on-screen keyboard.

![C4 context: Present the component accessibly](diagrams/c4-context.png)

The container view places `@tessera/combobox` and Angular CDK inside the host application, beside the browser settings that the stylesheet reads through media features.

![C4 containers: Present the component accessibly](diagrams/c4-container.png)

The component view shows the template, the stylesheet with its token contract, the option directive, and the popup. The CDK overlay supplies outside-click events and positioning.

![C4 components: Present the component accessibly](diagrams/c4-component.png)

The class view records the template parts, the pointer handlers, and the style contract that holds the tokens and the media-feature blocks.

![Class structure: Present the component accessibly](diagrams/class-structure.png)

The first sequence follows a touch user. A tap on an option toggles it while the on-screen keyboard stays open, and a tap outside closes the list.

![Sequence diagram: Operate the list by touch](diagrams/sequence-touch.png)

The second sequence follows changes in the environment: a resize or zoom with the list open, the reduced-motion preference, and forced-colors mode. Each change alters styles only and preserves the component state.

![Sequence diagram: Adapt to viewport, motion, and color settings](diagrams/sequence-adapt-environment.png)
