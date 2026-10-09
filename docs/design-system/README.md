# Tessera design system

Extracted from [the HTML mocks](../mocks/) on 9 October 2026 ([SCORM player](../mocks/scorm-player/index.html), [combobox](../mocks/combobox/index.html), [video player](../mocks/video-player/index.html)) and aligned with the values shipped in [`@tessera/theme`](../../src/theme/README.md). Open [index.html](index.html) in a browser; the pages need no build or server.

The system documents every decision a Figma kit would hold (tokens, type, colour with contrast, grid, elevation, motion, and every component with anatomy, variants, sizes, states, responsive and accessibility notes) as HTML that engineers can lift CSS from directly. Both themes pass WCAG 2.2 AA for every declared pair.

## Foundations

| Page | Covers |
| --- | --- |
| [Color](foundations/color.html) | Sage, teal, orange, red and blue ramps; semantic roles; status and media colours; both themes; every contrast pair with live ratios; adding a brand theme |
| [Typography](foundations/typography.html) | Inter stack, nine sizes (12 to 40px), four weights, line heights, letter spacing, twelve role shorthands, measure |
| [Spacing](foundations/spacing.html) | The 4px scale (0 to 96px), inside and between rules, padding by component size |
| [Layout](foundations/layout.html) | Five breakpoints, columns, gutters, margins, container, measure, sidebar and topbar, page templates, the wrapping sidebar |
| [Elevation](foundations/elevation.html) | Four shadows and the focus shadow, surface hierarchy, z-order, dark elevation |
| [Shape](foundations/shape.html) | Five radii plus pill, border widths, the 4px status stripe |
| [Motion](foundations/motion.html) | Five durations, three loops, five easings, choreography, reduced motion |
| [Iconography](foundations/iconography.html) | Stroke style, sizes, labelling, every icon used in the mocks |
| [Theming](foundations/theming.html) | `data-theme`, system preference, forced colours, token tiers, `tokens.json`, map to `@tessera/theme` |
| [Responsive](foundations/responsive.html) | Mobile first from 320px, 400% zoom, 200% text, text spacing, touch, testing matrix |
| [Accessibility](foundations/accessibility.html) | WCAG 2.2 AA commitments, screen reader matrix, component contract, target and focus tokens |
| [Content](foundations/content.html) | Voice, casing, verbs, numbers and times, error and empty formulas, announcements, microcopy library |

## Components

