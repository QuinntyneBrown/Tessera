# Open and position the list

## Overview

`t-combobox` shows its options in a popup list next to the field. The list opens on request, closes predictably, and keeps the typed input visible. This feature covers opening and closing, initial active-option state, popup position, and width.

**Popup list** — panel of options that appears next to the field while the combobox is open

**Overlay** — Angular CDK layer that renders content in the browser's top layer as a native popover, positioned against an origin element

**Active option** — option that the input points to through `aria-activedescendant` while DOM focus stays on the input

**Origin element** — field element that the overlay attaches to and takes its width from

The list renders in an overlay so that no ancestor's `overflow` or stacking context clips it. The overlay host sits directly after the field in the DOM, so assistive technology that follows DOM order reaches the options after the input. The overlay is not modal and does not trap focus. Option navigation keeps input focus. Closing itself does not focus anything; Tab, outside interactions, and disabling may move focus through browser behavior.

## Description

`Combobox<T>` owns `isOpen`, `activeIndex`, `opened`, `closed`, and a lazily created CDK `OverlayRef`. It attaches its panel template through `TemplatePortal` and retains the overlay reference across open/close cycles. `ComboboxOverlayContainer` supplies the component-scoped fallback container.

**Opening and closing.** Typing, paste, and composed input open the list through `changeQuery`. Arrow Down opens in normal mode, Arrow Up in last mode, and Alt+Arrow Down in none mode. A field click calls `focusAndOpen`; the toggle calls `togglePopup`. Both focus the input. Focus alone has no opening handler.

`open()` ignores an already open or disabled component and emits `opened` once per transition. `close()` ignores an already closed component, clears active state and navigation intent, cancels queued search announcements, stops geometry tracking, detaches the panel, and emits `closed` once. It preserves the query and selections. An in-flight request remains subscribed after close.

Escape, Alt+Arrow Up, Tab, Shift+Tab, an outside pointer event, toggle activation, and disable close the list. `OverlayRef.outsidePointerEvents()` excludes pane interactions; its subscriber additionally ignores targets inside the component host. The host's bubbling `onHostKeydown` handles dismissal from the input, chips, and clear-all. Fallback panes route key and focus events to the same handlers only when outside the host.

Tab retains browser focus behavior and is never prevented. Closing itself moves no focus. Escape from a chip preserves chip focus; Escape from a popup action focuses the input before close. A visible full-label tooltip receives Escape first. No backdrop, focus trap, or `aria-modal` belongs to the popup.

**Option discovery and activation.** `viewChildren(ComboboxOption)` discovers component-owned hosts. The directive is non-generic and implements CDK `Highlightable`; the template supplies its selected, disabled, label, total, and position inputs. The view query supplies the manager's option collection.

An `afterEveryRender` callback rebuilds `ActiveDescendantKeyManager<ComboboxOption>` when the option collection changes. `withWrap(false)` stops navigation at either end; `skipPredicate(() => false)` retains disabled options. The manager's `change` stream updates `activeIndex`. Opening and page 0 delivery set `needsActivation`. Normal mode chooses the first enabled option or none; last mode chooses the last loaded option, including a disabled one; none mode clears the active item. The opening mode survives the first asynchronous response. A plain arrow key restores normal mode. Appended pages preserve the index.

**Positioning.** `FlexibleConnectedPositionStrategy` connects to the field with `withPopoverLocation('inline')`, `withPush(false)`, `withFlexibleDimensions(true)`, and `withGrowAfterOpen(true)`. The scroll strategy repositions. Preferred positions join the panel's top to the field's bottom, or its bottom to the field's top. Width always comes from the field's bounding box.

`updatePopupGeometry()` first reveals the input within the visual viewport using instant scrolling when needed. It measures available room above and below, status-row height, and root font size. The preferred maximum is 24 rem. When the full field leaves less than 4 rem plus status height, connected-position offsets align the panel vertically with the input row while retaining full field width. The panel may cover chips in this fallback, but keeps the input clear. More room above selects the upper position when the desired height does not fit below. The chosen height is bounded by available space with a 2 CSS px allowance.

A `ResizeObserver` watches the field. Capture-phase document scroll, window resize, visual-viewport resize, and the open-state render callback schedule geometry measurements, coalesced into one animation frame. The render callback also catches host content moving the field without resizing it or changing combobox signals. Measurements remain necessary after such renders; an unchanged geometry key skips panel style, overlay size, and CDK positioning writes. Scrolls inside the pane are ignored by the capture handler. CDK repositioning supplies its own scroll/viewport handling. Closing cancels the pending frame, disconnects the observer, and removes the explicit listeners; destruction disposes the overlay and key manager.

**Reading order and dialogs.** The CDK popover host is inserted directly after the field and enters the browser top layer. The resulting DOM order places the options after the input and before validation/hint text. Native and CDK dialog ancestry is retained. Without Popover API support, `ComboboxOverlayContainer` appends its container inside the nearest open native dialog, or leaves the ordinary CDK placement outside a dialog. This fallback lacks the inline reading order. No application-wide container is moved.

Fallback panes receive the host's `--t-combobox-*` properties, font, and direction when attached. Inline panes inherit them through DOM ancestry. The placement decision is recorded in [ADR-0001](../../../adr/frontend/0001-render-combobox-panel-as-inline-popover.md). Manual screen reader reading order remains a release check.

## Requirements

Source: [L2 detailed requirements](../../../specs/L2.md). The table quotes the source wording exactly, including its modal verb.

| L2 ID | Refines (L1) | Requirement |
|-------|--------------|-------------|
| `L2-029` | `L1-011` | The list must open on typing, Arrow Down, Arrow Up, Alt+Arrow Down, or a click on the field or toggle button, and must not open on focus alone. It must close on Escape, Tab, an outside click, Alt+Arrow Up, or a click on the toggle while open. Closing itself must not move focus; Tab, an outside interaction, or disabling may move focus through browser behavior. |
| `L2-030` | `L1-011` | The results list must render in a CDK overlay attached to the field, with the field's width, flipping above the field when there is no room below, and repositioning on scroll and resize. The open list must not hide the focused input. |

## Diagrams

The context view shows the user opening and closing the list in a host application.

![System context for opening and positioning the list](diagrams/c4-context.png)

The container view shows the overlay and key manager coming from the Angular CDK, with the combobox package deciding when to open.

![Containers for opening and positioning the list](diagrams/c4-container.png)

The component view shows `Combobox<T>` owning the overlay and key manager, with a scoped container for fallback dialog placement.

![Components for opening and positioning the list](diagrams/c4-component.png)

The class view records the open state, the component-owned overlay members, and the CDK types used by the feature.

![Class structure for opening and positioning the list](diagrams/class-structure.png)

Opening applies its active-option mode and emits `opened`. Closing emits `closed` once; Tab and outside interactions follow the browser focus behavior.

![Sequence diagram for opening and closing the list](diagrams/sequence-open-close.png)

The overlay flips above the field when there is no room below. It follows field resizes and ancestor scrolls, and it is removed when the component is destroyed.

![Sequence diagram for positioning the list](diagrams/sequence-position.png)
