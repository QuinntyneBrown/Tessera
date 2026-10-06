# Senior Angular Product Engineer assessment — answers and assessor guide

**Assessor material.** Distribute the [candidate test](senior-angular-product-engineer-test.md) separately. This is an original Tessera assessment, not an official Docebo or Karat hiring instrument.

## Administration and scoring

Use 180 minutes: 10 for orientation and 170 for exercises. Verify the environment before timing begins. Allow the repository and official documentation, but no AI assistance or access to this document. Ask candidates to submit partial work at the deadline. Do not make familiarity with the repository's existing solutions a prerequisite; score against the explicit assessment contracts.

| Exercise | Allocation | Total |
| --- | --- | ---: |
| 1 | Defects 6; corrected forms behavior 6; zoneless/cleanup/checks 3 | 15 |
| 2 | Criteria/tests 7; controller 14; trace/explanation 4 | 25 |
| 3 | Criteria/tests 6; coordinator 11; trace/explanation 3 | 20 |
| 4 | Browser boundary 6; service contract 6; commit semantics 3 | 15 |
| 5 | Interaction design 7; Page Object tests 5; manual evidence 3 | 15 |
| 6 | Diagnosis 3; containment/fixes 4; delivery/rollout 3 | 10 |
| **Total** | | **100** |

Provisional interpretation: 90–100 exceptional evidence; 80–89 strong senior evidence; 70–79 mixed evidence requiring focused follow-up; below 70 insufficient evidence for this assessment. These bands are a suggested rubric, not a validated hiring predictor. Record the technical reasons for the score. Serious unresolved credential exposure, authorization failure, or silent learner-state loss warrants explicit review even with a high aggregate score; do not invent an automatic pass/fail gate afterward.

Award points for demonstrated behavior, not a preferred operator or class layout. Accept equivalent RxJS, state-machine, or imperative implementations. Stronger abstractions receive no bonus unless they solve an established problem. Do not penalize a candidate for correctly questioning an ambiguous integration assumption. Any clarifications and hints must be recorded and applied consistently across candidates.

### Role alignment and project boundaries

