# Secure and perform

## Overview

`t-combobox` renders text it does not author. The consumer's `searchFn` returns items, the host writes the `value`, and the user types the query. Any of these may carry markup or long text. The component also runs inside applications that have no zone.js and that create and destroy it repeatedly. This feature fixes how the component renders untrusted text, how it stays responsive, and how it releases everything it acquires.

**Untrusted data** — data the component does not author, namely `searchFn` results, the written `value`, and typed text

**Cross-site scripting (XSS)** — attack in which injected markup or script runs in the page of another user

**Instance identifier** — string that identifies one element of one component instance, such as a listbox id

**Zoneless change detection** — Angular mode in which signal writes and event bindings, not zone.js patches, schedule rendering

**Teardown** — release of every request, timer, listener, observer, and DOM node that a component instance acquired

**CPU slowdown** — Chromium emulation that runs script slower by a stated factor, such as 4×

The feature belongs to the combobox subsystem and refines `L1-017`. It constrains how the other slices are built rather than adding a user-facing control. [Search options](../search-options/) supplies the debounce and cancellation behavior that this feature relies on for responsiveness, and [Expose state to assistive technology](../expose-to-assistive-tech/) supplies the live region that this feature keeps free of markup.

## Description

**Untrusted data rendering**

- The component renders every item label, chip label, option label, selected-values summary, status string, and announcement as text. It binds with interpolation or with DOM properties such as `textContent`, `value`, and `title`, and with `[attr.*]` bindings for attribute values. The browser never parses these values as HTML (`L2-044` AC1, AC2).
- The component code does not use `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `DomSanitizer`, or any `bypassSecurityTrust*` call. Code review enforces this rule. No test scans the code for these names, because `AGENTS.md` forbids tests of code shape. The behavioral tests below prove the outcome.
- `ComboboxAnnouncer` passes only `string` messages to the CDK `LiveAnnouncer`. The CDK writes the message with `textContent`, so a label such as `<img src=x onerror="window.__xss=1">` appears in the live region as literal characters. The announcer never passes an element or a template (`L2-044` AC2).
- `ComboboxIds` is created once per `Combobox<T>` instance. A module-level counter supplies a `uid`, and every identifier derives from `t-combobox-{uid}`. No identifier uses item data, labels, values, or the query.

| Identifier | Form | Referenced by |
|------------|------|---------------|
| Input | `inputId` when supplied, otherwise `t-combobox-{uid}-input` | `label for`, hint and summary references |
| Listbox | `t-combobox-{uid}-listbox` | `aria-controls`, `aria-labelledby` of options |
| Option | `t-combobox-{uid}-option-{n}` | `aria-activedescendant` |
| Hint, error, summary | `t-combobox-{uid}-hint`, `-error`, `-summary` | `aria-describedby` |
| Chip list | `t-combobox-{uid}-chips` | Chip list container |

- `ComboboxIds.nextOptionId()` returns the next option identifier for the instance. Each `ComboboxOption<T>` requests one in its constructor through the `COMBOBOX_PARENT` token and keeps it for its life. Identifiers contain only letters, digits, and hyphens, so they are valid and unique per instance and per page (`L2-044` AC3, AC5).
- `aria-describedby` and `aria-controls` list only identifiers from `ComboboxIds`. No ARIA reference is built from data.
- `Combobox<T>` passes the typed text to `ComboboxSearch` unchanged: no trimming, no case change, no encoding, and no length limit. `searchFn` receives the same string the input holds, and the component displays the text only through the input's `value` property (`L2-044` AC4). Encoding the query for a transport such as a URL is the consumer's responsibility, and the documentation page says so.
- The `tComboboxOption`, `tComboboxChip`, and `tComboboxEmpty` templates render consumer markup that the consumer owns. The component does not sanitize template output. It passes `item`, `selected`, `active`, and `query` as data and applies no HTML interpretation. The documentation page states this boundary.
- Behavioral proof uses `ComboboxScenario` in `src/e2e-app/`, which returns a hostile item set, and `ComboboxDemoPage` actions. The set contains one `displayWith` value of `<img src=x onerror="window.__xss=1">`, items whose ids and labels hold spaces, quotes, and angle brackets, and a page that holds two instances. Page object assertions read `window.__xss`, the literal text of each rendered chip, option, and summary, the live-region text, and every `id` in the document. The ids shall be unique and shall match `^[A-Za-z][A-Za-z0-9-]*$`.

**Performance**

- Typing stays on a short path. The input event handler writes the `query` signal and returns. `ComboboxSearch` observes the signal through `toObservable`, applies `debounceTime(debounceMs)` and `distinctUntilChanged`, and calls `searchFn` inside `switchMap`. A slow request never blocks the input, because the request runs outside the event handler (`L2-045` AC1).
- One request follows each typing burst. Ten characters typed 50 ms apart with default settings produce one call at 300 ms after the last character (`L2-045` AC2).
- `Combobox<T>` renders options and chips with `@for` and `track` by item identity. A new page replaces the option list. A new selection adds or removes one chip subtree and leaves the others untouched.
- Each `ComboboxOption<T>` derives `selected` and `active` with `computed()`. A selection change recomputes `selected` for each displayed option once, which is at most 50 calls to `compareWith` per held value in a 50-option page. OnPush limits checking to views whose signals changed (`L2-045` AC3, AC4).
- Arrow navigation moves `activeIndex` through the CDK `ActiveDescendantKeyManager`. Two option hosts update their bindings, one element calls `scrollIntoView({ block: 'nearest' })`, and no announcement is made per key. After 5 pages of 50 options the cost per key stays proportional to the two changed hosts, not to the list length (`L2-045` AC5).
- The measurement path uses `ComboboxDemoPage`. It enables CPU slowdown through a Chromium DevTools Protocol session (`Emulation.setCPUThrottlingRate`, rate 4) for the `L2-045` AC3 and AC4 runs. Timed actions return 100 durations, and an assertion helper requires at least 95 durations at or under the limit. The fixture stamps `performance.now()` when the mock `searchFn` emits, so render time runs from emission to the first frame that shows the 50th option.
- The reference machine, the measurement method for keystroke latency, and the pass threshold arithmetic are `<TO SUPPLY>`, as the subsystem README records. The design proposes the Event Timing API for keystroke latency and `requestAnimationFrame` for render timing.

| Criterion | Limit | Runs | Fixture state | CPU slowdown |
|-----------|-------|------|---------------|--------------|
| `L2-045` AC1 | 100 ms per keystroke | 100 keystrokes, 95 within limit | `searchFn` delay of 5 s | none |
| `L2-045` AC2 | 1 call | 1 burst of 10 characters 50 ms apart | default settings | none |
| `L2-045` AC3 | 200 ms to render 50 options | 100 runs, 95 within limit | page of 50 items | 4× |
| `L2-045` AC4 | 200 ms to reflect a toggle | 100 runs, 95 within limit | value of 200 items | 4× |
| `L2-045` AC5 | 100 ms per arrow key | 100 keystrokes, 95 within limit | 5 pages of 50 options appended | none |

**Zoneless operation**

- `Combobox<T>` declares `changeDetection: ChangeDetectionStrategy.OnPush`. No class in the package injects `NgZone` or calls `runOutsideAngular`.
- State lives in signals: `query`, `isOpen`, `activeIndex`, `value`, and the `ComboboxSearch` outputs. Event bindings in the template, the `ResizeObserver` callback in `ComboboxPopup`, and the `ControlValueAccessor` methods `writeValue` and `setDisabledState` each write a signal. A signal write notifies the zoneless scheduler, so no call to `markForCheck` or `detectChanges` exists.
- The `src/e2e-app/` configuration adds `provideZonelessChangeDetection()` and loads no zone.js polyfill. The acceptance test searches, selects, removes, and navigates by keyboard in that application (`L2-046` AC1).

**Teardown**

`Combobox<T>` registers each release with `DestroyRef.onDestroy` or `takeUntilDestroyed`.

| Resource | Acquired by | Released by |
|----------|-------------|-------------|
| `searchFn` subscription | `ComboboxSearch` through `switchMap` | `takeUntilDestroyed` unsubscribes the outer stream, which unsubscribes the inner request (`L2-046` AC2) |
| Debounce timer | `debounceTime` | Same unsubscribe |
| Loading-announcement and coalescing timers | `ComboboxAnnouncer` | `onDestroy` clears each timer; a queued message is dropped |
| Overlay pane and strategy | `ComboboxPopup` | `overlayRef.dispose()` removes the pane from the document (`L2-046` AC3) |
| Width observer | `ComboboxPopup` | `ResizeObserver.disconnect()` |
| Overlay event subscriptions | `ComboboxPopup` | Disposed with the overlay and unsubscribed through `takeUntilDestroyed` |
| Outside-click listener | CDK outside-click dispatcher | Removed when the overlay is disposed |
| Host and document listeners | Template bindings and `Renderer2` | Removed with the view or unsubscribed through `takeUntilDestroyed` |

- After destruction, no resize, scroll, document click, or elapsed debounce reaches component code. The acceptance test types, destroys the component before the debounce elapses, waits past `debounceMs`, and checks that `searchFn` ran zero times. It then dispatches a resize, a scroll, and a document click and checks that no page error occurs (`L2-046` AC4).
- The fixture mounts and destroys the component through a toggle. `ComboboxDemoPage.mountAndDestroy(times)` opens the list and removes the component 100 times. It then compares the number of `.cdk-overlay-pane` elements and the document-level listeners reported by `DOMDebugger.getEventListeners` with the counts taken after one warm-up cycle (`L2-046` AC5).
- The CDK creates its overlay container and any live-announcer element lazily and keeps them for the application. They are application-scoped, not component-owned. The baseline therefore follows one warm-up cycle, and "no DOM remains" means the component-owned nodes, namely the overlay pane and the listbox, leave the document.

Production work follows `AGENTS.md`. Each slice starts from one criterion and a failing Chromium test: hostile label as text, hostile announcement, generated ids, unchanged query, two instances, each timing, zoneless operation, and each teardown case.

## Requirements

Source: [L2 detailed requirements](../../../specs/L2.md). The table quotes source wording exactly, including its use of `must`.

| L2 ID | Refines (L1) | Requirement |
|-------|--------------|-------------|
| `L2-044` | `L1-017` | Data returned by `searchFn` and written to the value is untrusted. The component must render it as text, must not interpret it as HTML, and must not derive element ids or ARIA references from it. |
| `L2-045` | `L1-017` | The component must stay responsive while requests are in flight, must not issue a request per keystroke, and must render a page of options promptly. |
| `L2-046` | `L1-017` | The component must use OnPush change detection, must work with `provideZonelessChangeDetection()` and not rely on `NgZone`, and must release its requests, overlay, observers, and listeners when destroyed. |

## Diagrams

The context view shows the data flow that this feature protects: the consumer's data source returns untrusted items, and the component renders them for the user and for assistive technology.

![C4 context: Secure and perform](diagrams/c4-context.png)

The container view places the package beside Angular core and the CDK in the host application. It also shows the zoneless end-to-end application and the Chromium tests that measure the package.

![C4 containers: Secure and perform](diagrams/c4-container.png)

The component view shows the parts that carry the security, performance, and cleanup rules. `ComboboxIds` is the only source of identifiers.

![C4 components: Secure and perform](diagrams/c4-component.png)

The class view records the identifier source, the option identifier flow, and the teardown surface of each resource owner.

![Class structure: Secure and perform](diagrams/class-structure.png)

Hostile text travels from the input and from `searchFn` to the DOM and to the live region as text, and no identifier uses it.

![Sequence diagram: Render untrusted data as text](diagrams/sequence-render-untrusted.png)

Destruction unsubscribes the request, disposes the overlay, disconnects the observer, and clears timers, so later events reach no component code.

![Sequence diagram: Release resources on destroy](diagrams/sequence-destroy.png)
