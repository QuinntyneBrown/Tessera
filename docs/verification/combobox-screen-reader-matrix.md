# Combobox manual release verification

Status: **Not run; release gate remains open.** Automated Chromium tests do not establish screen-reader speech, real on-screen keyboard behavior, or actual browser zoom. No manual result is inferred from an axe pass.

The NVDA Firefox entry from the reviewed design is omitted to honor the user's Chromium-only frontend-testing instruction. Automated runs use Chromium only. Platform-specific manual VoiceOver and Narrator combinations remain pending release verification; none were executed by this implementation.

| Combination | Date | Versions (AT / browser / OS / package) | Result | Defects |
|---|---|---|---|---|
| NVDA / Chrome / Windows | — | — | Not run | — |
| JAWS / Chrome / Windows | — | — | Not run | — |
| VoiceOver / Safari / macOS | — | — | Not run | — |
| VoiceOver / Safari / iOS | — | — | Not run | — |
| TalkBack / Chrome / Android | — | — | Not run | — |
| Narrator / Edge / Windows | — | — | Not run | — |
| Chrome actual 400% zoom, 1280 × 1024 window | — | — | Not run | — |
| Real on-screen keyboard, iOS and Android | — | — | Not run | — |

For each run record the commit (including local changes), tester, date, package/AT/browser/OS versions, device, power mode, fixture URL, keyboard configuration, observations and linked defects. Use `/?screen=combobox` in the acceptance app or the labelled dev-app examples. Mobile keyboard-only verification requires a hardware keyboard. Record Pass or Fail per item, then sign off the combination only when every item passes.

1. Focus the labelled field with values selected. Check label, role and current selection/description speech.
2. Open and close by keyboard. Check expanded/collapsed speech and focus retention.
3. Type a query. Check loaded result-count speech; use a slow source to check the one-second loading message.
4. Arrow through enabled, selected and disabled results. Check active/selected distinction and disabled-state reading.
5. Select, deselect, remove chips and clear all. Check ordered speech, limits and focus destinations.
6. Exercise a failed first page and failed append with Retry. Check assertive failure speech, retained results and recovery.
7. Leave a required empty field. Check required/invalid speech, error before hint, reset, and selected-value summary.
8. Complete a keyboard-only run through input, chips and clear-all, including RTL, Tab/Shift+Tab, Page keys, native editing, and tooltip-first Escape inside a dialog.
9. Repeat at 320 CSS px and actual 200% zoom, forced colors and reduced motion. Check visible focus and no lost functions. Apply 200% text and WCAG spacing overrides separately.
10. On touch screen readers, swipe forward from the input with its list open. Confirm options are reached in reading order. Tap options, chips, clear-all and toggle; check the real on-screen keyboard is retained during option selection. Drag to scroll without selecting.
11. Set a real Chrome window to 1280 × 1024 and actual browser zoom to 400% using browser controls. Record both window size and zoom; verify no horizontal page scrolling, input visibility, independent list scrolling, all actions and preserved state across resize. A 320 × 256 CSS viewport or device scale is not this check.
12. For the PR #2 host-layout regression, use `/?screen=combobox&results=normal&hostLayout=true`. Type `ad`, select Ada, and leave the list open. Activate Toggle host banner to expand and collapse the space above the field. Return to the input by keyboard after each activation; confirm the list follows the field without covering the input, the query and selection remain, and option navigation and selection speech still work. Record this check for each applicable screen-reader combination; it remains **Not run**.

Tester / commit / sign-off: **Pending**.
