# SCORM player manual release verification

Status: **Not run; release gate remains open.** Automated Chromium tests (axe-core checks, keyboard operation,
focus movement and the live-region text) do not establish screen-reader speech, real on-screen keyboard behavior
or actual browser zoom. No manual result is inferred from an automated pass. `L2-017` AC4 is not met until every
combination below is signed off.

| Combination | Date | Versions (AT / browser / OS / package) | Result | Defects |
|---|---|---|---|---|
| NVDA / Chrome / Windows | — | — | Not run | — |
| JAWS / Chrome / Windows | — | — | Not run | — |
| VoiceOver / Safari / macOS | — | — | Not run | — |
| VoiceOver / Safari / iOS | — | — | Not run | — |
| TalkBack / Chrome / Android | — | — | Not run | — |
| Narrator / Edge / Windows | — | — | Not run | — |
| Chrome actual 400% zoom, 1280 × 1024 window | — | — | Not run | — |

Prepare the acceptance app and set up each screen reader as the
[manual screen reader verification guide](manual-screen-reader-verification.md) describes; its checklist covers the
combobox, and the items below cover the player. For each run record the commit, tester, date, package/AT/browser/OS versions, device, fixture URL, observations and
linked defects. Use the acceptance app (`pnpm e2e` serves it; for example `/?course=seq-flow-2004`). Record Pass or
Fail per item, then sign off the combination only when every item passes.

1. Load `single-sco-12`. Check that the loading status is announced, then the course title, edition and first
   activity heading are reachable by heading navigation.
2. Navigate the outline of `seq-flow-2004` by list and button navigation. Check the module title, the nesting of its
   lessons, the current activity ("current step") and each unavailable lesson's state and reason.
3. Activate an unavailable lesson and a blocked Next or Previous. Check that the control is announced as unavailable
   (dimmed) with its reason, and that activating it does nothing.
4. Choose an available activity. Check that focus moves to and announces the new activity heading, and that the
   content frame's title names the activity.
5. In `seq-flow-2004`, have the SCO request `continue` and then a denied `{target=lesson3}choice` (the probe page
   accepts the calls as JSON). Check that the launch is announced once and the denial reason is announced politely.
6. In `seq-prereq-2004`, pass the lesson. Check that the quiz's state changes from unavailable to available.
7. With `save=manual`, fail a save. Check the assertive "Progress not saved" alert, then Retry and the "Progress
   saved" status, and the inline unsaved-exit warning with focus on its heading.
8. Check the outcome region reads "Not yet known" rather than a percentage, then the reported status or the
   completion and success values.
9. At 320 CSS px, collapse and expand the outline with its toggle; check expanded/collapsed speech and that Escape
   inside the outline returns focus to the toggle.
10. Repeat items 1–4 at actual 200% zoom, with forced colors, with 200% text and with WCAG spacing overrides.
11. Set a real Chrome window to 1280 × 1024 and browser zoom to 400% with the browser's controls. Verify a single
    column, no horizontal page scrolling and every action available.

Tester / commit / sign-off: **Pending**.
