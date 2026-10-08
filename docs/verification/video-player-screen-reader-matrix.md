# Video player manual release verification

Status: **Not run; release gate remains open.** Automated Chromium tests do not establish screen-reader speech, real fullscreen behaviour, real touch devices, or actual browser zoom. No manual result is inferred from an axe pass.

Follow the [manual screen reader verification guide](manual-screen-reader-verification.md) for screen reader setup and the evidence template. Serve the acceptance app with `corepack pnpm exec ng serve e2e-app --port 4210` and use the scenario URLs below, or open the dev app's video player page, which plays the replayed fixture stream when the demonstration backend is absent.

Automated runs use Chromium only. The platform-specific combinations below are pending release verification; none were executed by this implementation.

| Combination | Date | Versions (AT / browser / OS / package) | Result | Defects |
|---|---|---|---|---|
| NVDA / Chrome / Windows | — | — | Not run | — |
| JAWS / Chrome / Windows | — | — | Not run | — |
| VoiceOver / Safari / macOS | — | — | Not run | — |
| VoiceOver / Safari / iOS | — | — | Not run | — |
| TalkBack / Chrome / Android | — | — | Not run | — |
| Narrator / Edge / Windows | — | — | Not run | — |
| Chrome actual 400% zoom, 1280 × 1024 window | — | — | Not run | — |

Safari on macOS and iOS lacks `ManagedMediaSource` support in v1. On iOS the player is expected to show the unsupported error; record what VoiceOver reads for it. On macOS Safari, record whether the stream plays.

## Scenario URLs (acceptance app)

| Purpose | URL |
|---|---|
| Live stream | `http://localhost:4210/video-player?scenario=live` |
| Captions | `http://localhost:4210/video-player?scenario=live&captions=true` |
| Stream that ends | `http://localhost:4210/video-player?scenario=live&endAfter=20` |
| Unsupported codec | `http://localhost:4210/video-player?scenario=unsupported` |
| Unknown stream | `http://localhost:4210/video-player?scenario=not-found` |
| Narrow container | `http://localhost:4210/video-player?scenario=live&containerWidth=320` |

To simulate a connection loss, run `window.__videoFixture.drop()` in the browser console; `window.__videoFixture.restore()` reconnects, and waiting 27 seconds without it ends in the connection error. `window.__videoFixture.fail()` fails the source.

## Checklist

For each combination record the commit, tester, date, versions, device, observations and linked defects, then Pass or Fail per item. Sign off a combination only when every item passes.

1. Enter the player. Check that the region name "Video player: Lecture hall A" is read.
2. Focus each control in turn. Check its name, role and pressed or disabled state: Play/Pause, Mute, Volume, the LIVE badge, Captions and Fullscreen.
3. Pause and resume. Check that "Paused." and "Back live." are heard.
4. Arrow on the volume slider. Check that each new value ("65%", "70%", …) is read and that no extra announcement follows.
5. Drop the connection, then let it fail. Check that "Connection lost. Reconnecting." and the error message are heard, and that Retry is reachable.
6. Let the stream end. Check that "Stream ended. It was live for {duration}." is heard.
7. Turn captions on. Check whether cues are readable where the screen reader supports native text tracks; where it does not, record the limitation.
8. Complete a keyboard-only run (Space, K, M, F, C, Arrow Up and Down, Escape, Tab order), then repeat at 200% zoom, at 320 CSS px, in forced colours and with reduced motion. Record results and defects explicitly. Note that Space on a focused button toggles playback, as L2-069 AC1 specifies, rather than pressing that button.
9. With a touch screen reader, swipe from the stage. Check that every control is reached in reading order and that the first tap on hidden controls only reveals them.
10. Set a real Chrome window to 1280 × 1024 and browser zoom to 400%. Verify no horizontal page scrolling and that every control remains operable. A 320 × 256 CSS px viewport is not this check.

Tester / commit / sign-off: **Pending**.
