# Expose state to assistive technology

## Overview

`t-combobox` is a form control that lets a user search a data source by typing, select multiple results from a popup list, and see each selection as a removable chip. Screen reader users receive the same information as sighted users only if the component exposes its structure, state, and changes in a form that assistive technology reads. This feature specifies that exposure.

**Assistive technology** — software that adapts a user interface for a person with a disability, such as a screen reader

**Accessibility tree** — browser representation of the page that assistive technology reads, built from elements, roles, and ARIA attributes

**ARIA attribute** — markup attribute from the WAI-ARIA specification that adds role, state, or property information to an element

**Live region** — visually hidden element whose text changes assistive technology reads aloud without moving focus

**Active descendant** — option that the input names through `aria-activedescendant` while DOM focus stays on the input

The feature covers three concerns. The first is the roles, states, and properties of the combobox input with its documented multi-select extension (`L2-035`). The second is the messages the component writes to a live region (`L2-036`). The third is the focus rules that keep DOM focus on the input and keep the active option visible (`L2-037`). The consuming application supplies an accessible name and accessible template content. The component owns the input and `role="option"` hosts, their ARIA attributes, focus management, and announcements.

Key handling, searching, selection state, and visual styling belong to sibling features. They appear here as the sources of the state this feature exposes.

## Description

`Combobox<T>` binds input, listbox, chip-list, button, summary, and live-region semantics in `combobox.html`. `ComboboxOption` owns each option's role, generated identifier, ARIA state, and active class. Consumer slots supply content inside these hosts.

**Names and relationships.** The consumer supplies a visible `<label for>` associated with `inputId`, or an `ariaLabel`. `listLabel()` uses `ariaLabel` when truthy; otherwise it joins the trimmed text of the input's associated native labels. The listbox uses this text through `aria-label`. The component does not assign IDs to consumer labels or use `aria-labelledby` on the listbox.

In development mode, `afterNextRender` checks that `listLabel().trim()` is non-empty. Failure throws `Combobox: an accessible name is required. Supply a visible label through inputId or ariaLabel.` The check runs once after the initial render. Production builds omit this diagnostic; the consumer still supplies the accessible name.

| Element | Semantics |
|---------|-----------|
| Input | `role="combobox"`, `aria-autocomplete="list"`, native `autocomplete="off"`, and explicit true/false expanded, required, and invalid states |
| Input relationships | `aria-controls` references the list only while open; `aria-activedescendant` references the active host only while open and an option exists |
| Input description | Error ID when visible with text, then hint ID when supplied, then selected-summary ID when selections exist; no empty reference list |
| Listbox | `role="listbox"`, `aria-multiselectable="true"`, label text through `aria-label`, and explicit true/false `aria-busy` |
| Option | `role="option"`, generated ID, explicit true/false `aria-selected` and `aria-disabled`; optional set size and one-based position |
| Chips | Native list labelled Selected values; an empty list remains in the template and CSS hides it |
| Chip remove button | Remove {label}, using the full `displayWith(item)` label |
| Clear-all | Visible localised Clear all selections text, rendered only with a non-empty value |
| Toggle | Localised Show options or Hide options name; `tabindex="-1"` |

`summary` computes the localised `selectedSummary` text from count and labels joined by `labelSeparator`. The hidden summary renders only with selections. IDs use a component counter for input, list, hint, error, summary, and tooltip, plus an independent option counter. The formats are detailed in [Secure and perform](../secure-and-perform/).

**Announcement ownership.** Each component creates one `ComboboxAnnouncer` with its `DestroyRef`. The announcer owns `message` and `priority` signals and queued text; the component template owns the single visually hidden live-region element outside the popup. It exists before messages are inserted and has `aria-atomic="true"`. `Combobox<T>` resolves and formats all localised messages before calling `search(text)`, `selection(text)`, or `failure(text)`. The announcer neither injects strings nor creates DOM.

| Event | Message policy |
|-------|----------------|
| First page | Loaded page count, with singular/plural keys; an empty page uses No results found. |
| Appended page with items | Appended item count, with singular/plural keys |
| Request still pending after 1 s | Loading results., queued only if the popup is open at the timer callback |
| Request failure | Results could not be loaded., assertive |
| User addition | {label} selected. {n} selected in total., with a singular-total key |
| Deselection or chip removal | {label} removed. |
| Clear-all | All selections cleared. |
| Limit reached | Maximum of {max} selections reached., after an addition reaches the limit and on opening at the limit |

