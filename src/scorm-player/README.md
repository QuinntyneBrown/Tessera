# @tessera/scorm-player

An Angular component that plays SCORM 1.2 courses inside a learning management system (LMS). SCORM 2004 courses
are recognised and refused until their rules are supported. See
[implementation status](../../docs/detailed-designs/implementation-status.md).

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

A runnable example is in `src/components-examples/tessera/scorm-player/`.

## Shared design tokens

Use the [shared theme API](../theme/README.md) to customize player-owned controls and messages through `--t-<tokenName>` properties. Defaults follow the system light/dark preference; explicit themes on a document root, container or player host take precedence. Course iframe content retains its own styles.