| Component | Variants | States | Source mocks |
| --- | --- | --- | --- |
| [Button](components/button.html) | primary, secondary, ghost, link, danger; icon, icon-only, block; sm, md, lg | hover, focus, active, disabled, aria-disabled, loading, pressed | SCORM, combobox, video |
| [Button group](components/button-group.html) | segmented, toolbar; sm, md | pressed | video (derived) |
| [Link](components/link.html) | inline, standalone, external | hover, focus, visited | all |
| [Menu](components/menu.html) | icons, shortcuts, sections, danger, checkable | active item, disabled, checked | derived |
| [Form field](components/form-field.html) | label, required, hint, error, counter | invalid | combobox |
| [Text field](components/text-field.html) | text, email, password, number, search, addons, counter; sm, md, lg | hover, focus, disabled, invalid, read-only, required | combobox (derived) |
| [Textarea](components/textarea.html) | auto-grow, counter | invalid, read-only, disabled | derived |
| [Select](components/select.html) | native, placeholder; sm, md, lg | hover, focus, disabled, invalid | all (state selectors) |
| [Combobox](components/combobox.html) | multi with chips, async, custom template | open, loading, no results, errors, limit, disabled, invalid | combobox |
| [Checkbox](components/checkbox.html) | single, group, description, card | checked, indeterminate, invalid, disabled | combobox |
| [Radio group](components/radio-group.html) | vertical, horizontal, card | checked, invalid, disabled | derived |
| [Switch](components/switch.html) | label start or end, description | on, off, disabled | derived |
| [Slider](components/slider.html) | value label, ticks | focus, disabled | video (volume) |
| [Form layout](components/form-layout.html) | one and two columns, inline, actions, error summary | submitting | combobox |
| [Top bar](components/top-bar.html) | title, nav, actions, compact | current | all |
| [Sidebar navigation](components/sidebar-navigation.html) | grouped, collapsible, badges, collapsed | current, expanded | SCORM (derived) |
| [Tabs](components/tabs.html) | underline, pill, counts, scrollable; sm, md | selected, disabled | derived |
| [Breadcrumb](components/breadcrumb.html) | full, collapsed | current | derived |
| [Pagination](components/pagination.html) | numbered, previous/next, summary | current, disabled | derived |
| [Stepper](components/stepper.html) | vertical outline, horizontal | current, complete, locked, error | SCORM |
| [Skip link](components/skip-link.html) | single | focused | SCORM, video |
| [Card](components/card.html) | default, interactive, header/footer, media, selected | hover, focus, selected | all |
| [Dialog](components/dialog.html) | default, destructive, form, scrollable, sheet; sm, md, lg | busy, invalid, failed | video (derived) |
| [Tooltip](components/tooltip.html) | text, shortcut | visible | combobox |
| [Divider](components/divider.html) | horizontal, vertical, labelled | none | all |
| [Container, grid and stack](components/layout-grid.html) | container, grid, auto grid, stack, cluster, sidebar layout, page header | none | SCORM, all shells |
| [Table](components/table.html) | default, dense, sortable, selectable, row actions, sticky header | loading, empty, error, hover, selected | derived |
| [List](components/list.html) | simple, two-line, avatar, interactive, divided | hover, selected, current | video, combobox |
| [Description list](components/description-list.html) | grid, vertical, inline | none | SCORM, video |
| [Avatar](components/avatar.html) | initials, icon, image, group, status, square; sm, md, lg | none | combobox |
| [Badge](components/badge.html) | neutral, info, success, warning, danger, solid, count, dot | none | SCORM |
| [Chip](components/chip.html) | removable, filter, static; sm, md | hover, focus, selected, disabled | combobox |
| [Alert](components/alert.html) | neutral, info, success, warning, danger, banner, actions, dismissible | none | SCORM, video |
| [Inline message](components/inline-message.html) | hint, error, success, warning | none | combobox |
| [Toast](components/toast.html) | four tones, action, stacked, media pill | leaving | video |
| [Progress bar](components/progress-bar.html) | determinate, indeterminate, success, danger | none | SCORM |
| [Spinner](components/spinner.html) | sm, md, lg, inline, on media | none | combobox, video |
| [Skeleton](components/skeleton.html) | text, title, circle, rect, composed | none | video |
| [Empty state](components/empty-state.html) | first run, no results, permission, error; compact, full | none | combobox, video |
| [Error page](components/error-page.html) | 404, 403, 500, offline, maintenance | none | derived |
| [Video player](components/video-player.html) | connecting, live, paused, buffering, reconnecting, ended, errors, autoplay blocked, captions | hover, focus, pressed, disabled, behind live | video |
| [SCORM player](components/scorm-player.html) | loading, ready, locked, completed, error, outline collapsed | current lesson, aria-disabled Continue | SCORM |

## Patterns

| Pattern | Covers |
| --- | --- |
| [Forms](patterns/forms.html) | Layout, label placement, validation timing, error summary, submit states, destructive confirmation |
| [Feedback and loading](patterns/feedback-and-loading.html) | Which feedback for which action; skeleton, spinner or progress; delayed announcements; undo |
| [Empty and error states](patterns/empty-and-error-states.html) | Copy formulas, Retry that preserves loaded data, terminal errors |
| [Navigation and page structure](patterns/navigation.html) | Shell, page header, course outline, breadcrumbs, tabs, landmarks, skip link |
| [Dialogs and overlays](patterns/dialogs-and-overlays.html) | Dialog, drawer, popover, inline popup or tooltip; stacking; mobile sheets; focus return |
| [Data tables and lists](patterns/data-tables-and-lists.html) | Density, sorting, selection, bulk actions, paging versus load more |
| [Notifications](patterns/notifications.html) | Toast, banner, inline alert or live region; coalescing; timing |
| [Content and tone](patterns/content-and-tone.html) | Composing copy across headings, notices, dialogs and empty states |

## Tokens

