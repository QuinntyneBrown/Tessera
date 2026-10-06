# Senior Angular Product Engineer assessment

**Tessera · Docebo Senior Product Engineer II — Frontend preparation**  
**Duration:** 180 minutes, including 10 minutes to read and prepare. **Score:** 100 points.

This is an original assessment based on Tessera and the supplied Docebo role description. It is not an official Docebo or Karat test. Its intended difficulty is a demanding senior engineering interview: correctness under concurrency, Angular expertise, browser security, accessibility, and production ownership. A ranking against Karat's private question bank cannot be verified. [Karat describes Studio as its interview coding environment](https://karat.com/why_we_interview/), rather than a single standardized exam.

## Candidate instructions

You may read this repository and official framework, language, browser, accessibility, and testing documentation. Do not use AI assistance, answer sites, or the answer-key document. Work in an isolated scratch project or assessment branch. Do not fix Tessera's production components as part of this assessment. No setup time is deducted: the assessor must provide a working Angular/TypeScript environment and Chromium before the clock starts.

Submit code and tests for exercises 2 and 3, corrected excerpts and reasoning for exercise 1, and written answers for exercises 4–6. Show your reasoning with timelines and concrete counterexamples. Concise, correct solutions score better than unnecessary infrastructure. Explicitly distinguish implemented behavior from proposed changes. If time expires, submit partial work and list the missing behaviors.

For each coding exercise, take small slices: write Given–When–Then criteria, write a behavioral test, run it and record the expected failure, implement the slice, then run relevant regression tests. Do not weaken tests to obtain a pass. Pure controllers may use Vitest; browser acceptance tests must use Playwright in Chromium, with one Page Object per screen owning all selectors and interactions. Do not write codebase structure or naming tests. Exercises 2 and 3 require no Angular UI implementation; exercise 5 asks how you would verify their integration with a UI.

### Project facts and references

- Tessera is a browser-only Angular library using Angular CLI and ng-packagr; no Bazel or SSR. The installed Angular major is 22; use the repository's installed packages rather than installing an arbitrary version.
- The [SCORM player](../../src/scorm-player/README.md) isolates untrusted learning content and exchanges saved state with an LMS through `HostIntegration`. Its implemented runtime is SCORM 1.2; SCORM 2004 editions are detected and refused, not fully implemented. See [implementation status](../detailed-designs/implementation-status.md).
- The [combobox](../../src/combobox/README.md) is an asynchronous multi-select Angular form control. Its source contract is `searchFn(query, page): Observable<ComboboxPage<T>>`, with zero-based pages, `items`, `hasMore`, and optional `total`.
- Use [L1 requirements](../specs/L1.md) and [L2 requirements](../specs/L2.md) for context. The bounded exercise contracts below govern assessment code; they do not replace the full production specification.
- Accessibility means WCAG 2.2 AA, keyboard operation, and verified screen-reader behavior. The player shell cannot guarantee that third-party course content is accessible. Tessera's [manual verification matrix](../verification/combobox-screen-reader-matrix.md) has pending checks; an automated pass is not a manual sign-off.

| Exercise | Minutes | Points |
| --- | ---: | ---: |
| Orientation | 10 | — |
| 1. Angular debugging and forms | 25 | 15 |
| 2. Asynchronous combobox coding | 45 | 25 |
| 3. SCORM persistence coding | 40 | 20 |
| 4. Browser security and API integration | 25 | 15 |
| 5. Accessibility and behavioral verification | 20 | 15 |
| 6. Production incident and delivery judgment | 15 | 10 |
| **Total** | **180** | **100** |

## 1. Angular debugging and forms — 15 points

The following **deliberately defective assessment excerpt** is not Tessera's current implementation. Assume an OnPush standalone Angular component implementing `ControlValueAccessor`, with correct `NG_VALUE_ACCESSOR` registration. The popup is attached through CDK Overlay outside the host subtree. Ignore omitted template boilerplate.

