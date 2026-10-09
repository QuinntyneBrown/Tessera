# @tessera/scorm-player

An Angular component that plays SCORM 1.2 and SCORM 2004 (2nd, 3rd and 4th Edition) courses inside a learning
management system (LMS). It applies each edition's run-time data model and, for SCORM 2004, the course's sequencing
and rollup rules. See [implementation status](../../docs/detailed-designs/implementation-status.md) for what is and
is not covered.

```ts
import { ScormPlayer } from '@tessera/scorm-player';
```

```html
<tsr-scorm-player
  [source]="source"
  [attempt]="attempt"
  [host]="host"
  [limits]="limits"
  (event)="onEvent($event)"
/>
```

| Input     | Meaning                                                                                     |
| --------- | ------------------------------------------------------------------------------------------- |
| `source`  | `{ kind: 'manifest', manifestUrl }` for an extracted course, or `{ kind: 'zip', file }`     |
| `attempt` | `{ attemptKey, courseKey, courseRevision }` issued by the LMS for the authenticated learner |
| `host`    | `loadAttempt`, `saveState` and `prepareDelivery`, each authorized by the LMS                |
| `limits`  | Optional `{ archiveBytes, expandedBytes, entryCount }` for ZIP packages                     |

The `event` output emits `save`, `outcome`, `error` (with a `category` of `integration`, `loading`, `runtime` or
`persistence`) and `exit`.

`prepareDelivery` must return the URL of the wrapper (built by `tools/build-wrapper.mjs`) and the course root, both
on an origin different from the LMS's. For a ZIP package the course carries its validated `files`, which the host
serves under that root. The player refuses to launch otherwise.

The `AttemptSnapshot` passed to `saveState` and returned by `loadAttempt` is opaque to the host: store it whole.
For SCORM 2004 its `sequencing.tracking` holds the attempt counts and reported results that sequencing and rollup
work from, so a resumed attempt keeps its attempt limits and prerequisites. Outcome events for SCORM 2004 carry the
course's rolled-up `completion`, `success` and scaled `score`; anything not yet known is `'unknown'`.

A runnable example is in `src/components-examples/tessera/scorm-player/`.

## Shared design tokens

Use the [shared theme API](../theme/README.md) to customize player-owned controls and messages through `--t-<tokenName>` properties. Defaults follow the system light/dark preference; explicit themes on a document root, container or player host take precedence. Course iframe content retains its own styles.

## Testing with the harness

`ScormPlayerHarness` (an Angular CDK component harness) reads and operates the player's own controls in your tests:
the course title, the outline with each activity's availability and reason, Next and Previous, the outcome, the
save status and errors. Loading is asynchronous, so wait until `getCourseTitle()` returns a title before operating
the course. Course content runs in an isolated frame that the harness does not reach.

```ts
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { ScormPlayerHarness } from '@tessera/scorm-player';

const player = await TestbedHarnessEnvironment.loader(fixture).getHarness(ScormPlayerHarness);
await player.chooseActivity('Lesson two');
expect(await player.getNavigationReason('Next')).toBe('This is the last activity.');
```