Search success and failure call the announcer only while open. Programmatic value writes announce nothing. A loading timer belongs to each request and clears in `finalize`, including cancellation or destruction. Closing discards queued search messages but leaves the request and its timer running; the timer checks open state before queueing. An empty appended page has no loaded-count announcement.

**Queue policy.** A 150 ms quiet window coalesces search text to the most recent message and preserves selection messages in order. A flush joins the search message followed by selection messages with spaces. `cancelSearch()` removes pending search text, including a scheduled write, while retaining selections. Query edits, composition, configuration changes, close, and disable call it.

Each write clears the region and sets priority, then inserts text after 32 ms so repeated text can be announced after a rendered empty state. Failure bypasses the quiet window, cancels search text, and writes assertively through the same 32 ms step. Selections already waiting for insertion return to the polite queue. Destruction clears both timers; the Angular view removes the region. These timings describe DOM updates; observed speech timing remains subject to manual verification.

**Focus and visibility.** The key manager's `change` stream updates `activeIndex`; `activeOptionId` reads the current option's ID. Disabled options remain navigable but cannot toggle. `ComboboxOption.setActiveStyles()` compares option and listbox bounds and adjusts only listbox `scrollTop`. Pointer activation restores input focus synchronously, and option mousedown prevents a mouse focus change.

The field uses `:has(.t-combobox-input:focus-visible)` for its outline; buttons use `:focus-visible`. Active outline, selected checkmark, and hover background remain distinct. Popup options have no Tab stops, status actions have `tabindex="-1"`, and Tab follows browser order. Tooltip-first Escape, chip focus, popup-action focus restoration, and disabled-state exceptions follow [Operate by keyboard](../operate-by-keyboard/).

The design combines combobox input focus with a multi-select listbox. It does not establish screen reader compatibility by itself. The [manual release matrix](../../../verification/combobox-screen-reader-matrix.md) records speech, dialog exposure, and touch reading order separately from automated checks.

## Requirements

Source: [L2 detailed requirements](../../../specs/L2.md). The table quotes source wording exactly, including its use of `must`.

| L2 ID | Refines (L1) | Requirement |
|-------|--------------|-------------|
| `L2-035` | `L1-014` | The input, listbox, options, chips, and buttons must expose the roles, states, and properties of the WAI-ARIA 1.2 combobox pattern, and the component must own the `role="option"` host so consumers cannot break the pattern. |
| `L2-036` | `L1-014` | The component must announce changes through one instance-owned visually hidden live region that exists before any message is written and lives outside the popup. It is polite by default and assertive for failures. Search announcements must be coalesced so rapid typing does not flood the queue; selection messages must not be lost. |
| `L2-037` | `L1-014` | DOM focus must stay on the input while the user navigates options, the active option must be scrolled into view, and every focusable control must show a visible, high-contrast focus indicator. |

## Diagrams

The context view shows the screen reader user, the host application with `t-combobox`, the data source behind `searchFn`, and the assistive technology that reads the accessibility tree.

![C4 context: Expose state to assistive technology](diagrams/c4-context.png)

The container view places `@tessera/combobox` and Angular CDK in the host application. The CDK supplies the active-descendant key manager; the package owns its live region.

![C4 containers: Expose state to assistive technology](diagrams/c4-container.png)

The component view shows which parts write ARIA state and which parts raise announcements. `ComboboxAnnouncer` is the only writer to the instance live region.

![C4 components: Expose state to assistive technology](diagrams/c4-component.png)

The class view records derived ARIA values, option state, the signal-backed message queue, and template ownership of the live region.

![Class structure: Expose state to assistive technology](diagrams/class-structure.png)

The first sequence follows a search from typing to the polite results message, including the delayed loading message, the assertive failure message, and the silent cases.

![Sequence diagram: Announce search outcomes](diagrams/sequence-announce-search.png)

The second sequence follows the active option and a selection. It shows `aria-activedescendant`, the scroll into view, the joined selection and limit messages, and the unchanged focus.

![Sequence diagram: Expose the active option and announce selection changes](diagrams/sequence-active-option-selection.png)