```ts
readonly value = signal<Learner[]>([]);
readonly disabled = input(false);
readonly formDisabled = signal(false);
readonly results = signal<Learner[]>([]);
private onChange = (_: Learner[]) => {};
private onTouched = () => {};
private resizeObserver!: ResizeObserver;

writeValue(value: Learner[] | null): void {
  this.value.set(value ?? []);
  this.onChange(this.value());
}
setDisabledState(disabled: boolean): void {
  this.formDisabled.set(disabled);
}
select(learner: Learner): void {
  this.value().push(learner);
  this.onChange(this.value());
}
onInputBlur(): void {
  this.onTouched();
}
ngOnInit(): void {
  this.resizeObserver = new ResizeObserver(() => this.reposition());
  this.resizeObserver.observe(this.host.nativeElement);
  this.searches.subscribe(query => {
    this.searchFn()(query, 0).subscribe(items => this.results.set(items.items));
  });
}
```

1. Identify six distinct defects or missing behavior, connect each to a user-visible failure, and give a minimal correction. Include why signals and OnPush do not make `push` safe. **6 points**
2. Show corrected value/disabled/touched handling. Selections use `learner.id` identity, duplicate selection is ignored, and focus within the overlay or chip controls must not mark touched. Disabled means every interaction is blocked, requests are cancelled, and the popup closes. Explain `updateOn: 'blur'` and `updateOn: 'submit'` without implementing Angular's form scheduling yourself. **6 points**
3. Explain a zoneless-safe rendering and cleanup strategy, and name three behavioral regression checks. Do not propose adding Zone.js, a global state store, or arbitrary `detectChanges()` calls as the default repair. **3 points**

## 2. Asynchronous combobox coding — 25 points

Implement a plain TypeScript `SearchController<T>` around the existing source contract. Its interface is:

```ts
type SearchPhase = 'idle' | 'debouncing' | 'loading' | 'ready' | 'error';
interface SearchState<T> {
  readonly query: string;
  readonly items: readonly T[];
  readonly page: number; // last successful page, initially -1
  readonly hasMore: boolean;
  readonly phase: SearchPhase;
}
// Constructor receives source, debounceMs, minLength, and onState(state).
// Methods: input(query), loadNext(), retry(), destroy().
```

Use exact query text; no trimming or case normalization. Assume nonnegative debounce, minimum length at least one, valid pages, and a non-throwing, non-reentrant `onState` callback. The first page is 0. Source invocation may throw synchronously, error asynchronously, or complete without emitting. A successful page is the first emission; ignore subsequent emissions. Selection belongs to the Angular control, outside this controller. Do not implement caching, IME, disabled state, rendering, or duplicate-entity merging in this exercise.

Required behavior:

- Changing input immediately invalidates previous work, even before the new debounce expires. Unsubscribe the old request and cancel its debounce. A stale completion must not change state. Identical consecutive input is a no-op, including in an error state; retry is explicit.
- A qualifying input starts page 0 after the debounce. Old items may remain visible while waiting, but paging is blocked. The new successful page 0 replaces old items.
- Input below `minLength` clears items, page, and `hasMore`, enters idle, and issues no request. Destroy cancels all work and makes later calls no-ops, with no later state notifications.
- `loadNext()` works only after a successful current-query page with `hasMore`. Only one request can be active. Append subsequent successful pages in order. Repeated paging triggers while loading do nothing.
- A failure keeps existing items and the last successful page, enters error, and does not escape to the caller. Automatic paging is blocked after failure. Retry immediately requests precisely the failed query/page; another input cancels that retry opportunity. Retry while loading or outside error does nothing.

### Adversarial timeline

With 300 ms debounce and minimum length 1:

| Time | Event |
| ---: | --- |
| 0 | `input('a')` |
| 300 | Request `a:0` begins |
| 310 | `input('ab')` |
| 320 | Old underlying `a:0` work completes with `[Ada]` |
| 330 | `loadNext()` |
| 610 | Request `ab:0` begins |
| 620 | `ab:0` emits `[Abel]`, `hasMore: true` |
| 630 | Two `loadNext()` calls |
| 640 | `ab:1` errors |
| 650 | `loadNext()` |
| 660 | `retry()` |
| 670 | `ab:1` emits `[Abby]`, `hasMore: false` |
| 680 | `input('')` |

State the requests and visible results at 320, 640, 670, and 680. Explain why `debounceTime(300), switchMap(...)` alone is insufficient for this contract. Assume Observable unsubscription cannot guarantee that the remote server stops its work.

