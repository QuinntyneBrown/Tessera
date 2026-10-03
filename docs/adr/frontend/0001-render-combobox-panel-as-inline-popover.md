# ADR-0001: Render the combobox panel as an inline CDK popover after the field

**Date:** 2026-10-03
**Category:** frontend
**Status:** Accepted
**Deciders:** Tessera maintainers

## Context

`t-combobox` shows its options in a popup panel. L2-030 requires that panel to render in an Angular CDK overlay attached to the field, so that no ancestor's `overflow` or stacking context clips it, and so that it appears above dialog content.

A CDK overlay has traditionally been appended to a shared overlay container at the end of `<body>`. The input then refers to the listbox only through `aria-controls`. Most desktop screen readers follow `aria-activedescendant` and do not need DOM proximity. VoiceOver on iOS is different: touch users move by swiping through the page in DOM order. Safari does not support `aria-owns`, so the listbox can't be pulled into the input's position in the accessibility tree. A panel at the end of the document is therefore not reachable by swiping from the input. L2-049 makes VoiceOver with Safari on iOS a release gate.

Fluent 2 runs into the same constraint. Its combobox guidance recommends `inlinePopup`, which renders the listbox immediately after the trigger in the DOM, for exactly this reason. The [Fluent 2 comparison](../../mocks/combobox/fluent-2-comparison.md) (I-3) raised it for Tessera.

The workspace pins `@angular/cdk` 22.2.1. In that version, overlays render as native popovers by default (`usePopover` defaults to true), and `FlexibleConnectedPositionStrategy.withPopoverLocation('inline')` inserts the overlay host directly after the origin element. The popover still enters the browser's top layer.

## Decision

`ComboboxPopup` keeps the CDK overlay and `FlexibleConnectedPositionStrategy` that L2-030 requires. It configures the strategy with `withPopoverLocation('inline')`, with the field as the origin. The overlay host is then inserted directly after the field, inside the component host. The reading order becomes label, field, list, error, and hint (L2-030 criterion 7). Without the Popover API, the existing fallback applies: a component-scoped overlay container inside the closest open native dialog, or the ordinary CDK container outside a dialog.

## Options Considered

### Option 1: CDK overlay in the shared overlay container (`withPopoverLocation('global')`)
- **Pros:** The CDK default before popovers. Fully decoupled from the host's DOM. Familiar from Angular Material.
- **Cons:** The panel sits at the end of `<body>`, so VoiceOver on iOS can't reach the options from the input. axe and the test harness must scan the container in addition to the host.

### Option 2: Inline CDK popover after the field (`withPopoverLocation('inline')`)
- **Pros:** DOM order matches reading order, so the iOS gate can be met. The top layer still escapes clipping and stacks above dialogs. It is one configuration call on an API the design already uses. axe can scope to `t-combobox`.
- **Cons:** It depends on the Popover API; without it, the list falls back to a component-scoped container inside an open native dialog, or to the shared container elsewhere. The CDK takes the insertion point from the origin each time the overlay attaches, so the origin must stay the field.

### Option 3: Render the panel in the component template, without the CDK overlay
- **Pros:** The simplest DOM, and no overlay dependency.
- **Cons:** Ancestor `overflow` and stacking contexts clip it, and it does not appear above modal dialogs. It contradicts L2-030 and would mean reimplementing flipping and repositioning.

## Consequences

### Positive
- Swipe navigation in VoiceOver on iOS reaches the options after the input, with no `aria-owns`.
- The open list lies inside the host, so axe and the harness see one subtree in Chromium.
- No new dependency. L2-030's statement is unchanged; only criterion 7 is added.

### Negative
- Browsers without the Popover API keep the end-of-body placement and its iOS limitation.
- The short-viewport fallback can't switch the origin to the input row with `setOrigin()`. It must express that anchor as a position offset, which is slightly less direct.

### Risks
- The CDK popover-location API is newer than the rest of the overlay API. The pinned CDK must be checked before the positioning ATDD slice, as `open-and-position-list` already requires.
- Real-device VoiceOver behavior can only be confirmed by the manual L2-049 matrix. Its checklist item (i) and the iOS and Android procedures check swipe navigation from the input to the options.

## Implementation Notes

- `overlay.position().flexibleConnectedTo(fieldElement).withPopoverLocation('inline')`, keeping the existing positions, `withPush(false)`, and `withFlexibleDimensions(true)`. The short-viewport fallback anchors to the input row through `offsetY` on the connected position, not through `setOrigin()`.
- Host-level `focusout` and `keydown` listeners receive pane events by bubbling. `ComboboxPopup` routes pane events to them only in the fallback placement, so each event is handled once.
- The live region stays outside the panel (L2-036). `focusout` and outside-pointer checks continue to treat the overlay pane and the host as inside the component.
- The HTML mock models the same DOM order by placing its fixed-position popup directly after the field.

## References

- [L2-030 Overlay positioning](../../specs/L2.md)
- [Open and position the list](../../detailed-designs/combobox/open-and-position-list/README.md)
- [Fluent 2 Combobox usage: optimize for screen readers](https://fluent2.microsoft.design/components/web/react/core/combobox/usage)
- [Angular CDK FlexibleConnectedPositionStrategy source](https://github.com/angular/components/blob/v22.2.1/src/cdk/overlay/position/flexible-connected-position-strategy.ts)