- [`tokens/tokens.css`](tokens/tokens.css): the source of truth. Primitives (`--palette-*`, `--font-*`), semantic tokens (`--color-*`, `--text-*`, `--space-*`, `--radius-*`, `--shadow-*`, `--duration-*`, `--ease-*`, `--z-*`, `--layout-*`, `--target-*`, `--control-height-*`), light on `:root`, dark on `[data-theme="dark"]` and under `prefers-color-scheme: dark`, plus reduced-motion, more-contrast and forced-colors overrides.
- [`tokens/tokens.json`](tokens/tokens.json): DTCG export generated from `tokens.css`; theme overrides are under `$extensions`.
- [`tokens/contrast-pairs.json`](tokens/contrast-pairs.json): every foreground and background pairing the components rely on, with its minimum ratio.
- [`assets/components.css`](assets/components.css): the product stylesheet. Component tokens (`--btn-*`, `--field-*`, `--combobox-*`, `--media-*`, …) alias semantic tokens; no raw colours.
- `assets/ds.css` and `assets/ds.js` style and drive these documentation pages only.

The shipped `@tessera/theme` package exposes the same decisions under `--t-*` names; [Theming](foundations/theming.html) maps each one.

## Drift found in the mocks

| Mock | Issue | Resolution |
| --- | --- | --- |
| all | Font sizes 0.76, 0.8, 0.8125, 0.85, 0.87, 0.9 and 0.91rem | Snapped to `--font-size-xs` (12px) or `--font-size-sm` (14px) |
| SCORM, video | Panel titles 1.1 and 1.15rem; display sizes 1.4 and 1.6rem | `--font-size-lg` (18px); `--font-size-2xl` (24px) and `--font-size-3xl` (28px) |
| all | Font weight 750 alongside 700 | 700 (`--font-weight-bold`); 750 renders as 700 in every fallback font |
| all | Button and select radii 6px (combobox) and 7px (SCORM, video) | `--radius-md` (8px), matching `@tessera/theme` `borderRadiusMedium` |
| video | `999px` pill radius | `--radius-full` |
| SCORM | One-off hover backgrounds `#f2f6f3` and `#f1f6f3` | `--color-bg-subtle` (`#f4f7f5`) |
| SCORM | Button border `#7f978d` and lesson ring `#8fa9a0` in light | `--color-border-strong` (`#657f73`) |
| SCORM | State-panel dashed border `#aabeb5` | `--color-border-strong` (demo chrome only) |
| all | Off-grid spacing 0.15, 0.2, 0.3, 0.35, 0.4, 0.45, 0.55, 0.6, 0.65, 0.7, 0.8, 0.9, 1.2 and 1.3rem | Snapped to the 4px scale |
| all | Focus outline offset 3px on page controls, 2px on the combobox field and media controls | One ring: 3px `--focus-ring-width`, 2px `--focus-ring-offset` |
| all | Breakpoints 40em and 47.5em written as `max-width` | `--layout-breakpoint-sm` (40rem) and `--layout-breakpoint-md` (48rem), mobile first |
| combobox | Field 40px tall beside 44px buttons | `--control-height-md` (44px) for both |
| video | LIVE dot `#ff6b57` is 2.79:1 on the control scrim over a white frame | `--color-media-live` uses `#ff8a78` in both themes (3.5:1 or better) |
| video, SCORM | Error stripe 5px, notice stripe 4px | `--border-width-stripe` (4px) |
| combobox, video | Letter spacing 0.08, 0.06 and 0.04em; −0.035 and −0.04em | `--letter-spacing-wide` (0.06em), `--letter-spacing-tight` (−0.04em) |
| combobox | `--t-combobox-motion-duration: 0ms` (and `@tessera/theme` `durationNormal: 0ms`) disable motion for everyone | Durations come from `--duration-*`; `prefers-reduced-motion` zeroes them |
| SCORM, video, combobox | Containers 1440px and 72rem | `--layout-container-max` 90rem (1440px) |
| combobox, SCORM | Two disabled treatments: faint border, or dashed border | Dashed edge with readable `--color-fg-disabled` text |
| combobox, video | `.sr-only` implemented with `clip` and with `clip-path` | `.visually-hidden` with `clip-path: inset(50%)` |
| all | Host-page and component colours declared separately (`--page-*`, `--ink`, `--t-*-*`) with the same values | One semantic layer; component tokens alias it |
| combobox, video | Dark `--page-accent-soft` (`#244b42`) used for both hover and selected, so selected rows, current items and chips looked the same as hovered ones | Dark `--color-accent-subtle` is `--palette-teal-850` (`#0f4a3d`); `--color-bg-subtle` keeps `#244b42` |
| SCORM, video | Skip links targeted `#player` and a `<div>`; combobox mock had none | Every page's skip link targets `<main id="main">` |
| SCORM | "Next →" and "← Previous" with typed arrows | "Continue" and "Previous" with `aria-hidden` chevron icons |
| SCORM | Typed "←", "→" and "✓" characters as icons | Stroke icons (chevron-left, chevron-right, check) |
| video | "Captions on" icon strokes its cut-out in fixed `#000` | Cut-out uses `--color-media-bg` |
| video | Caption background 75% black in the mock, 85% in the shipped package | `--color-media-caption-bg` keeps the mock's 75%; reconcile with the package before the next release |
| combobox | Required marked by a visually hidden asterisk only | Visible "(required)" in the label text, plus `aria-required` |
| combobox, video | "could not" and "couldn't" both used in messages | Contractions ("couldn't") per [Content](foundations/content.html) |
| combobox, video | Spinners only animate under `prefers-reduced-motion: no-preference` (frozen otherwise) | Status spinners slow to 2 s per turn under reduced motion; decorative loops stop |

