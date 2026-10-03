# Operate by keyboard

## Overview

`t-combobox` is the form control of the `@tessera/combobox` package. A user searches a data source by typing, selects multiple results from a popup list, and sees each selection as a removable chip. This feature specifies how the keyboard operates every part of that control, in left-to-right and right-to-left layouts.

**Active option** — option in the popup list that is the current target of keyboard actions while DOM focus stays on the input

**Active descendant** — WAI-ARIA mechanism in which the input names the active option through `aria-activedescendant`, so the screen reader follows the active option without receiving focus

**Remove button** — button inside a chip that removes that chip's value

**Error row** — status row at the end of the list that reports a failed request and offers a Retry action

**Right-to-left layout** — layout in which the inline start edge is the right edge, as in Arabic and Hebrew

DOM focus rests on the input while the user navigates options. The input handles each key and moves the active option by keyboard, so the user needs no pointer. Chips sit before the input in the field, and the remove button of each chip is a second place that holds focus. The feature extends the WAI-ARIA Authoring Practices combobox input-focus model with a multi-select listbox and applies the v1 decisions of the subsystem: Arrow navigation does not wrap, Home and End move the text cursor, Space toggles only after keyboard navigation, and Page Up and Page Down move by one visible page.

This feature owns key handling only. Searching, selection state, list positioning, announcements, and form integration belong to sibling features and appear here as collaborators.

## Description

`Combobox<T>.onKeydown(event)` handles input navigation and selection. `onChipKeydown(event, index)` handles chip remove buttons. The bubbling `onHostKeydown(event)` handles dismissal across the host and, when required, the fallback popup pane.

Input key handling returns without action while disabled or composing, including `event.isComposing`. Printable keys keep native editing behavior. `navigationIntent` distinguishes option navigation from text editing. Plain Arrow Up/Down and Page Up/Down set it. Query edits, `close`, input pointerdown, Home, End, and horizontal arrows clear it. `previousChipKey()` reads the host's computed CSS direction on each use, so direction changes apply immediately.

| Input key | Behavior |
|-----------|----------|
| Arrow Down, closed | Open; activate the first enabled option when rendered |
| Arrow Up, closed | Open; activate the last loaded option |
| Arrow Down/Up, open | Forward the plain arrow to `ActiveDescendantKeyManager.onKeydown`; no wrap, and disabled options remain navigable |
| Arrow Down on the last option | Request the next page when available; keep the active option during loading |
| Alt+Arrow Down | Open without an active option; if already open, preserve the current option and clear navigation intent |
| Alt+Arrow Up | Close and stop propagation |
| Page Down/Up, open | Move by the count of fully visible option rows, at least one, clamped to the loaded range; from no active option start at the corresponding end |
| Page Down on the last option | Request the next page when available |
| Enter, open error | Prevent submission and call `retry()` |
| Enter, open with active option | Prevent submission and toggle that item; a disabled item remains unchanged |
| Enter, open without active option | Prevent submission and call guarded `loadMore()` |
| Enter, closed | Keep native submission behavior |
| Space after option navigation | Prevent text insertion and toggle the active item; a disabled item remains unchanged |
| Space while editing | Keep native text insertion |
| Home/End, horizontal arrows | Keep native caret movement, except the chip-entry rule below |
| Backspace, empty query | Remove the last value and keep input focus |
| Backspace, non-empty query | Keep native text editing |
| Arrow toward inline start, caret at 0 | Focus the last chip remove button when chips exist |
| Escape | Dismiss tooltip first; otherwise close an open list; otherwise clear non-empty input text without reopening; otherwise propagate |
| Tab/Shift+Tab | Close the list and keep native focus order |

The component forwards only plain vertical arrows to the key manager. Page movement uses `setActiveItem(index)` explicitly. Active highlighting changes `aria-activedescendant` without moving DOM focus. `ComboboxOption.setActiveStyles()` adjusts only the controlled listbox's scroll position.

| Chip remove-button key | Behavior |
|------------------------|----------|
| Enter, Space, Backspace, Delete | Prevent default and call `removeChip(index)` |
| Arrow toward inline start | Focus the previous button; do nothing on the first chip |
| Arrow toward inline end | Focus the next button; from the last chip focus the input |
| Tab/Shift+Tab | Close any popup and keep native focus order |
| Escape | Dismiss a visible tooltip first; otherwise close the popup while preserving chip focus |

LTR uses Arrow Left for inline start and Arrow Right for inline end. RTL mirrors them. Removal focuses the next surviving chip button, else the previous one, else the input before committing the value change. Button click uses the same removal method. The key handler prevents the native Enter/Space activation from causing a second removal.

The popup has no Tab stops among its options. Retry and Load more use `tabindex="-1"`; input Enter and arrow paging provide keyboard access. Consumed Escape stops propagation so a containing dialog receives Escape only after the component has exhausted its dismissal actions. Escape from a popup action restores input focus; Tab is never trapped.

## Requirements

Source: [L2 detailed requirements](../../../specs/L2.md). The table quotes source wording exactly, including its use of `must`.

| L2 ID | Refines (L1) | Requirement |
|-------|--------------|-------------|
| `L2-033` | `L1-013` | With focus in the input, the keyboard must operate the combobox exactly as the following behaviors specify. Arrow navigation must not wrap. |
| `L2-034` | `L1-013` | With focus on a chip remove button, the keyboard must remove chips and move between them. In right-to-left layouts, Arrow Left and Arrow Right must be mirrored. |

## Diagrams

The context view shows the keyboard user, the host application that contains `t-combobox`, the data source behind `searchFn`, and the assistive technology that reads the announcements.

![C4 context: Operate by keyboard](diagrams/c4-context.png)

The container view places `@tessera/combobox` and Angular CDK inside the host application. The package runs in the browser and reaches the consumer's data source only through `searchFn`.

![C4 containers: Operate by keyboard](diagrams/c4-container.png)

The component view shows the key handlers, option hosts, CDK key manager, and announcement queue. `Combobox<T>` owns the search and popup methods called by keyboard actions.

![C4 components: Operate by keyboard](diagrams/c4-component.png)

The class view records the key-handling methods of `Combobox<T>` and its relationships to the collaborators. Types shared with other features keep the meaning given in the subsystem page.

![Class structure: Operate by keyboard](diagrams/class-structure.png)

The first sequence follows the input keys: opening the list, moving the active option, toggling it, retrying a failed request, and closing the list. The Escape branch shows why an enclosing dialog stays open on the first press.

![Sequence diagram: Navigate and select options by keyboard](diagrams/sequence-navigate-options.png)

The second sequence follows the chip keys: leaving the input toward the chips, mirroring in a right-to-left layout, removing a chip, and tabbing out of the component.

![Sequence diagram: Remove and move between chips by keyboard](diagrams/sequence-navigate-chips.png)