Deliver: incremental acceptance evidence and deterministic tests **7 points**; correct controller **14 points**; timeline and operator explanation **4 points**. Include first-page failure, append failure/retry, invalidation within the debounce window, duplicate paging, synchronous throw, empty completion, and destruction in your verification. Avoid real-time sleeps.

## 3. SCORM persistence coding — 20 points

Implement a plain `SaveCoordinator` with `submit(snapshot): number`, `retry(): void`, `drain(): Promise<boolean>`, and an `unsaved` getter. Use Tessera's `AttemptContext`, `AttemptSnapshot`, `SaveSubmission`, `SaveAck`, and `HostIntegration.saveState` types; bind the context in the constructor. Also accept non-throwing callbacks `onAcknowledged(submission, upToDate)` and `onFailed()`.

Scope and contract:

- Snapshots are complete, deeply immutable, already validated, and belong to the bound attempt. The caller must not mutate them after submission. This instance starts at local revision 1 and lives for one player session.
- Each submit increments the local revision and retains the newest snapshot. Send immediately if not in flight or failed. There is at most one save in flight; replace queued intermediate snapshots with the newest one. Do not cancel an in-flight write when a new snapshot arrives.
- A save succeeds only if the acknowledgement revision exactly matches the submitted revision. Promise rejection, synchronous throw, and mismatched acknowledgements are failures. Never report the latest state saved merely because an older save succeeded.
- On success, notify once with the acknowledged submission and whether it is still the latest. Send any newer queued snapshot. On failure, notify once, retain the newest snapshot, and stop automatic saving, including after further submits. Retry sends the newest snapshot using its existing revision, without allocating a new revision.
- Retry is a no-op unless failed and not in flight. `unsaved` remains true until the latest revision is acknowledged.
- `drain()` settles true once the latest state is acknowledged, or false when saving fails. Multiple simultaneous drainers must settle consistently. New submissions before settlement are included. A failed drain does not later turn true; callers may request a new drain after retry. With no pending state, resolve true immediately.

Disposal, persistence across page reload, write timeouts, multi-tab arbitration, and offline queues are outside the coding exercise. Explain their integration risks in exercises 4 and 6 instead.

### Adversarial timeline

1. Submit S1, S2, S3; S1 remains in flight. Call `drain()` twice.
2. Acknowledge revision 1. The next request must carry S3/revision 3.
3. Submit S4 while revision 3 is in flight. The server returns acknowledgement revision 2 for that request.
4. Submit S5 while failed. Call `drain()` again.
5. Retry. Acknowledge the retried request successfully. Call `drain()` again.

List every sent revision, callback and `upToDate` value, each drain result, and `unsaved` at the end. Explain why replacing all saves with `switchMap` is dangerous.

Deliver: incremental criteria and deterministic tests **6 points**; implementation **11 points**; trace and concurrency explanation **3 points**. Include mismatched acknowledgement, synchronous throw, retry with a newer snapshot, and multiple drainers.

## 4. Browser security and API integration — 15 points

The following **deliberately unsafe assessment proposal** launches a course from the LMS origin:

```ts
iframe.src = '/uploads/course/index.html';
iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin');
window.addEventListener('message', event => {
  if (event.data.kind === 'set') {
    session.setValue(event.data.element, event.data.value);
  }
  if (event.data.kind === 'commit') save(event.data.snapshot);
});
iframe.contentWindow!.postMessage({ kind: 'credentials', token }, '*');
```

The LMS then stores progress using this **intentionally incomplete PHP-style pseudocode**. `save` overwrites the current row; `attemptKey` is globally unique. No hidden middleware performs authorization or validation.

```php
function saveProgress($request, $db) {
    $body = $request->json();
    $db->save($body['attemptKey'], $body['snapshot']);
    return ['revision' => $body['revision']];
}
```

1. Propose the smallest safe host/wrapper/course design. Specify delivery origin, credential boundary, sandbox implications, exact incoming origin and window-source checks, outgoing target origin, message validation, host replay through the runtime, and cleanup on activity change. Address late messages from the previous frame. **6 points**
2. Repair the service contract. Specify authenticated attempt ownership and course revision checks, untrusted-body validation and bounds, acknowledgement timing, idempotent retries, stale-write handling, and two tabs each generating local revision 1. Do not assume a browser-local revision is a globally ordered server version. Explain any minimum contract extension needed beyond Tessera's current public boundary; PHP pseudocode is acceptable. **6 points**
3. SCORM 1.2 exposes synchronous string-returning calls such as `LMSCommit('')`. Does a `'true'` return prove durable server persistence? Explain local acceptance, ordered bridge delivery, asynchronous save acknowledgement, visible failure/retry, and safe navigation. **3 points**