The role description supplied in `C:/Users/quinn/Downloads/Senior Product Engineer II - Frontend @ Docebo.html` was saved from [the Docebo posting](https://jobs.ashbyhq.com/docebo/57d843bc-1da1-4566-912b-dbbafe33d24f). The local supplied copy governs this assessment if the live posting changes. Its relevant expectations are expert Angular/TypeScript, end-to-end feature ownership, component architecture and reactive state, REST and PHP/TypeScript integration, accessibility/performance, testing/CI/CD/observability, and acting as a squad's technical anchor.

Exercises 1–2 assess Angular/reactive engineering; 3–4 assess asynchronous workflows and cross-service contracts; 5 assesses design-system accessibility and verification; 6 assesses production ownership, prioritization, and technical direction. The assessment deliberately avoids generic framework trivia.

The [requirements](../specs/L2.md), [player implementation status](../detailed-designs/implementation-status.md), [combobox API](../../src/combobox/README.md), and [manual release matrix](../verification/combobox-screen-reader-matrix.md) ground the scenarios. Assessment snippets are purpose-built examples. SCORM 2004 is not implemented by the current player. Manual accessibility sign-off remains pending in the repository. No answer should imply otherwise.

## 1. Angular debugging and forms

### Defects — 6 points

Award one point per distinct defect with a concrete consequence and correction, up to six:

| Defect | Observable failure | Minimal correction |
| --- | --- | --- |
| `writeValue` calls `onChange` | Host writes/reset can echo as user changes or interfere with form scheduling | Update internal state only |
| `push` mutates the signal's current array | Signal identity does not change; dependent computed state may stay stale, and the host's array is mutated | Set a fresh array and report a fresh value |
| Selection has no identity check | Same learner appears twice when fetched as a new object | Compare stable learner IDs before adding |
| `formDisabled` is stored but not enforced | Disabled control still changes value or issues requests | Combine input/form disabled state; block actions, cancel work, close popup, disable all controls |
| Input blur always marks touched | Moving to a chip or portal control prematurely commits a blur-updated form or shows errors | Treat host and owned overlay as one focus boundary |
| Nested subscriptions | Older results replace current results; requests survive new input or destruction; errors escape | Single cancellable request pipeline/controller with failure containment |
| Observer/subscriptions lack disposal | Detached components retain listeners and cause repeated geometry work | Disconnect observer and dispose subscriptions/overlays on destroy |

OnPush limits checking; it does not turn an array into an observable collection. Reading a signal in a template tracks that signal, but `push` does not call its setter. Even `set(theSameArray)` normally fails equality comparison. Immutable replacement fixes notification and avoids mutating a value owned by the form.

### Corrected forms behavior — 6 points

The excerpt below assumes `Learner`, the host element and an optional popup root exist. `cancelSearch` and `closePopup` delegate to the control's existing lifecycle. It illustrates the form boundary; it is not a replacement for Tessera's whole component.

```ts
readonly value = signal<Learner[]>([]);
readonly disabled = input(false);
readonly formDisabled = signal(false);
readonly isDisabled = computed(() => this.disabled() || this.formDisabled());
private touchedDuringVisit = false;
private onChange: (value: Learner[]) => void = () => {};
private onTouched: () => void = () => {};

writeValue(value: Learner[] | null): void {
  this.value.set([...(value ?? [])]); // no onChange and no onTouched
}
registerOnChange(fn: (value: Learner[]) => void): void { this.onChange = fn; }
registerOnTouched(fn: () => void): void { this.onTouched = fn; }
setDisabledState(disabled: boolean): void { this.formDisabled.set(disabled); }

select(learner: Learner): void {
  if (this.isDisabled() || this.value().some(item => item.id === learner.id)) return;
  const next = [...this.value(), learner];
  this.value.set(next);
  this.onChange(next); // once per actual user change
}
private containsFocus(target: EventTarget | null): boolean {
  return target instanceof Node &&
    (this.host.nativeElement.contains(target) || !!this.popupRoot?.contains(target));
}
onOwnedFocusIn(event: FocusEvent): void {
  if (!this.containsFocus(event.relatedTarget)) this.touchedDuringVisit = false;
}
onOwnedFocusOut(): void {
  // Used on both the host and owned overlay; handles relatedTarget=null and settled focus.
  queueMicrotask(() => {
    if (this.destroyed || this.containsFocus(document.activeElement)) return;
    if (!this.touchedDuringVisit) {
      this.touchedDuringVisit = true;
      this.onTouched();
    }
  });
}
```

Award: host writes do not echo (1); immutable identity-safe user updates once (1); combined disabled state/guard on every action (1); cancellation/closing/native disabled controls (1); portal-aware touched boundary once per exit (1); correct form update scheduling (1).

Use an Angular effect in an injection context to observe `isDisabled`: when true, cancel requests and close the popup; disabled state must also be checked synchronously at every interaction entry point. Bind the same computed state to the input, toggle, clear-all, and chip buttons. Do not rely on an effect's scheduling alone to block a click. Wire focus listeners on the owned popup as well as the host and remove them when detached. On selection, restore input focus before destroying a focus-containing popup when appropriate. Check settled focus in a microtask, and prevent callbacks after destruction.

The accessor reports changes once through `onChange`. With `updateOn: 'change'`, Angular commits immediately. With `blur`, Angular retains the pending value until the accessor reports a genuine exit through `onTouched`. With `submit`, Angular commits at form submission. Do not reimplement these policies or suppress `onChange` until blur. Form reset is a host write, not a user selection, and touched/error state must come from the bound control rather than a permanent local flag.

### Zoneless, cleanup, and checks — 3 points

Award one point each:

- Store render-affecting asynchronous state in signals read by the template. An RxJS emission can call a signal setter without adding Zone.js; immutable updates notify Angular. Do not treat `effect` as a general state-copy engine or use `detectChanges` to mask incorrect ownership.
- Use `DestroyRef`/`takeUntilDestroyed` for streams and dispose observers, scheduled work, popup resources, and event listeners. Inner requests also need query invalidation, not merely destruction-time cleanup.
- Behavioral checks: `FormControl.setValue/reset` causes no user-change callback; moving focus through chips/overlay preserves untouched state and exiting reports touched; disabling during search prevents late render, value change, and popup interaction. Also valuable: same-ID options from different pages and zoneless asynchronous result rendering.

**Follow-up:** What happens if the popup is destroyed while it owns DOM focus? A strong answer tracks the focus destination and touch boundary deliberately, including asynchronous focus settlement.

## 2. Asynchronous combobox coding

### Criteria and scoring

Write and verify slices in this order: debounced first page; immediate invalidation and replacement; sequential append; contained failure and explicit retry; below-minimum input and destruction. For each, demonstrate a behavioral test failing before that slice's implementation. A red test caused only by syntax errors or a missing dependency is not evidence of the intended failure.

Criteria examples:

- Given `a:0` is running, when text becomes `ab` before its debounce, then the old subscription is torn down immediately and its late result cannot change the displayed state.
- Given page 0 succeeded with more data, when paging is requested twice before completion, then only page 1 is requested once.
- Given page 1 failed, when another automatic paging trigger occurs, then no request starts; when Retry occurs, page 1 is requested and its success appends.
- Given destruction while a debounce or request is pending, when time advances or the source emits, then no request or state notification occurs.

Tests/criteria (7): documented aligned Given–When–Then slices (1), real red/green evidence (1), deterministic timing/debounce invalidation (1), paging and append retry (1), all three error forms (1), minimum input/destruction (1), duplicate input/paging and regression checks (1). A final suite alone earns test-correctness points but not failing-first evidence points.

Controller (14): immediate invalidation and timer/request teardown (3); debounce/minimum/same-input behavior (2); current-query replacement and one-request paging (3); all error forms contained with correct retry (3); preserved items/page semantics (1); destruction no-ops (1); clear minimal implementation (1).

### Reference search module

This complete module uses the installed RxJS package. Save it as `search-controller.ts` in an assessment scratch project. The optional scheduler permits deterministic virtual time but is not a required public interface change. This controller intentionally implements only the bounded exercise contract; it does not implement all production combobox requirements.

```ts
import {
  asyncScheduler, defer, SchedulerLike, Subscription, take,
  throwIfEmpty, timer, Observable,
} from 'rxjs';

export interface Page<T> { items: T[]; hasMore: boolean; total?: number; }
export type SearchFn<T> = (query: string, page: number) => Observable<Page<T>>;
export type SearchPhase = 'idle' | 'debouncing' | 'loading' | 'ready' | 'error';
export interface SearchState<T> {
  readonly query: string;
  readonly items: readonly T[];
  readonly page: number;
  readonly hasMore: boolean;
  readonly phase: SearchPhase;
}

export class SearchController<T> {
  private current: SearchState<T> = {
    query: '', items: [], page: -1, hasMore: false, phase: 'idle',
  };
  private generation = 0;
  private work = new Subscription();
  private failure: { query: string; page: number } | null = null;
  private destroyed = false;

  constructor(
    private readonly source: SearchFn<T>,
    private readonly debounceMs: number,
    private readonly minLength: number,
    private readonly onState: (state: SearchState<T>) => void,
    private readonly scheduler: SchedulerLike = asyncScheduler,
  ) {}

  get state(): SearchState<T> { return this.current; }

  input(query: string): void {
    if (this.destroyed || query === this.current.query) return;
    this.cancel(); // before waiting for the replacement debounce
    this.failure = null;
    if (query.length < this.minLength) {
      this.publish({ query, items: [], page: -1, hasMore: false, phase: 'idle' });
      return;
    }
    this.publish({ ...this.current, query, page: -1, hasMore: false, phase: 'debouncing' });
    const generation = this.generation;
    const work = this.work;
    work.add(timer(this.debounceMs, this.scheduler).subscribe(() => {
      if (this.valid(generation, query)) this.start(query, 0);
    }));
  }

  loadNext(): void {
    if (this.destroyed || this.current.phase !== 'ready' || !this.current.hasMore) return;
    this.start(this.current.query, this.current.page + 1);
  }

  retry(): void {
    if (this.destroyed || this.current.phase !== 'error' || !this.failure) return;
    const { query, page } = this.failure;
    this.start(query, page);
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.cancel();
    this.failure = null;
  }

  private start(query: string, page: number): void {
    this.cancel();
    this.failure = null;
    const generation = this.generation;
    const work = this.work;
    this.publish({ ...this.current, phase: 'loading' });
    // defer captures a synchronous source throw; throwIfEmpty makes no-emission a failure.
    work.add(defer(() => this.source(query, page)).pipe(
      take(1),
      throwIfEmpty(() => new Error('Source completed without a page')),
    ).subscribe({
      next: result => {
        if (!this.valid(generation, query)) return;
        this.publish({
          query,
          items: page === 0 ? [...result.items] : [...this.current.items, ...result.items],
          page, hasMore: result.hasMore, phase: 'ready',
        });
      },
      error: () => {
        if (!this.valid(generation, query)) return;
        this.failure = { query, page };
        this.publish({ ...this.current, phase: 'error' });
      },
    }));
  }

  private valid(generation: number, query: string): boolean {
    return !this.destroyed && generation === this.generation && query === this.current.query;
  }
  private publish(state: SearchState<T>): void {
    this.current = state;
    this.onState(state);
  }
  private cancel(): void {
    ++this.generation; // invalidate callbacks before triggering any teardown
    this.work.unsubscribe();
    this.work = new Subscription();
  }
}
```

The owning `Subscription` is created before subscribing. This avoids losing a synchronous subscription/teardown when a source emits immediately. No cancelled request's `finalize` changes the shared loading flag. A generation check is useful defence for surrounding callbacks; compliant RxJS unsubscription already suppresses future delivery to a closed subscriber. It does not roll back remote work. Production adapters must avoid side effects that mutate the component outside the controlled emission path.

### Reference search tests

Save as `search-controller.spec.ts`. Run with `vitest run search-controller.spec.ts` in the supplied scratch setup. These are representative solution-verification tests; they are not evidence that any candidate followed ATDD. In an interview the red/green sequence must come from the candidate's run history.

```ts
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { EMPTY, Observable, of, Subject, throwError } from 'rxjs';
import { Page, SearchController, SearchState } from './search-controller';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

function fixture() {
  const calls: string[] = [];
  const cancelled: string[] = [];
  const streams: Subject<Page<string>>[] = [];
  const states: SearchState<string>[] = [];
  const controller = new SearchController<string>((query, page) => {
    const key = `${query}:${page}`;
    calls.push(key);
    const stream = new Subject<Page<string>>();
    streams.push(stream);
    return new Observable(subscriber => {
      const subscription = stream.subscribe(subscriber);
      return () => { cancelled.push(key); subscription.unsubscribe(); };
    });
  }, 300, 1, state => states.push(state));
  return { controller, calls, cancelled, streams, states };
}

test('debounces, invalidates before the replacement debounce, and replaces page zero', () => {
  const f = fixture();
  f.controller.input('x');
  vi.advanceTimersByTime(299);
  expect(f.calls).toEqual([]);
  vi.advanceTimersByTime(1);
  f.streams[0]!.next({ items: ['Existing'], hasMore: true });
  f.controller.input('a');
  vi.advanceTimersByTime(300);
  f.controller.input('ab');
  expect(f.cancelled).toContain('a:0');
  f.streams[1]!.next({ items: ['Stale'], hasMore: true });
  f.controller.loadNext();
  expect(f.controller.state.items).toEqual(['Existing']);
  expect(f.calls).toEqual(['x:0', 'a:0']);
  vi.advanceTimersByTime(300);
  f.streams[2]!.next({ items: ['Abel'], hasMore: true });
  expect(f.controller.state.items).toEqual(['Abel']);
  f.controller.destroy();
});

test('coalesces paging triggers and retries a failed append exactly once', () => {
  const f = fixture();
  f.controller.input('ab');
  vi.advanceTimersByTime(300);
  f.streams[0]!.next({ items: ['Abel'], hasMore: true });
  f.controller.loadNext();
  f.controller.loadNext();
  f.streams[1]!.error(new Error('Unavailable'));
  f.controller.loadNext();
  f.controller.input('ab'); // same input does not implicitly retry
  expect(f.calls).toEqual(['ab:0', 'ab:1']);
  expect(f.controller.state).toMatchObject({ items: ['Abel'], page: 0, phase: 'error' });
  f.controller.retry();
  f.controller.retry();
  f.streams[2]!.next({ items: ['Abby'], hasMore: false });
  expect(f.calls).toEqual(['ab:0', 'ab:1', 'ab:1']);
  expect(f.controller.state).toMatchObject({ items: ['Abel', 'Abby'], page: 1, phase: 'ready' });
  f.controller.loadNext();
  expect(f.calls).toHaveLength(3);
  f.controller.destroy();
});

for (const failure of ['throw', 'error', 'empty'] as const) {
  test(`contains first-page ${failure} and permits explicit retry`, () => {
    let attempts = 0;
    const controller = new SearchController<string>(() => {
      if (++attempts > 1) return of({ items: ['Recovered'], hasMore: false });
      if (failure === 'throw') throw new Error('Sync failure');
      return failure === 'empty' ? EMPTY : throwError(() => new Error('Async failure'));
    }, 300, 1, () => {});
    controller.input('a');
    expect(() => vi.advanceTimersByTime(300)).not.toThrow();
    expect(controller.state.phase).toBe('error');
    controller.retry();
    expect(controller.state.items).toEqual(['Recovered']);
    controller.destroy();
  });
}

test('below-minimum input clears results and invalidates an append', () => {
  const f = fixture();
  f.controller.input('a');
  vi.advanceTimersByTime(300);
  f.streams[0]!.next({ items: ['Ada'], hasMore: true });
  f.controller.loadNext();
  f.controller.input('');
  f.streams[1]!.next({ items: ['Late'], hasMore: false });
  vi.advanceTimersByTime(300);
  expect(f.controller.state).toEqual({
    query: '', items: [], page: -1, hasMore: false, phase: 'idle',
  });
  expect(f.calls).toEqual(['a:0', 'a:1']);
  f.controller.destroy();
});

test('destroy cancels debounce and later calls are inert', () => {
  const f = fixture();
  f.controller.input('a');
  f.controller.destroy();
  const notifications = f.states.length;
  f.controller.input('b'); f.controller.retry(); f.controller.loadNext();
  vi.advanceTimersByTime(1000);
  expect(f.calls).toEqual([]);
  expect(f.states).toHaveLength(notifications);
});

test('destroy cancels an active request without later notifications', () => {
  const f = fixture();
  f.controller.input('a');
  vi.advanceTimersByTime(300);
  f.controller.destroy();
  const notifications = f.states.length;
  f.streams[0]!.next({ items: ['Late'], hasMore: false });
  expect(f.cancelled).toContain('a:0');
  expect(f.states).toHaveLength(notifications);
});

test('accepts only the first source emission and a new query clears retry state', () => {
  const f = fixture();
  f.controller.input('a');
  vi.advanceTimersByTime(300);
  f.streams[0]!.next({ items: ['First'], hasMore: true });
  f.streams[0]!.next({ items: ['Second'], hasMore: false });
  expect(f.controller.state.items).toEqual(['First']);
  f.controller.loadNext();
  f.streams[1]!.error(new Error('Append failed'));
  f.controller.input('b');
  f.controller.retry();
  expect(f.calls).toEqual(['a:0', 'a:1']);
  vi.advanceTimersByTime(300);
  expect(f.calls).toEqual(['a:0', 'a:1', 'b:0']);
  f.controller.destroy();
});
```

### Timeline — 4 points

Requests: `a:0`, `ab:0`, `ab:1`, `ab:1` (retry). No request at 330, 650, or for empty input. Award one point for exact request order.

| Time | Items | Phase / meaning |
| ---: | --- | --- |
| 320 | `[]` | Debouncing `ab`; stale Ada is ignored |
| 640 | `[Abel]` | Error; last successful page is 0, failed request is page 1 |
| 670 | `[Abel, Abby]` | Ready, page 1, no more pages |
| 680 | `[]` | Idle, page -1, no more pages |

Award one point for the visible-state trace, one for immediate invalidation, and one for the distinction between subscription cancellation and server work.

`debounceTime` before `switchMap` delays the replacement outer emission until 610. The `a` inner subscription can still deliver at 320. Cancel or gate the old subscription at the raw input event; debounce only the issuance of new work. `mergeMap` permits out-of-order pages/queries. `exhaustMap` can ignore replacement queries; it may serve bounded paging when query generations are separately invalidated. Operators are mechanisms, not the contract.

**Hint:** “What can arrive between the keystroke and debounce expiry?” **Follow-up:** Integrate IME composition without issuing requests mid-composition, and explain how disabled state differs from destroying the controller.

## 3. SCORM persistence coding

### Criteria and scoring

Implement slices: single save and exact acknowledgement; coalescing while in flight; failure retention and retry; consistent drain settlement. Candidate evidence must show the relevant test failing before each implementation slice and the earlier suite remaining green.

- Given S1 is in flight and S2/S3 arrive, when S1 is acknowledged, then the next request carries only S3/revision 3 and the acknowledgement of 1 has `upToDate=false`.
- Given revision 3 is in flight with newer state waiting, when acknowledgement 2 arrives, then failure is visible, state is retained, and all pending drains resolve false.
- Given a failed save and a later S5, when Retry occurs, then S5/revision 5 is sent, not the failed old snapshot and not a newly allocated revision.
- Given multiple drains while saves are pending, when the latest revision is acknowledged, then all resolve true without settling on an older acknowledgement.

Criteria/tests (6): aligned criteria (1); actual failing-first evidence (1); serialized coalescing (1); failure/mismatched ack/synchronous throw (1); latest-snapshot retry (1); drains/no-pending behavior (1).

Implementation (11): revisions and newest retention (2); single flight/coalescing (2); exact ack and honest `upToDate` (2); failure pause and retry semantics (2); drain settlement (2); minimal readable design (1).

### Reference persistence module

Save as `save-coordinator.ts`. The import below assumes this scratch module is placed at the repository root; adjust its relative path when placing it elsewhere. Tests below use the same convention. No change to Tessera's public types is needed for this exercise.

```ts
import type {
  AttemptContext, AttemptSnapshot, HostIntegration, SaveAck, SaveSubmission,
} from './src/scorm-player/types';

export class SaveCoordinator {
  private latest: SaveSubmission | null = null;
  private inFlight: SaveSubmission | null = null;
  private acknowledged = 0;
  private failed = false;
  private drainers: Array<(saved: boolean) => void> = [];

  constructor(
    private readonly host: Pick<HostIntegration, 'saveState'>,
    private readonly context: AttemptContext,
    private readonly events: {
      onAcknowledged: (submission: SaveSubmission, upToDate: boolean) => void;
      onFailed: () => void;
    },
  ) {}

  submit(snapshot: AttemptSnapshot): number {
    const revision = (this.latest?.revision ?? 0) + 1;
    this.latest = { snapshot, revision };
    if (!this.inFlight && !this.failed) this.send();
    return revision;
  }

  get unsaved(): boolean {
    return this.latest !== null && this.latest.revision > this.acknowledged;
  }

  retry(): void {
    if (!this.failed || this.inFlight || !this.latest) return;
    this.failed = false;
    this.send();
  }

  drain(): Promise<boolean> {
    if (!this.unsaved) return Promise.resolve(true);
    if (this.failed) return Promise.resolve(false);
    return new Promise(resolve => this.drainers.push(resolve));
  }

  private send(): void {
    const submission = this.latest!;
    this.inFlight = submission;
    let pending: Promise<SaveAck>;
    try {
      pending = this.host.saveState(this.context, submission, new AbortController().signal);
    } catch {
      this.settle(submission, false);
      return;
    }
    pending.then(
      ack => this.settle(submission, ack.revision === submission.revision),
      () => this.settle(submission, false),
    );
  }

  private settle(submission: SaveSubmission, saved: boolean): void {
    this.inFlight = null;
    if (!saved) {
      this.failed = true;
      this.events.onFailed();
    } else {
      this.acknowledged = submission.revision;
      this.events.onAcknowledged(submission, submission.revision === this.latest!.revision);
      if (this.unsaved && !this.inFlight && !this.failed) this.send();
    }
    if (this.inFlight || (!this.failed && this.unsaved)) return;
    const result = !this.unsaved;
    this.drainers.splice(0).forEach(resolve => resolve(result));
  }
}
```

This solution assumes the typed host returns a Promise with a valid `SaveAck`, as the exercise specifies. A production adapter must validate decoded HTTP bodies and convert malformed acknowledgements to rejection. It must also bound response time; otherwise a never-settling promise leaves the coordinator and drains pending indefinitely. Non-throwing event callbacks are the exercise contract; production ownership should explicitly decide callback exception containment.

### Reference persistence tests

Save as `save-coordinator.spec.ts`; run with `vitest run save-coordinator.spec.ts`. Use deferred promises rather than network delays or sleeps.

```ts
import { expect, test } from 'vitest';
import type { AttemptContext, AttemptSnapshot, SaveAck, SaveSubmission } from './src/scorm-player/types';
import { SaveCoordinator } from './save-coordinator';

const context: AttemptContext = { attemptKey: 'K', courseKey: 'C', courseRevision: 'V' };
function snapshot(label: string): AttemptSnapshot {
  return {
    schemaVersion: 1, context, edition: '1.2',
    scoStates: { sco: { values: { 'cmi.core.lesson_location': label } } },
    sequencing: { currentActivityId: 'sco' },
  };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function fixture() {
  const sent: SaveSubmission[] = [];
  const pending: ReturnType<typeof deferred<SaveAck>>[] = [];
  const acknowledgements: Array<[number, boolean]> = [];
  let failures = 0;
  const coordinator = new SaveCoordinator({
    saveState: (_context, submission) => {
      sent.push(submission);
      const task = deferred<SaveAck>(); pending.push(task); return task.promise;
    },
  }, context, {
    onAcknowledged: (submission, current) => acknowledgements.push([submission.revision, current]),
    onFailed: () => { ++failures; },
  });
  return { coordinator, sent, pending, acknowledgements, failures: () => failures };
}

test('serializes and coalesces; drains include state submitted before settlement', async () => {
  const f = fixture();
  expect(await f.coordinator.drain()).toBe(true);
  f.coordinator.submit(snapshot('S1'));
  f.coordinator.submit(snapshot('S2'));
  f.coordinator.submit(snapshot('S3'));
  const a = f.coordinator.drain(); const b = f.coordinator.drain();
  let drained = false; void a.then(() => { drained = true; });
  f.pending[0]!.resolve({ revision: 1 });
  await Promise.resolve();
  expect(f.sent.map(item => item.revision)).toEqual([1, 3]);
  expect(f.acknowledgements).toEqual([[1, false]]);
  expect(drained).toBe(false);
  expect(f.coordinator.unsaved).toBe(true);
  f.pending[1]!.resolve({ revision: 3 });
  expect(await Promise.all([a, b])).toEqual([true, true]);
  expect(f.acknowledgements).toEqual([[1, false], [3, true]]);
  expect(f.coordinator.unsaved).toBe(false);
});

test('mismatched ack fails all drains; retry sends the newest retained revision', async () => {
  const f = fixture();
  f.coordinator.submit(snapshot('S1')); f.coordinator.submit(snapshot('S2'));
  f.coordinator.submit(snapshot('S3'));
  const a = f.coordinator.drain(); const b = f.coordinator.drain();
  f.pending[0]!.resolve({ revision: 1 }); await Promise.resolve();
  f.coordinator.submit(snapshot('S4'));
  f.pending[1]!.resolve({ revision: 2 });
  expect(await Promise.all([a, b])).toEqual([false, false]);
  f.coordinator.submit(snapshot('S5'));
  expect(await f.coordinator.drain()).toBe(false);
  expect(f.sent.map(item => item.revision)).toEqual([1, 3]);
  expect(f.failures()).toBe(1);
  f.coordinator.retry(); f.coordinator.retry();
  expect(f.sent.map(item => item.revision)).toEqual([1, 3, 5]);
  expect(f.sent[2]!.snapshot.scoStates['sco']!.values['cmi.core.lesson_location']).toBe('S5');
  const afterRetry = f.coordinator.drain();
  f.pending[2]!.resolve({ revision: 5 });
  expect(await afterRetry).toBe(true);
  expect(f.acknowledgements).toEqual([[1, false], [5, true]]);
  expect(f.coordinator.unsaved).toBe(false);
  f.coordinator.retry();
  expect(f.sent).toHaveLength(3);
});

test('contains a synchronous host throw and retries without allocating a revision', async () => {
  let calls = 0; let failures = 0;
  const coordinator = new SaveCoordinator({ saveState: (_context, submission) => {
    if (++calls === 1) throw new Error('Sync failure');
    return Promise.resolve({ revision: submission.revision });
  } }, context, { onAcknowledged: () => {}, onFailed: () => { ++failures; } });
  expect(coordinator.submit(snapshot('S1'))).toBe(1);
  expect(await coordinator.drain()).toBe(false);
  expect(failures).toBe(1);
  coordinator.retry();
  expect(await coordinator.drain()).toBe(true);
  expect(calls).toBe(2);
});

test('rejection retains state and retry is inert while a request is active', async () => {
  const f = fixture();
  f.coordinator.submit(snapshot('S1'));
  f.coordinator.retry();
  expect(f.sent).toHaveLength(1);
  const drained = f.coordinator.drain();
  f.pending[0]!.reject(new Error('Offline'));
  expect(await drained).toBe(false);
  expect(f.coordinator.unsaved).toBe(true);
  f.coordinator.retry();
  const retryDrain = f.coordinator.drain();
  f.pending[1]!.resolve({ revision: 1 });
  expect(await retryDrain).toBe(true);
});

test('a newer submission during retry must also be acknowledged before drain succeeds', async () => {
  const f = fixture();
  f.coordinator.submit(snapshot('S1'));
  const failedDrain = f.coordinator.drain();
  f.pending[0]!.reject(new Error('Offline')); await failedDrain;
  f.coordinator.retry();
  const drained = f.coordinator.drain();
  f.coordinator.submit(snapshot('S2'));
  f.pending[1]!.resolve({ revision: 1 }); await Promise.resolve();
  expect(f.acknowledgements).toEqual([[1, false]]);
  expect(f.sent.map(item => item.revision)).toEqual([1, 1, 2]);
  f.pending[2]!.resolve({ revision: 2 });
  expect(await drained).toBe(true);
  expect(f.acknowledgements).toEqual([[1, false], [2, true]]);
});
```

### Timeline and concurrency — 3 points

Sent revisions are **1, 3, 5**. Acknowledgement callbacks are `(S1/revision 1, false)` and `(S5/revision 5, true)`. Mismatched acknowledgement 2 for submission 3 produces one failure callback and no success callback. Both initial drainers settle false at that failure; the drain requested while failed also resolves false. After retry/acknowledgement of 5, the final drain resolves true and `unsaved=false`. A drain requested during that retry would also resolve true when 5 is acknowledged.

Award one point for requests/callbacks, one for drains/unsaved, and one for explaining write cancellation. `switchMap` unsubscribes client observation; an HTTP write may already have reached the server. Aborting a request cannot guarantee rollback and can hide its result. Serialize within the session, coalesce only unsent snapshots, and separately enforce server concurrency across sessions. Sending only a delta would not meet the full-snapshot coalescing assumption without an additional merge protocol.

**Hint:** “What if the server's response is for a different revision?” **Follow-up:** How would you bound `drain` without discarding the newest snapshot after a timeout?

## 4. Browser security and API integration

### Host/wrapper/course boundary — 6 points

Award one point per item:

1. Serve the wrapper and course from a dedicated origin distinct from the LMS application. The LMS validates the delivery descriptor before launch. A different path on the same origin provides no isolation. Do not share LMS credentials, broad-domain authentication cookies, or sensitive storage with the course origin. It must not have credentialed CORS access to private LMS endpoints.
2. Explain the sandbox risk: `allow-scripts allow-same-origin` with same-origin untrusted content permits access to the parent's DOM/storage and can undermine the sandbox. On a genuinely separate origin, the same-origin flag retains the wrapper/course relationship needed for conventional SCORM API discovery without granting LMS-origin access. An opaque-origin sandbox changes that integration model; do not blindly add flags to make it work.
3. Accept only `event.origin === expectedWrapperOrigin` and `event.source === currentFrame.contentWindow`, with a current launch/session binding. Compare parsed exact origins, not suffixes or substring matches. Ignore every message before an active validated frame exists.
4. Post only to the exact wrapper target origin and never send credentials. Validate message version, discriminated kind, exact required fields/types, bounded strings/payloads, and the active session/state. TypeScript casts are not runtime validation. Safely reject malformed data without throwing from the listener. A JSON character count is not a reliable UTF-8 byte count; guard serialization failures and bound parsed structures.
5. The wrapper hosts the synchronous SCORM API; the LMS host replays accepted operations against its own isolated runtime/data model and builds snapshots itself. Never trust a course-supplied snapshot or allow it to choose attempt identity. Validate element access, value format, and lifecycle order. Attribute outcomes and saves only to the bound attempt/SCO.
6. On activity change, flush ordered prior messages with a bounded timeout and retire the runtime before abandoning the SCO. Remove listeners, timers, and frames on disposal. For a new frame, the old frame's source check fails. If reusing a frame across navigations, its `WindowProxy` can retain identity: use a fresh per-launch token/handshake and lifecycle gating. Source/origin checks alone do not reject every message from a prior document in a reused frame.

Reference gating logic, with `parseBoundedOperation` explicitly responsible for strict runtime parsing:

```ts
function receive(event: MessageEvent): void {
  const active = currentLaunch;
  if (!active || event.origin !== active.origin || event.source !== active.frame.contentWindow) return;
  const message = parseBoundedOperation(event.data);
  if (!message || message.launchToken !== active.token) return;
  // replay checks current SCO lifecycle and data-model rules; it never accepts a host snapshot.
  active.runtime.replay(message.operation);
}
```

This is illustrative boundary logic, not a claim that Tessera's current bridge wire format already includes a launch token. [The current bridge](../../src/scorm-player/runtime/bridge-protocol.ts) has version 1 and operation messages. A token extension requires host/wrapper version compatibility or a fresh-frame design that removes the reuse problem. The course origin is untrusted even when allowed to communicate; a token prevents stale-launch mixing, not malicious behavior by the current course.

### Service contract — 6 points

Award one point each for authorization, bounded validation, durable acknowledgement, idempotency, stale-write policy, and cross-tab/global-version distinction.

One minimal defensible contract is optimistic concurrency with server versions:

- Authenticate at the service; authorize the session's learner/tenant against the attempt row. Validate course ID/revision and that the attempt is writable. Never use a client learner ID as proof of identity. For cookie authentication, include CSRF protection as required by the deployment.
- Validate and bound the JSON envelope, snapshot schema/edition/SCO identities, supported data model, local revision, and payload size. State must be bound to the same attempt/course revision. Reject invalid input before writing; do not rely on Angular validation.
- Add a host-adapter envelope with `writerSessionId`, `localRevision`, `expectedServerVersion`, and a retry operation key `(attempt, writerSessionId, localRevision)`. The server returns `serverVersion` plus the accepted local revision. The adapter can hide these service fields behind Tessera's existing `saveState` method and return `{revision}` only after durable acceptance.
- In a transaction, enforce a unique operation key. A duplicate with the same canonical payload fingerprint returns the recorded acknowledgement without a second write; reuse with different content is a conflict. Then compare the current server version with `expectedServerVersion`, perform the conditional update, increment the server version, and atomically record the operation result. A failed compare returns 409 and performs no write. Authenticate and authorize duplicate retries too.
- Include the current server version in the adapter's load response/state. Each acknowledged write updates the adapter's expected version. Two tabs loaded at version 12 may both call local revision 1: only one conditional write can advance to 13; the other conflicts. Its UI retains unsaved state and offers deliberate reconciliation/reload. Do not automatically overwrite or merge SCORM suspend data, which is opaque to the LMS.
- Acknowledge only after durable transaction commit. If the response is lost after commit, the same operation key safely recovers its acknowledgement. Deduplication must precede the version-conflict check for already committed operations. Return errors distinguishable as invalid input, authorization failure, conflict, or transient service failure. Do not endlessly retry 401/403/409.

The adapter must also remember an operation whose outcome is uncertain after a timeout. Before the coordinator retries a *newer* full snapshot, resolve that earlier operation through its stable key (retry/status lookup) and update the expected server version if it committed. Do not reuse its key for the newer payload, blindly advance the server version, or assume a timeout means no write occurred. A genuine competing-writer conflict still requires reconciliation. This is an adapter/service responsibility outside the bounded coordinator exercise.

PHP-style transaction sketch:

```php
// Pseudocode: helper names describe required behavior, not existing Tessera endpoints.
$user = authenticate($request);
$input = validateBoundedBody($request);
$result = $db->transaction(function () use ($db, $user, $input) {
    $attempt = $db->lockAttempt($input['attemptKey']);
    authorizeWritableAttempt($user, $attempt, $input['courseRevision']);
    $key = operationKey($attempt, $input['writerSessionId'], $input['localRevision']);
    $hash = canonicalSnapshotHash($input['snapshot']);
    if ($prior = $db->operation($key)) {
        if ($prior->hash !== $hash) throw conflict();
        return $prior->ack;
    }
    if ($attempt->serverVersion !== $input['expectedServerVersion']) throw conflict();
    $nextVersion = $attempt->serverVersion + 1;
    $db->saveAttempt($attempt, $input['snapshot'], $nextVersion);
    $ack = ['revision' => $input['localRevision'], 'serverVersion' => $nextVersion];
    $db->recordOperation($key, $hash, $ack); // unique key, same transaction
    return $ack;
}); // commits before a success response is sent
return $result;
```

A writer lease/fencing-token protocol is also acceptable when it clearly defines ownership, expiry, takeover and stale-write rejection. A UUID session ID alone prevents revision collisions but does not order competing writes. A larger browser-local revision is not evidence of a newer global snapshot. Extending Tessera's public boundary is necessary only if the component itself must expose conflict-specific UX or server-version ownership; adapter-only transport metadata does not require it. Explain which layer owns that behavior.

### SCORM commit semantics — 3 points

Award: synchronous/local versus durable distinction (1); ordered bridge/asynchronous ack (1); failure and navigation handling (1).

`LMSCommit('')` returns a SCORM string synchronously. A `'true'` return may mean the local runtime accepted the operation, with persistence queued under the documented host contract. It cannot synchronously wait for a normal REST request. It is not proof that a remote write is durable. The isolated wrapper can validate locally and post operations in order; the host independently validates and queues a snapshot. Preserve ordering through flush before retiring an activity.

The shell should distinguish saving, saved-current-state, and unsaved failure. An acknowledged earlier revision does not clear the saving/dirty status of newer state. On save failure retain state, announce it, offer Retry, and warn/block the controlled exit path until the user resolves the risk. Browser unload and `sendBeacon` cannot promise durable acknowledgement; do not offer a guarantee the browser cannot enforce.

**Follow-up:** The server commits but the response disappears. Why must a retry key survive a timeout, and why can the client not prove the write failed merely from an aborted fetch?

## 5. Accessibility and behavioral verification

### Corrected design — 7 points

Award one point for each group:

1. Keep DOM focus in the labelled editable input while navigating options. Use input `aria-expanded`, `aria-controls`, `aria-autocomplete="list"`, and `aria-activedescendant` referring to a mounted option only when appropriate. Track active navigation separately from selection; clear/update the descendant when its element disappears. The listbox has `aria-multiselectable="true"`; options expose `aria-selected` and applicable `aria-disabled`.
2. Loading, instruction, empty, error, Retry, and more-results UI are not selectable options. Use busy state during loading and a deliberate accessible retry mechanism. Retain useful results on an append failure; do not count status rows in active-index navigation or result totals.
3. Preserve native text editing. Space toggles only under the documented explicit option-navigation intent; otherwise it types a space. Respect text cursor movement and modifier keys. Do not search or select during IME composition, including composition-start cancellation of pending work. Enter's behavior depends on composing state, active enabled option, and retry/page context.
4. Chips have native, named remove buttons; clear-all and toggle are operable, labelled, and disabled consistently. Selection remains recognizable by identity across pages. Escape dismisses a visible tooltip first, then the popup, and only then may reach an outer dialog. Restore/retain predictable focus without trapping Tab; owning an overlay expands the form touch boundary, not the DOM subtree.
5. Announce settled result counts and selection changes politely and concisely. Use an assertive error announcement only when justified; avoid alerting every result or rapid keystroke. A response may populate a closed popup's cache without reopening it or announcing irrelevant availability. Repeated retry messages may need an intentional announcement update, not just unchanged text.
6. Reflect label, required, hint/error association and `aria-invalid` based on validation plus touched state. `aria-required` does not implement an Angular validator. Do not show invalid/error feedback on the untouched empty field under Tessera's contract. Render untrusted learner labels as text, not `innerHTML` or a sanitizer bypass.
7. Size the panel to the responsive field, position it without obscuring typing, bound it to the viewport, allow wrapping and internal vertical scroll, and keep controls/focus indicators visible. Hiding horizontal overflow masks inaccessible content; it is not a reflow fix. Preserve selections and runtime state through viewport/zoom changes. Account for RTL, forced colors, reduced motion, target size, and text spacing.

The [WAI-ARIA combobox pattern](https://www.w3.org/WAI/ARIA/apg/patterns/combobox/) supplies the input-focus foundation. Tessera documents its multi-select extension; do not claim every keyboard detail is dictated by a universal APG multi-select editable-combobox pattern. Semantics plus manual interaction evidence matter more than copying attributes.

### Page Object reference — 5 points

Award: two meaningful behavioral assertions (2); all DOM knowledge in the Page Object (1); deterministic fixture/timing (1); whole-control focus boundary and no fixed sleeps (1).

Declare a **proposed assessment fixture**, not an existing production API. It provides a screen at `/assessment/combobox` with a labelled `Learners` field, a selected Ada chip, an enabled `Clear all` action in the popup, a `Continue` button outside the control, and a visible `Form touched` output initially `false`. The popup action is an owned focusable control, not a listbox option. Searches are manually released and have no real network delay. `window.assessmentFixture.emit(query,page,items)` attempts delivery through the originally captured request channel (even after cancellation); `expectAttempts(keys)` checks issued requests. IDs/labels in these examples are fixture contract, not claims about Tessera's current demo DOM. A fixture implementation is needed to execute these illustrative browser tests.

```ts
import { expect, Page } from '@playwright/test';

export class AssessmentComboboxPage {
  constructor(private readonly page: Page) {}
  private get input() { return this.page.getByRole('combobox', { name: 'Learners', exact: true }); }
  async open(): Promise<void> {
    await this.page.clock.install();
    await this.page.goto('/assessment/combobox');
  }
  async type(query: string): Promise<void> { await this.input.fill(query); }
  async elapse(ms: number): Promise<void> { await this.page.clock.runFor(ms); }
  async emit(query: string, page: number, names: string[]): Promise<void> {
    await this.page.evaluate(({ query, page, names }) => {
      const fixture = (window as unknown as {
        assessmentFixture: { emit: (q: string, p: number, names: string[]) => void };
      }).assessmentFixture;
      fixture.emit(query, page, names);
    }, { query, page, names });
  }
  async expectAttempts(keys: string[]): Promise<void> {
    await this.page.evaluate(keys => {
      (window as unknown as {
        assessmentFixture: { expectAttempts: (keys: string[]) => void };
      }).assessmentFixture.expectAttempts(keys);
    }, keys);
  }
  async expectOptions(names: string[]): Promise<void> {
    await expect(this.page.getByRole('option')).toHaveText(names);
  }
  async focusInput(): Promise<void> { await this.input.focus(); }
  async focusChip(): Promise<void> {
    await this.page.getByRole('button', { name: 'Remove Ada', exact: true }).focus();
  }
  async openPopup(): Promise<void> { await this.input.press('ArrowDown'); }
  async focusPopupControl(): Promise<void> {
    await this.page.getByRole('button', { name: 'Clear all', exact: true }).focus();
  }
  async leaveControl(): Promise<void> {
    await this.page.getByRole('button', { name: 'Continue', exact: true }).focus();
  }
  async expectTouched(touched: boolean): Promise<void> {
    await expect(this.page.getByRole('status', { name: 'Form touched', exact: true }))
      .toHaveText(String(touched));
  }
}
```

```ts
import { test } from '@playwright/test';
import { AssessmentComboboxPage } from './assessment-combobox-page';

test('replacement typing rejects a stale response during debounce', async ({ page }) => {
  const screen = new AssessmentComboboxPage(page);
  await screen.open();
  await screen.type('a'); await screen.elapse(300);
  await screen.type('ab');
  await screen.emit('a', 0, ['Stale Ada']);
  await screen.expectOptions([]);
  await screen.expectAttempts(['a:0']);
  await screen.elapse(300);
  await screen.emit('ab', 0, ['Abel']);
  await screen.expectOptions(['Abel']);
  await screen.expectAttempts(['a:0', 'ab:0']);
});

test('only leaving the entire control marks the form touched', async ({ page }) => {
  const screen = new AssessmentComboboxPage(page);
  await screen.open(); await screen.focusInput();
  await screen.focusChip(); await screen.expectTouched(false);
  await screen.focusInput(); await screen.openPopup();
  await screen.focusPopupControl(); await screen.expectTouched(false);
  await screen.leaveControl(); await screen.expectTouched(true);
});
```

These tests deliberately contain no locators. Fixture orchestration also belongs to the Page Object. Configure only Chromium (`devices['Desktop Chrome']` or Chromium browser name). Pure controller tests do not need a browser. Add keyboard-only coverage in the full regression plan: `.focus()` here isolates the form boundary but alone does not prove every control is reachable by Tab.

### Manual evidence — 3 points

Award: major screen-reader/task evidence (1); zoom/text/reflow checks (1); honest distinction between automated and manual evidence (1).

Record tester, date, commit, package/OS/browser/AT versions, device, input method, scenario, observations and defects. Verify label, roles/states, active versus selected speech, result/error announcements, chip removal, retry, touched errors, Tab/Shift+Tab, Escape nesting, and selection limits. Include JAWS and NVDA on Windows/Chrome; TalkBack on Android/Chrome; Narrator on Windows/Edge (Chromium); and VoiceOver with Chrome on a supported macOS setup where feasible. Record platform/browser support limitations explicitly. Keep browser automation Chromium-only and do not configure or run Firefox/WebKit. Native/mobile VoiceOver coverage that would require another browser must remain a documented pending coverage gap under this assessment's browser constraint, not a claimed pass or an automated substitute.

Check keyboard-only operation separately, including mobile with a hardware keyboard where applicable. Test 320 CSS px and wider viewports, actual 400% browser zoom from a recorded desktop window size, 200% text enlargement, and [WCAG spacing overrides](https://www.w3.org/WAI/WCAG22/Understanding/text-spacing.html) (line height 1.5× font size; paragraph spacing 2×; letter spacing 0.12×; word spacing 0.16×). Verify no lost content/functions or horizontal page scrolling. Check popup positioning, readable labels, visible focus, and preserved state through resizing; verify actual touch/virtual-keyboard operation too. See [WCAG reflow guidance](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html) for the relationship between a 1280 CSS px-wide starting viewport at 400% zoom and 320 CSS px reflow.

Axe detects a subset of semantic/contrast defects; it cannot certify speech order, all keyboard behavior, or accessibility of external SCO content. Device scale factor changes raster density, not actual browser zoom behavior. A narrow CSS viewport is useful reflow evidence but cannot certify the behavior of real zoom, enlarged text, or spacing overrides. Pending checks stay pending. Do not mark manual verification complete because automation passed.

## 6. Production incident and delivery judgment

### Diagnosis — 3 points

- The logs show two acknowledged durable writes from different sessions and resume of `h1`. This supports a cross-tab last-write-wins overwrite; it does not prove that `h1` is semantically older without comparing the saved content/version history. Check server row/version/operation history and the tabs' loaded base versions. Client-side serialization only orders one coordinator's requests; tabs still compete. **1.5 points**
- The slow trace attributes much more time to repeated transformation/comparison and geometry/layout than to network. It suggests main-thread/rendering work rather than network as the principal interaction bottleneck. Capture comparable browser profiles and call counts, isolate chip/option and geometry paths, and repeat under the same dataset/hardware/throttling. A trace's intervals need not be additive if overlapping; validate attribution rather than subtracting blindly. **1.5 points**

### Containment and fixes — 4 points

Award one point for each group:

1. Preserve unsaved snapshots and expose a saving/unsaved/conflict status. An HTTP 200 is insufficient: validate the acknowledgement and whether it covers current state. For a quick cross-tab containment, prevent concurrent writable sessions through a server-enforced writer lease or temporarily disable the unsafe save path with a clear recovery flow. A local-storage lock is not authoritative. Do not silently reset attempts or discard another tab's state.
2. Fix lost updates through server conditional writes or fencing plus stable idempotency keys as in exercise 4. Recognize the server may have committed a timed-out request. Reject conflicts and retain local state for a deliberate resolution. Restoring the backend's last-write-wins behavior after a frontend rollback would not be safe; coordinate service compatibility and containment.
3. Reduce measured repeated work with stable identity lookup/cached derivations only when their invalidation is correct; coalesce geometry work per frame and avoid interleaving layout reads/writes. Confirm the behavioral and measured benefit. Do not replace arbitrary `compareWith` semantics with a map unless the API provides a stable identity contract. Virtualization is not a default fix: first prove need and preserve active-descendant, selection, scrolling, and screen-reader behavior if adopted.
4. Telemetry: opaque correlation token, coarse component/action name, package release, writer session identifier scoped appropriately, local/server revisions, acknowledgement category, conflict/failure counts, bounded timings, and aggregate dataset sizes. Protect tenant/attempt identifiers through the approved pseudonymous scheme and restricted access; never log learner names, tokens, raw suspend data, full snapshots, or sensitive URLs. Synthetic hashes in the prompt are diagnostic examples, not blanket permission to log fingerprints of real learner content.

### Delivery, rollout, and communication — 3 points

Award one point each for delivery sequence, operational criteria, and clear product tradeoff:

- Slice 1: reproduce conflicting writes with two independently loaded sessions, write a failing acceptance test for rejection of the second stale writer, implement the conditional-write boundary and idempotent retry, then verify conflict retention in the shell. Slice 2: reproduce the misleading saved indicator with queued revisions, write the failing UI acceptance test, repair it, and run player persistence/resume regressions. Slice 3: reproduce the measured expensive interaction, add a bounded behavioral/performance check before the specific optimization, then profile and run the combobox regressions. Existing covered behavior may need an extended counterexample rather than a redundant passing test. Do not claim a test demonstrated red if it passed initially.
- CI: type/build/package/API compatibility checks as applicable; pure logic/unit tests; Chromium acceptance tests through Page Objects for latest-ack status, retry, query invalidation, forms, keyboard and focus; automated accessibility checks; appropriately controlled performance samples. Manual screen-reader/zoom/text checks remain release evidence, not simulated assertions. Extend the packed-consumer smoke check when a public packaging/API change occurs. Coordinate transport/service migrations so older clients fail safely instead of bypassing concurrency checks.
- Roll out to a small cohort with conflict and lost-update monitoring, save failure/current-ack metrics, and comparable interaction p95. Example predefined stop condition: any confirmed silent stale overwrite in the cohort, or p95 above 200 ms for the controlled chip-toggle scenario in two consecutive comparable runs, pauses rollout and disables/reverts the affected path with compatible server safeguards retained. Treat this threshold as the scenario's chosen rollout policy, not a universal field-performance target. Product explanation: “We will keep unsaved progress visible and ask conflicting sessions to reconcile. This adds a recovery step, but prevents one tab from silently replacing another tab's work. We will optimize the measured rendering bottleneck without changing selection or keyboard behavior.”

**Follow-up:** How do you roll back a frontend release after the server has begun rejecting stale writes? Look for compatibility planning, explicit conflict UX, and retained server protection.

## Assessor verification and calibration

Document verification on 2026-10-04: the six complete TypeScript examples (both controllers, their two unit-test modules, the Page Object, and the browser-test module) compiled with strict TypeScript, unchecked-index checks, and property-access checks against the installed dependencies. All **14 controller tests passed** in Vitest. Browser examples were compiled but not run because they require the explicitly proposed fixture. No manual accessibility checks were performed for this documentation task. These results validate the reference examples, not candidate ATDD history or production component accessibility.

Before use, run the reference controller tests in a scratch project with the repository's RxJS, TypeScript and Vitest versions, and compile the reference modules in strict mode. The browser examples require the declared fixture; they are illustrative code, not executed Tessera tests. Check the point totals and every scenario against the answer key. Do not infer failing-first history from these verification runs.

Pilot the timing with engineers at the target level. If many cannot finish, retain the fixed deadline and assess partial evidence before changing task scope; update both documents together if calibration shows setup or ambiguity consumes the intended engineering time. Use the same prompts and recorded hints for each candidate. Role alignment does not establish an exact difficulty ranking against Karat's proprietary material.
