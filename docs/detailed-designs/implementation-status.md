# Implementation status

This records how far the production implementation has come against the [detailed designs](README.md),
the decisions made where a design said `<TO SUPPLY>`, and where the implementation departs from a design.
The designs themselves are unchanged.

## Covered

SCORM 1.2 works end to end for an extracted course and for a ZIP package: loading and validation,
isolated launch, the full 1.2 runtime and data model, saving with retry, resume, outcomes, outline and
Previous/Next navigation, and the accessible, responsive shell. Every slice has a failing-first Chromium
acceptance test through `PlayerPage` (`test/e2e/pages/player-page.ts`) plus unit tests for the pure logic.
Where a later slice's test passed on first run because an earlier slice already satisfied it, the commit says
so and a mutation of the production code was shown to fail the test.

## Not implemented

| Area | Requirement | State |
|------|-------------|-------|
| SCORM 2004 runtime | `L2-008`, part of `L2-009` | The 2nd, 3rd and 4th Editions are detected from `schemaversion` and refused with their name until their runtime rules exist. |
| SCORM 2004 sequencing and rollup | `L2-006` | Not started. Needs the ADL sequencing tables (see the design's `<TO SUPPLY>` items). |
| Load performance target | `L2-019` AC1 | The 100-run, 4x CPU-slowdown benchmark is not written. |
| Manual screen reader verification | `L2-017` AC4 | Not done. JAWS, NVDA, VoiceOver, TalkBack and Narrator have not been used on the player; only the automated axe-core checks and keyboard tests ran. |
| Consumer test harness | design `operate-player` | `src/scorm-player/testing/` is not built. |
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
  and leaves completion, success and progress `unknown`.

## Running things

`pnpm` is not on `PATH` on every machine; `corepack pnpm <script>` works anywhere Node does.

- `pnpm lint`, `pnpm test` (unit), `pnpm build`, `pnpm e2e` (Chromium only), `pnpm api:check`
- `pnpm api:update` regenerates `goldens/scorm-player/index.api.md` after a deliberate public API change