Do not implement a SCORM 2004 runtime. No credentials or authorization authority may be delegated to course code.

## 5. Accessibility and behavioral verification — 15 points

A proposed multi-select combobox uses a labelled input with `role="combobox"`, an overlay `role="listbox"`, and chip remove buttons. Arrow Down focuses the option element, loading and error rows have `role="option"`, Space always toggles the active item, and Enter selects even while IME composition is active. The selected chip label is rendered with `innerHTML`. The panel has fixed `width: 600px`, and horizontal overflow is hidden on the body. Each result-count announcement uses `role="alert"`. Errors are shown immediately on an untouched required field. Escape bubbles to a containing dialog and closes it before the popup.

1. Correct the interaction and accessibility design. Include active versus selected states, input focus and valid `aria-activedescendant`, multi-select listbox semantics, loading/error rows, IME and native text editing, chip controls, popup/tooltip Escape priority, announcements, required/invalid state, safe text rendering, and reflow. **7 points**
2. Write two representative Playwright tests and the Page Object methods they depend on: (a) typing a replacement query cannot admit a stale response during debounce; (b) focus movement to a chip or popup control does not mark touched, but leaving the entire control does. Declare the deterministic test fixture contract you need. Tests must contain no selectors; a single screen Page Object owns locators, actions, fixture control, and assertions. **5 points**
3. Describe the manual release evidence needed for JAWS, NVDA, VoiceOver, TalkBack, and Narrator; keyboard-only use; 320 CSS px; actual 400% browser zoom; 200% text enlargement; and WCAG text-spacing overrides. Explain why axe, device scale factor, and a narrow viewport cannot certify all of this. Keep automated frontend testing Chromium-only. **3 points**

The manual plan is written work; candidates are not expected to own five screen readers or claim they executed it during the timed assessment.

## 6. Production incident and delivery judgment — 10 points

The following measurements and logs are **synthetic incident evidence**, not existing Tessera results. After a release, some learners report that a resumed course loses their latest progress and the learner-search field stalls. The UI displays “Saved” after each HTTP 200.

```text
12:00:00 tab=A session=X localRevision=8 save begin payloadHash=h8
12:00:01 tab=B session=Y localRevision=1 save begin payloadHash=h1
12:00:02 tab=A session=X localRevision=8 HTTP 200 ack=8 durableWrite=true
12:00:03 tab=B session=Y localRevision=1 HTTP 200 ack=1 durableWrite=true
12:00:04 resume attempt=K payloadHash=h1

Trace of a slow interaction with 200 chips and 250 options:
  network request: 42 ms
  next displayed selection frame: 286 ms
  main-thread tasks: repeated displayWith/compareWith calls 118 ms;
                     overlay geometry measurement/layout 101 ms
  remaining intervals: rendering and scheduling
100 comparable samples: interaction p95=310 ms; previous release p95=92 ms
```

1. State two likely mechanisms, what the evidence proves versus merely suggests, and one discriminating check for each. Explain why serializing saves in one tab does not resolve both tabs. **3 points**
2. Propose minimal containment and fixes that preserve learner work. Name safe telemetry fields, avoid learner data in logs, and distinguish HTTP success from current durable state. Use measured evidence to prioritize performance work. **4 points**
3. Give a small ATDD delivery sequence, regression/CI gates, rollout signals and a concrete rollback condition. Include a clear product-facing explanation of the tradeoff. Do not use “rewrite with a global store,” “add virtualization,” or “retry everything” without proving they are necessary. **3 points**

## Submission checklist

- [ ] Answers are numbered 1–6 and code has a reproducible run command.
- [ ] Coding solutions include Given–When–Then criteria, actual failing-first evidence, final passing evidence, and remaining limitations.
- [ ] Timelines identify observable behavior rather than only naming operators or patterns.
- [ ] Frontend tests use Chromium and Page Objects; manual checks are recorded as a plan unless actually performed.
- [ ] No answer claims browser validation replaces server authorization or an automated accessibility scan proves screen-reader compatibility.