Values the mocks do not contain are derived and marked as such in `tokens.css`: the blue information ramp, deep status backgrounds for the dark theme, accent active and subtle-hover steps, the sunken and raised surfaces, `--shadow-1` and `--shadow-4`, `--duration-slow` and `--duration-deliberate`, and `--ease-spring`.

## Verification

Run on 9 October 2026 from the repository root.

| Check | Command | Result |
| --- | --- | --- |
| Structure, sections, labels, names, links, raw colours, index and README coverage | `python .claude/skills/extracting-design-systems/scripts/check_design_system.py docs/design-system` | Exit 0: 63 pages (12 foundations, 42 components, 8 patterns, index), 0 errors, 0 warnings |
| Contrast, both themes | `python .claude/skills/extracting-design-systems/scripts/check_contrast.py docs/design-system/tokens/tokens.css` | Exit 0: 168 pairs passed, 0 failed, 0 unresolved |
| DTCG export | `python .claude/skills/extracting-design-systems/scripts/tokens_to_json.py docs/design-system/tokens/tokens.css` | Wrote `tokens.json` (271 entries) |
| Token coverage | Script over `foundations/*.html` `data-token` cells | All 214 tokens in `tokens.css` appear on exactly one foundation page |
| Reflow | Headless Chromium (Playwright) on all 63 pages at 320, 360 and 1280 CSS px, light and dark | No horizontal page scroll and no script errors (378 renders). Wide state matrices and tables scroll inside their own wrappers by design |
| Visual review | Screenshots of the index, Button, Combobox, Video player, SCORM player and Color pages | Fixed during review: a light-theme panel inside a dark page rendered dark (added an explicit `[data-theme="light"]` block), a preview button inherited muted text, table code and scale rows overflowed at 320px, a fixed-width stepper demo overflowed, the docs skip link was unreadable on focus |
| Mocks loop | A scratch copy of each mock with `tokens.css` and `components.css` linked ahead of its own styles, compared with the original at 1280px | Renders identical: no class collisions break the mocks. The mocks still use their own `--page-*` and `--t-*` properties; the drift table above maps them to system tokens. Moving the mocks onto system classes is follow-up work, and the mocks were not modified |

Not verified here: screen reader output (JAWS, NVDA, VoiceOver, TalkBack, Narrator), real 400% browser zoom, forced-colors mode on Windows, and real touch devices. Follow [manual screen reader verification](../verification/manual-screen-reader-verification.md) before relying on a component page's announcements. The live ratios on each page compute translucent media colours over white, the worst case for a scrim over a bright video frame.

Known limits of the documentation pages: anatomy callouts are placed by percentage and drift at phone widths (the numbered list beside them stays authoritative), and pointer states are forced with `data-state`, so native widgets such as checkboxes and range inputs show their browser-drawn hover only on real hover.
