# Implementation status

This records how far the production implementation has come against the [detailed designs](README.md),
the decisions made where a design said `<TO SUPPLY>`, and where the implementation departs from a design.
The [combobox designs](combobox/) describe its implemented contracts. The [video player](#video-player) section is at the end;
the other status sections concern the SCORM player.

## Covered

SCORM 1.2 and SCORM 2004 2nd, 3rd and 4th Edition work end to end for an extracted course and for a ZIP package:
loading and validation, isolated launch, each edition's runtime and data model, saving with retry, resume,
outcomes, the outline and Previous/Next navigation, SCORM 2004 sequencing and rollup, the accessible, responsive
shell, the consumer test harness and the load benchmark. Every slice has a failing-first Chromium acceptance test
through `PlayerPage` (`test/e2e/pages/player-page.ts`) plus unit tests for the pure logic. Where a later slice's test
passed on first run because an earlier slice already satisfied it, the commit says so and a mutation of the
production code was shown to fail the test.

SCORM 2004 sequencing covers: choice, flow, forward-only and choice-exit control modes; attempt limits; precondition
rules (`disabled`, `skip`, `hiddenFromChoice`, `stopForwardTraversal`) with three-valued conditions on objectives,
completion, attempts and limits; local and global objectives with read and write maps; rollup of measure,
satisfaction and completion by measure, by rollup rules or by the ADL default, with rollup controls; SCO navigation
requests (`continue`, `previous`, `{target=}choice`, 4th Edition `{target=}jump`, `exit`, `exitAll`, `abandon`,
`abandonAll`, `suspendAll`); `adl.nav.request_valid`; new attempts with fresh run-time data unless suspended; and
resume of the saved tracking.

## Not implemented

| Area | Requirement | State |
|------|-------------|-------|
| SCORM 2004 post-condition and exit-action rules | `L2-006` | Not read. A course that relies on them (for example `retry` or `exitParent` after a SCO ends) gets no automatic action; the learner navigates instead. |
| SCORM 2004 time limits, availability windows, delivery controls, randomization and selection | `L2-006` | Not tracked. Time-limit and availability-window conditions never hold; every child is delivered in manifest order. |
| `imsss:sequencingCollection` and `IDRef` | `L2-006` | Not resolved; sequencing must be declared inline on each item. |
| 4th Edition completion threshold and progress-measure rollup | `L2-009`, `L2-012` | `cmi.completion_threshold` reads as unset, and course progress stays `unknown`. |
| Edition-specific sequencing differences | `L2-006` AC3 | The 2nd, 3rd and 4th Editions share one engine; only the runtime differences (suspend data size, `jump`, `adl.data`) are edition-specific. |
| Manual screen reader verification | `L2-017` AC4 | Not done. See the [player screen reader matrix](../verification/scorm-player-screen-reader-matrix.md); only the automated axe-core checks and keyboard tests ran. |
| Persistence across crashes | design `save-progress` | Out of scope, as the design states. |

## Decisions made where the designs said `<TO SUPPLY>`

| Decision | Choice |
|----------|--------|
| Angular | 22.x, standalone component, signals, `OnPush` |
| Selector and API | `tsr-scorm-player`; inputs `source`, `attempt`, `host`, `limits`; one `event` output carrying `PlayerEvent` (`save`, `outcome`, `error`, `exit`) |
| Archive library | `fflate`; its asynchronous `unzip` extracts in a worker and can be terminated |
| Default package limits | archive 100 MB, expanded 500 MB, 10,000 entries (`package/limits.ts`) |
| Edition detection | `schemaversion`: `1.2`, `CAM 1.3` (2nd), `2004 3rd Edition`, `2004 4th Edition` |
| Commit and finish policy | `LMSCommit` and `LMSFinish` return `"true"` once the call is valid; the shell says "Saving progress" until the host acknowledges the revision |
| Delivery isolation | The wrapper and course share one origin that must differ from the LMS origin; the outer frame uses `sandbox="allow-scripts allow-same-origin"` |
| Wrapper distribution | Bundled by `tools/build-wrapper.mjs`; the host serves it and passes its URL in `DeliveryDescriptor.wrapperUrl` |
| Bridge | Protocol version 1, messages up to 64 KiB, strict shape checks, flush timeout 5 s |
| Correlation token | A 64-bit FNV-1a hash of the attempt context, stable per attempt and not reversible by inspection |
| Exit | The player emits `{kind: 'exit', saved}`; the host decides what leaving means |
| SCORM 2004 over-limit values | A value longer than the edition's smallest permitted maximum (for example suspend data over 4,000 characters in the 2nd and 3rd Editions, 64,000 in the 4th) fails with 407, as `L2-009` AC3 requires, although ADL only sets a minimum an LMS must accept |
| Sequencing tracking | Stored in `AttemptSnapshot.sequencing.tracking`: attempt counts, each SCO's completion and objectives, and global objectives. Module status is rolled up when needed, never stored |
| Starting a course whose root does not flow | The first activity the learner may choose opens, as an LMS offers it |
| SCO navigation request timing | Processed after `Terminate`, once the final state is saved. A course-driven launch moves focus to the activity heading when focus was in the retired activity, and is announced in a polite live region otherwise |
| Navigation request validity | Computed when the SCO launches and sent with the wrapper's `prepare` message; it is not updated during the SCO's session |
| Consumer harness | `ScormPlayerHarness`, exported from the package's main entry point; `@angular/cdk` is a peer dependency |

## Departures from the designs

- **Package parsing.** `DOMParser` is not available in workers, so the manifest is parsed on the main thread. Only
  extraction runs off it (inside fflate's workers). There is no separate `PackageWorker` class.
- **Actual expanded size.** fflate preallocates from the declared size, so the entry-count and expanded-size limits
  are enforced from declared sizes while extracting and re-checked against the actual sizes afterwards.
- **A missing `source` is not an integration error.** `L2-021` AC3 names only the attempt and persistence inputs.
- **Runtime failure.** The player reports a runtime error when the host's own session rejects an operation that the
  wrapper's session accepted. It reports it once per session and keeps the activity running, so earlier valid state
  still saves.
- **Wrapper session end.** On the host's flush request the wrapper ends its own session, so a late call from a
  retiring SCO fails with error 301.
- **Outcome events.** One `outcome` event follows each acknowledged save; SCORM 1.2 reports lesson status and score
  and leaves completion, success and progress `unknown`; SCORM 2004 reports the organization's rolled-up completion,
  success (`passed` or `failed`) and measure as `score.scaled`, leaves `status` and progress `unknown`, and
  reports `unknown` for anything rollup cannot yet determine.
- **Outline.** Modules are shown as nested lists with their titles; only launchable items are buttons, so a learner
  chooses a module's activities rather than the module itself.

## Running things

`pnpm` is not on `PATH` on every machine; `corepack pnpm <script>` works anywhere Node does.

- `pnpm lint`, `pnpm test` (unit), `pnpm build`, `pnpm e2e` (Chromium only), `pnpm api:check`
- `pnpm e2e:performance` runs the 100-run load benchmark (`L2-019` AC1) and records its timings
- `pnpm api:update` regenerates `goldens/scorm-player/index.api.md` after a deliberate public API change

## Video player

L2-057 to L2-084 are implemented in `@tessera/video-player` and verified by Chromium acceptance tests through
`VideoPlayerPage` (`test/e2e/pages/video-player-page.ts`) against an in-page fixture transport that replays the
committed `src/e2e-app/public/lecture-10s.fmp4`, plus vitest specs for the SignalR adapter, the reconnect policy, the
announcer and the strings. The slice-by-slice evidence is in the
[video player implementation record](../verification/video-player-implementation.md).

### Not implemented

| Area | Requirement | State |
|------|-------------|-------|
| Demonstration backend | `L2-085` to `L2-094` | Not started. `video-player-backend.spec.ts` skips unless `TESSERA_VIDEO_HUB_URL` is set; the dev app falls back to the replayed fixture. |
| Manual screen reader verification | `L2-083` | Not done; every row of the [matrix](../verification/video-player-screen-reader-matrix.md) is Not run. |
| Actual 400% browser zoom | `L2-073` AC3 | Manual; the automated check is the 320 by 256 CSS px reflow viewport. |

### Decisions made where the designs said `<TO SUPPLY>`

| Decision | Choice |
|----------|--------|
| Transport configuration | Optional `configure({ hubUrl, accessTokenFactory })` and `stop()` on `VideoStreamTransport`; the session calls `configure` before each connection's first `describe` |
| Default transport | `VIDEO_STREAM_TRANSPORT` has no root factory; a player without a provider creates its own `SignalRVideoStreamTransport`, so each owns its connection |
| Stream and hub changes | A `streamId` change keeps the connection; clearing `streamId`, a new `hubUrl` or token factory, Retry and destroy stop it |
| Development warning | Once per player, origin only: "the hubUrl origin {origin} does not use TLS…" for non-TLS hosts other than `localhost` and `127.0.0.1` |
| Live duration | `duration(seconds)`: "less than a minute", "1 minute", "{m} minutes", "{h} hour(s) {m} minute(s)"; `endedAfter` and `liveFor` receive the result |
| `bufferedAheadSeconds` | End of the buffered range containing `currentTime` minus `currentTime`, rounded to 0.1 s; `latencySeconds` uses the newest range |
| Title strings | Functions: `regionLabel(title)`, `connecting(title)`, `errorUnsupported(mimeType)` |
| Space on a focused button | Toggles playback and prevents the button's activation, as L2-069 AC1 states; Enter still activates buttons |
| Focus fallback | The nearest enabled control, preceding first; with none enabled, the region (`tabindex="-1"`) |
| `autoplay = false` | The first frame waits paused at the live edge with the central play affordance |
| Harness selectors | `data-control` attributes, `data-state`, `t-video-player__status` and the `role="alert"` panel, so i18n overrides need nothing extra |
| 401 and 403 | A rejection carrying either `statusCode` maps to `unauthorized` |
| Shared-token fallbacks | `accent-fg` → `colorNeutralForegroundOnBrand`, `live` → `colorPaletteRedForeground1`, `motion-duration` → `durationNormal`; caption colours have built-in values only |
| Dev-app backend origin | `http://localhost:5180` (`/demo/token`, `/hubs/video`), overridable with `?backend=` |
| SignalR wire format | Integer-keyed MessagePack objects arrive as arrays and are mapped to descriptors and chunks |

### Departures from the designs

- **Visible control labels.** Controls show icons only at every width; their names are in `aria-label`. The design
  showed icon and text in the wide layout.
- **Opaque scrim.** The control bar uses the shared `colorNeutralBackground1` token rather than the mock's
  translucent dark scrim, so its contrast never depends on the picture.
- **Reconnect attempts.** `ReconnectPolicy` displays the attempt on the schedule; the SignalR client performs the
  attempts with the same delays.
- **Keyboard focus keeps the bar visible; pointer focus does not.** A tapped or clicked control does not pin the bar,
  so `L2-074` AC2's timer restart is observable.
