# Search options

## Overview

`t-combobox` lets a user find options in a remote data set by typing. The data set is too large to load up front, so the component asks the consuming application for matching options as the text changes.

**searchFn** — consumer-supplied function that takes a query and a page number and returns an Observable of one page of options

**Query** — text currently typed in the input

**Page** — result of one call to `searchFn(query, page)`, numbered from 0

**Debounce** — pause after the last keystroke before the component acts on the query

**IME composition** — input method editor session in which a user assembles a character from multiple keystrokes

This feature covers everything between a keystroke and a rendered list of results. It triggers searches, cancels outdated ones, shows loading, empty, and error states, and appends further pages. Selecting results, opening the popup, and keyboard operation belong to sibling features.

The component has no backend of its own. `searchFn` may call a server or an in-memory source. A failure in `searchFn` never throws out of the component, and later searches keep working after a failure.

## Description

`Combobox<T>` owns the entire search flow. Its `query`, `results`, `status`, `hasMore`, and `total` signals drive the template. `ComboboxPage<T>` carries `items`, `hasMore`, and optional `total`. `ComboboxSearchFn<T>` names the consumer's `(query, page) => Observable<ComboboxPage<T>>` contract.

**Query commitment.** `onInput(event)` passes the input value unchanged to `changeQuery(text)`. Each edit updates the query, opens the list, marks the query pending, clears navigation intent, and cancels queued search announcements. The `invalidated` Subject unsubscribes the current request immediately, before debounce. The `queries` Subject feeds `debounce(() => timer(debounceMs()))`; the default pause is 300 ms. A committed text different from `committedQuery` emits `searchChange` once, even below the minimum length. Construction alone emits no text-change event.

`compositionstart` cancels the request and replaces a pending query with a null sentinel. Intermediate IME input updates the visible text but does not enqueue a search. `compositionend` routes the final input value through the normal debounce. The null sentinel also cancels a pending typing search on disable or configuration change.

After debounce, text shorter than `minSearchLength` clears results, paging state, and `total`. The default minimum is one character. The template shows the localised `searchPrompt` instead of the empty-state content. The option collection becomes empty and the active-descendant reference disappears. Chips remain unchanged.

**Request lifecycle.** The `requests` Subject carries query/page descriptors into `switchMap`. Each request sets status to `loading` and calls `defer(() => searchFn()(query, page))`. `take(1)` consumes the first page; `throwIfEmpty()` converts completion without a page into an error. `takeUntil(invalidated)` rejects delivery from a cancelled subscription. This subscription boundary protects newer results during the debounce pause.

A page 0 response replaces `results`; later pages append. A successful response records `completedQuery`, `pageIndex`, `hasMore`, and `total`. `catchError` inside the request handles observable errors, synchronous throws, and empty completion. It sets status to `error` and leaves loaded results available. `finalize` clears the request's loading timer and returns a loading status to `idle`. The outer stream remains available for later searches.

| State | Presentation |
|-------|--------------|
| `loading` | Previous options remain, a spinner and Loading row appear, and the listbox has `aria-busy="true"` |
| `idle`, eligible query, no items | No results, or `tComboboxEmpty` content with `{ query }`; the listbox has `aria-busy="false"` |
| `error` | The loading-error message and Retry appear beside the retained option list; the listbox has `aria-busy="false"` |
| Below minimum | The minimum-search instruction appears; the debounced commitment clears old options |

Status rows and paging actions sit outside the listbox. They never enter the option collection. All owned text comes from `COMBOBOX_I18N`.

**Retry and paging.** `retry()` repeats `lastRequest` only for an enabled, non-composing component with no pending query, an error status, and matching current text. Enter in an open error state calls the same method as the Retry button.

`loadMore()` requests `pageIndex + 1` only when status is `idle`, `hasMore` is true, and `completedQuery` matches the current query. Disabled state, composition, or a pending edit blocks it. The method restores input focus after enqueueing. Its triggers are the Load more results button, a scroll within 8 CSS px of the end of an overflowing list, Arrow Down or Page Down at the last option, and Enter without an active option. Appending preserves the active option. A failed page retains the last successful index, so Retry repeats and appends the failed page. Empty pages never cause an automatic request loop.

Load more results renders whenever `hasMore` is true, with `tabindex="-1"`. It is disabled outside `idle`; request guards also block it during debounce or composition. Optional `total` supplies each option's `aria-setsize`, with a one-based `aria-posinset`; absent total removes both attributes.

**Reopening and configuration.** Opening with `minSearchLength` zero requests an empty query immediately. Reopening an unchanged successful query reuses current results. There is no cache of previous queries. Cancellation does not mark an unfinished query complete, so it remains requestable after re-enable. Changes to `searchFn`, `debounceMs`, `minSearchLength`, or `maxSelections` invalidate requests and results; an open, eligible field requests page 0 immediately. Configuration changes emit no `searchChange`.

Closing detaches the list without cancelling an active request. Its response may update stored results, but does not reopen the list or announce while closed. Each response calls `ComboboxAnnouncer` directly from `Combobox<T>` when open.

## Requirements

Source: [L2 detailed requirements](../../../specs/L2.md). The table quotes the source wording exactly, including its modal verb.

| L2 ID | Refines (L1) | Requirement |
|-------|--------------|-------------|
| `L2-022` | `L1-009` | Typing in the input must trigger a search through the consumer's `searchFn(query, page)` after the `debounceMs` pause, subject to `minSearchLength`. Identical consecutive queries must not re-fetch. A search must not fire while an input method editor (IME) composition is in progress. |
| `L2-023` | `L1-009` | A new query must cancel the in-flight request, and a response for an outdated query must never replace newer results. Disabling the component must cancel any in-flight request. |
| `L2-024` | `L1-009` | The list must show a loading indicator while a request is in flight, a "No results" row when the result set is empty, and an error row with a Retry action when the request fails. A failure in `searchFn` must never throw out of the component, and later searches must still work after a failure. |
| `L2-025` | `L1-009` | When a page reports `hasMore: true`, the component must load and append the next page when the user scrolls to the end of the list or arrows past the last option. A page request must not duplicate an in-flight page request. |

## Diagrams

The context view shows the user searching through a host application whose data source answers each query.

![System context for searching options](diagrams/c4-context.png)

The container view places `@tessera/combobox` in the host application's browser. The consumer API is reached only through `searchFn`.

![Containers for searching options](diagrams/c4-container.png)

The component view shows `Combobox<T>` owning search subscriptions and binding page metadata to its option hosts.

![Components for searching options](diagrams/c4-component.png)

The class view records the signals, methods, and page and status types used by the feature.

![Class structure for searching options](diagrams/class-structure.png)

Typing starts a debounced search, a newer query cancels the older request, and a query below `minSearchLength` cancels without a call.

![Sequence diagram for triggering and cancelling a search](diagrams/sequence-search.png)

A request resolves to results, an empty page, or an error, and a next page appends to the loaded results. Retry repeats the failed request.

![Sequence diagram for result states, retry, and paging](diagrams/sequence-states-paging.png)
