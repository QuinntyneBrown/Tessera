# Manual screen reader verification

This guide explains how to verify Tessera's combobox using real screen readers, keyboard input, browser zoom, and mobile devices. Start with NVDA and Chrome on Windows, then repeat the applicable checks for each required combination.

This document is a procedure, **not evidence that verification has been performed**. Record actual results in the [combobox release matrix](combobox-screen-reader-matrix.md). Existing unexecuted checks remain **Not run**.

## Contents

- [Scope and required combinations](#scope-and-required-combinations)
- [Prepare the acceptance app](#prepare-the-acceptance-app)
- [Set up your screen reader](#set-up-your-screen-reader)
- [First run: NVDA and Chrome](#first-run-nvda-and-chrome)
- [Scenario URLs](#scenario-urls)
- [Complete the functional checklist](#complete-the-functional-checklist)
- [Verify the PR #2 host-layout regression](#verify-the-pr-2-host-layout-regression)
- [Verify responsive layout and display settings](#verify-responsive-layout-and-display-settings)
- [Verify mobile reading order and keyboards](#verify-mobile-reading-order-and-keyboards)
- [Record results and defects](#record-results-and-defects)
- [Troubleshooting](#troubleshooting)

## Scope and required combinations

The requirements are in [L2-049: Manual screen reader verification](../specs/L2.md#l2-049-manual-screen-reader-verification). The checklist also covers L2-030 positioning, L2-033/L2-034 keyboard behavior, L2-035 accessible properties, L2-036 announcements, and L2-039 responsive presentation.

| Screen reader | Browser | Platform | Interaction to verify                                            |
| ------------- | ------- | -------- | ---------------------------------------------------------------- |
| NVDA          | Chrome  | Windows  | Speech, keyboard, focus, display settings                        |
| JAWS          | Chrome  | Windows  | Speech, keyboard, focus, display settings                        |
| Narrator      | Edge    | Windows  | Speech, keyboard, focus, display settings                        |
| VoiceOver     | Safari  | macOS    | Speech, keyboard, focus, display settings                        |
| VoiceOver     | Safari  | iOS      | Reading order, touch, real on-screen keyboard, hardware keyboard |
| TalkBack      | Chrome  | Android  | Reading order, touch, real on-screen keyboard, hardware keyboard |

This table follows the existing manual release matrix. Automated frontend testing remains Chromium-only; do not add Firefox or WebKit Playwright projects to perform these checks. The repository's [README](../../README.md#accessibility) distinguishes automated Chromium checks from manual verification on the supported platforms.

A Windows NVDA pass signs off the NVDA/Chrome/Windows row only. Ask testers with the other devices and screen readers to complete their rows. Browser emulation and an accessibility-tree inspection do not establish spoken feedback or real mobile keyboard behavior.

Run only one screen reader at a time. Listen to its speech and verify keyboard operation; capture transcripts where available. Exact phrasing and verbosity vary between screen readers. The information must be correct, understandable, and delivered at a useful time. Do not require identical speech across products or compensate for missing information by repeatedly inspecting the DOM.

## Prepare the acceptance app

From PowerShell:

```powershell
Set-Location C:\projects\Tessera
corepack pnpm install --frozen-lockfile
corepack pnpm exec ng serve e2e-app --port 4210
```

If dependencies are already installed, skip the install command. Keep the server terminal running. For this combobox fixture, no SCORM course server is required: its search results are supplied locally by the acceptance app.

Open:

```text
http://localhost:4210/?screen=combobox&results=normal&hostLayout=true
```

Confirm the page is headed **Assign learners**, has a **Learners** field, and includes **Toggle host banner**. Do not use the missing-label or missing-search-source scenarios for ordinary accessibility verification; those intentionally raise integration errors.

Record the tested revision and any local changes from a second terminal:

```powershell
git rev-parse HEAD
git status --short
```

Record the browser, operating-system, and screen-reader versions from their About/settings screens. Record the keyboard layout, screen-reader modifier, speech verbosity, extensions/add-ons, device, browser zoom, and display scaling. Use a known configuration and note any deviations; do not silently change settings to hide a defect.

### Access from a physical phone or another computer

Restart the app bound to the local network:

```powershell
corepack pnpm exec ng serve e2e-app --host 0.0.0.0 --port 4210
ipconfig
```

Use the computer's LAN IPv4 address, for example:

```text
http://192.168.1.20:4210/?screen=combobox&results=normal
```

Replace the example address with the actual one. The phone and server must be on a network that permits communication. Allow the development server through the Windows firewall for the trusted private network if needed. A phone's `localhost` addresses the phone, not the development computer. Stop the server when finished; do not publish this development server to the internet.

## Set up your screen reader

### NVDA on Windows

1. Download NVDA from [NV Access](https://www.nvaccess.org/download/) and start it.
2. In the NVDA menu, enable **Tools → Speech Viewer**. It shows the text being spoken and helps preserve observations. Keep focus out of the viewer while testing, because focusing it pauses its updates. [Official Speech Viewer instructions](https://download.nvaccess.org/documentation/en/userGuide.html#SpeechViewer).
3. Open the fixture in Chrome, then use Tab to reach Learners.

| Command         | Purpose                              |
| --------------- | ------------------------------------ |
| Tab / Shift+Tab | Move keyboard focus forward/backward |
| NVDA+Space      | Toggle browse mode and focus mode    |
| NVDA+Tab        | Report the currently focused control |
| NVDA+N          | Open the NVDA menu                   |

“NVDA” means the configured modifier key, commonly Insert or Caps Lock. In browse mode, keys may navigate the document; in focus mode, keys operate the input. If typing or arrows navigate the webpage instead of the field, confirm keyboard focus and switch to focus mode. Use the [official NVDA command reference](https://download.nvaccess.org/documentation/en/keyCommands.html) for your configuration.

### JAWS on Windows

Start your installed JAWS copy, then open the fixture in Chrome. Tab to the field and confirm Forms Mode is active before testing text entry and option navigation. With the default desktop layout, Insert+F5 lists form controls; Enter can enter Forms Mode, and Num Pad Plus exits it. Consult the [JAWS hotkeys](https://www.freedomscientific.com/training/jaws/hotkeys/) and [Forms Mode guide](https://support.freedomscientific.com/SurfsUp/9-Forms.htm) for your keyboard layout and settings.

Do not treat an option-navigation failure as a component defect until you have confirmed that JAWS is passing the keys to the focused control. Record any mode changes required during normal use.

### Narrator on Windows

Use **Windows+Ctrl+Enter** to start or stop Narrator, then open the fixture in Edge. [Microsoft's startup instructions](https://support.microsoft.com/en-us/accessibility/windows/narrator/chapter-1-introducing-narrator).

Narrator+Space toggles scan mode. Caps Lock and Insert are default Narrator modifiers. If arrows read document content instead of navigating options, confirm input focus and scan-mode state. [Microsoft's scan-mode instructions](https://support.microsoft.com/en-US/accessibility/windows/narrator/chapter-3-using-scan-mode).

### VoiceOver on macOS

Enable VoiceOver through **System Settings → Accessibility → VoiceOver**, then open the fixture in Safari. [Apple's setup instructions](https://support.apple.com/en-gb/guide/voiceover/vo2682/mac).

Verify both reading-order navigation and actual keyboard focus. The VoiceOver cursor and DOM keyboard focus are distinct; the combobox's input should retain keyboard focus during option navigation. Check your Quick Nav and keyboard-navigation settings so the intended keys reach the field. “VO” denotes the VoiceOver modifier, normally Control+Option or Caps Lock. Use [Apple's VoiceOver web-command reference](https://support.apple.com/guide/voiceover/web-commands-vo27972/mac) for your version and configuration.

### VoiceOver on iOS and TalkBack on Android

On iOS, enable **Settings → Accessibility → VoiceOver** and use Safari. On Android, enable TalkBack through the device's accessibility settings and use Chrome. Practice the screen-reader gestures before testing the component.

For both products, swipe right/left to move to the next/previous item and double-tap to activate the selected item. Scrolling gestures differ: use the platform's documented gesture rather than treating a normal one-finger swipe as a scroll. See [Apple's VoiceOver gesture guide](https://support.apple.com/guide/iphone/use-voiceover-gestures-iph3e2e2281/ios) and [Google's TalkBack gesture guide](https://support.google.com/accessibility/android/answer/6151827?hl=en).

Use physical devices for touch and on-screen keyboard checks. Connect a hardware keyboard for the separate mobile keyboard-only checks.

## First run: NVDA and Chrome

Use the normal-results URL above. After initial setup, put the mouse aside for the keyboard-only run.

| Step | Action                                           | Expected result                                                                                                                      |
| ---- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| 1    | Tab to Learners                                  | The name and combobox role are understandable; the list starts closed. Focus alone does not open it.                                 |
| 2    | Type `ad`, then wait for the search pause        | The input retains `ad`. Ada, Grace, and Linus appear; the result count is announced.                                                 |
| 3    | Press Arrow Down/Up                              | The active option changes and its name/state are read. Keyboard focus stays in the input.                                            |
| 4    | Press Enter on an enabled option                 | It toggles selection, a chip appears/disappears, selection feedback is announced, and the list stays open. The form does not submit. |
| 5    | Move to a different option                       | Moving the active option does not itself select it or remove the previous selection.                                                 |
| 6    | Press Escape                                     | The list closes, input focus remains, and the query/selection remain. If a tooltip is visible, Escape dismisses that first.          |
| 7    | Reopen with Arrow Down                           | The list opens; selected options remain selected.                                                                                    |
| 8    | Press Tab or Shift+Tab                           | The list closes without selecting the active option, and focus follows normal keyboard order.                                        |
| 9    | Navigate to a chip remove button and activate it | Its name identifies the selection being removed. Removal is announced and focus lands on an appropriate remaining chip or the input. |
| 10   | Select again, then activate Clear all selections | All chips disappear, clearing is announced, and focus returns to the input.                                                          |

Evaluate the speech by meaning. The default component messages include `3 results available.`, `{label} selected. 1 selected in total.`, `{label} removed.`, and `All selections cleared.` These come from [the component's English strings](../../src/combobox/i18n.ts); they are examples of component messages, not promises of each screen reader's complete spoken output.

Use NVDA+Tab when unsure where keyboard focus is. Record missed, incorrect, stale, or repeatedly interrupted messages. A visible chip or checked indicator alone does not establish that selection feedback was accessible.

## Scenario URLs

Append the following query strings to `http://localhost:4210/`, or to your LAN address for a physical device. Reload between independent scenarios to reset selection, request attempts, and paging state.

| Scenario                       | Query string                                                               | Purpose                                                           |
| ------------------------------ | -------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Normal results and host layout | `?screen=combobox&results=normal&hostLayout=true`                          | Basic flow and PR #2 regression                                   |
| Preselected values             | `?screen=combobox&results=normal&value=Ada%7CGrace&hint=Choose%20learners` | Current-selection summary and named removal controls              |
| Slow search                    | `?screen=combobox&results=normal&responseDelay=2000`                       | Loading speech followed by result-count speech                    |
| Empty results                  | `?screen=combobox`                                                         | No-results feedback after typing                                  |
| Failed first request           | `?screen=combobox&results=normal&failure=observable`                       | Assertive error and successful Retry                              |
| Paging                         | `?screen=combobox&results=normal&paged=true&total=5`                       | Append Morgan and Sam; announce added count                       |
| Failed append                  | `?screen=combobox&results=normal&paged=true&pageFailure=true`              | Retain initial options during an error, then Retry                |
| Disabled option                | `?screen=combobox&results=normal&disabledOption=Grace`                     | Read the disabled state; prevent selecting Grace                  |
| Selection limit                | `?screen=combobox&results=normal&maxSelections=1`                          | Announce the limit and allow deselection                          |
| Disabled field                 | `?screen=combobox&results=normal&disabled=true&value=Ada`                  | Preserve chips; prevent editing and selection                     |
| Standalone required field      | `?screen=combobox&results=normal&required=true&hint=Choose%20learners`     | Required/invalid state and default error                          |
| Reactive required field        | `?screen=combobox&forms=reactive&validatorOnly=true&results=normal`        | Validator-derived required state, error-before-hint, Reset form   |
| Custom templates               | `?screen=combobox&templates=true&results=normal`                           | Option/chip content retains accessible behavior                   |
| Custom empty template          | `?screen=combobox&templates=true`                                          | Empty content and no-results speech                               |
| RTL                            | `?screen=combobox&results=normal&direction=rtl&value=Ada%7CGrace`          | Mirrored chip navigation                                          |
| Native dialog                  | `?screen=combobox&results=normal&dialog=native`                            | Dismissal, focus, and option access inside a native modal         |
| CDK dialog                     | `?screen=combobox&results=normal&dialog=cdk`                               | The same checks inside a CDK modal                                |
| Long chip and tooltip          | `?screen=combobox&results=normal&valueSize=1&containerWidth=280`           | Full-label tooltip and Escape ordering                            |
| Scrolling ancestor             | `?screen=combobox&results=normal&scroll=true`                              | Popup attachment while its ancestor scrolls                       |
| Many chips and options         | `?screen=combobox&results=normal&valueSize=200&longPage=true&paged=true`   | Narrow-layout, input-visibility, and independent-scrolling checks |
| Localization                   | `?screen=combobox&localized=true&results=normal`                           | Overridden Spanish strings alongside default strings              |

The fixture returns predetermined results; it does not filter Ada/Grace/Linus according to the query. With `results=normal`, typing another eligible query can still return the same names. `failure=observable` fails the first request only; `pageFailure=true` fails the first request for page 1. Reload to repeat those failures. The `forms` and `templates` branches configure their own component bindings; do not assume every ordinary component-input query parameter applies to those branches. Source: [acceptance fixture](../../src/e2e-app/src/app/combobox-fixture.ts).

## Complete the functional checklist

### A. Name, state, and descriptions

On the preselected scenario, focus Learners. Confirm the field has an understandable name, its role is identified, and its selected-value summary/hint is available. Open and close the list and verify expanded/collapsed state. If state speech is suppressed by a reader's verbosity setting, record that setting and inspect the control using the reader's own current-focus command; do not substitute DOM inspection for the speech check.

On the required scenarios, focus an empty field and then leave the whole control. Confirm required/invalid information and the error are available when returning. In the reactive scenario the visible error is **Selection is required.**, with **Choose learners** as the hint. Confirm the error is conveyed before the hint. Use Reset form and confirm the touched error clears. Check that selections are described after adding values.

### B. Search announcements and recovery

On the slow-search scenario, type `ad` and pause. Confirm a loading message after approximately one second of an in-flight request, then the result count when the response arrives. Type quickly and confirm stale results messages do not swamp the reader's queue. Close the list while a request is pending and check that a late results announcement does not describe a closed list.

On the empty scenario, confirm no-results feedback and an absence of selectable options. On the failed-first-request scenario, confirm the error is announced with appropriate urgency. With the list open and input focused, Enter activates Retry. Confirm recovery retains the query and restores navigable options. Do not expect Retry to be reachable by Tab: popup actions are outside the Tab sequence; the input supplies their keyboard path.

### C. Navigation, selection, and disabled states

Exercise Arrow Down, Arrow Up, Alt+Arrow Down, Alt+Arrow Up, Home, End, Page Down, and Page Up according to [L2-033](../specs/L2.md#l2-033-keyboard-operation-in-the-input). Check that navigation does not wrap past the first/last loaded option when no more pages exist. Home/End edit the text cursor rather than selecting options.

After explicit option navigation, Space toggles an enabled active option. During normal text editing, Space inserts a space. Enter toggles an enabled active option without submitting the open form. Check active and selected states independently.

In the disabled-option scenario, navigate to Grace and confirm its disabled state is understandable. Enter must not select it. In the limit scenario, select one option, hear the maximum-selection feedback, and verify another cannot be added; deselection remains possible. In the disabled-field scenario, verify the field and removal actions cannot be operated and existing selections remain.

### D. Paging and append errors

In the paging scenario, type `ad`, navigate to Linus, and press Arrow Down again to load the next page. Confirm Morgan and Sam append without losing initial options or selections. Confirm added-result speech; another Arrow Down reaches the newly appended option rather than a forced focus jump on response arrival.

In the failed-append scenario, repeat that trigger and hear the failure. Ada, Grace, and Linus must remain available. Enter from the input retries the failed append; Morgan and Sam then append. To check loading without an active option, close the list and reopen with Alt+Arrow Down; Enter can load more when nothing is active and more results are available. See [L2-025](../specs/L2.md#l2-025-paged-results) for the complete paging behavior.

### E. Chip removal, RTL, and tooltips

Check named chip removal buttons with Enter, Space, Backspace, and Delete. Focus should move to the next remaining chip, otherwise the previous one, otherwise the input. With the input empty, Backspace removes the last chip; with query text present, it edits the text.

At the start of the input, Arrow Left moves to the last chip in LTR. Arrow Right performs that action in RTL. Arrow keys between chip buttons are mirrored in RTL. Verify names and focus placement by listening, not only by watching the focus ring.

For the long-chip scenario, open results, press Home in the input, then Arrow Left to focus the chip removal button. Confirm the tooltip exposes the full label. If both tooltip and list are visible, first Escape dismisses the tooltip; next Escape closes the list while preserving chip focus. Check pointer hover/transfer separately from the keyboard-only run.

### F. Dialogs, templates, and reading order

Run both dialog scenarios. Check that options are readable and actionable, the input retains keyboard focus during navigation, and the popup appears above the dialog content. From the input, Escape closes the list first, a subsequent Escape clears non-empty text, and Escape with the list closed and input empty can reach the dialog. A tooltip receives Escape first when visible.

Repeat search, selection, removal, and empty-state checks with custom templates. Confirm the extra template content does not create unexpected focus stops or replace accessible names/states. Check localization without assuming every string is overridden.

Use each screen reader's reading-order navigation with the popup open. Check that options can be reached after the input and that validation/hint content remains reachable. Keep this separate from Tab navigation: options use an active descendant while keyboard focus remains in the input, so they are not independent Tab stops.

## Verify the PR #2 host-layout regression

This checks [L2-030 AC8](../specs/L2.md#l2-030-overlay-positioning): host content expands/collapses above the field without resizing the field, and the open popup follows while input state and focus remain intact.

1. Open the normal-results/host-layout scenario at ordinary desktop zoom.
2. Type `ad`, select Ada, and keep the list open with focus in Learners.
3. Listen to the selection feedback and confirm the initial popup is aligned.
4. Open the browser's JavaScript Console. On Windows Chrome, Ctrl+Shift+J opens it. See [Chrome's Console reference](https://developer.chrome.com/docs/devtools/console/reference).
5. Run this fixture-only stimulus:

   ```javascript
   setTimeout(() => {
     const input = document.querySelector('input[role="combobox"]');
     const main = document.querySelector('main');
     if (
       !input ||
       !main ||
       document.activeElement !== input ||
       input.getAttribute('aria-expanded') !== 'true'
     ) {
       console.warn('Layout check not executed: focus Learners and open its list, then retry.');
       return;
     }
     main.dispatchEvent(new Event('host-layout-change'));
     console.info('Host layout toggled; input focus retained:', document.activeElement === input);
   }, 15000);
   ```

6. Close DevTools, return keyboard focus to Learners, and reopen with Arrow Down if needed before the 15-second timer fires. Do not change the query or selection.
7. When the space above the field expands by 100 CSS px, verify the popup follows without covering the input. Continue navigating options and check speech. Verify `ad`, Ada's selection, and input focus remain.
8. Run the same stimulus again to collapse the space. Repeat the alignment, state, and spoken-navigation checks.
9. Inspect the console afterward if nothing moved. A warning means the setup preconditions were not met; record the attempt as not executed and retry. An aborted attempt is not a component pass or failure.

Tabbing to Toggle host banner closes the list by design; activating an external button can also dismiss it. The delayed event allows the host layout to change while the input has focus. The event is a test stimulus; evaluate speech and visual alignment yourself. Do not use it to force focus, change selections, or automatically declare a pass.

If the target mobile device cannot execute this setup while preserving focus, record this particular check as **Not run** and arrange an appropriate host-layout stimulus on that device. A desktop result does not sign off its mobile row.

## Verify responsive layout and display settings

Run these conditions separately, resetting overrides between runs, then combine representative conditions such as narrow layout plus enlarged text. For each, repeat search, option navigation, select/deselect, chip removal, clear-all, and error recovery. Check visible focus, readable content, accessible speech, preserved state, and independent list scrolling.

### Widths and actual browser zoom

Check 320, 576, 768, 992, 1200, and 1920 CSS px where the device permits. Browser responsive tools can set CSS viewport widths for desktop layout checks. They do not replace physical-device screen-reader or keyboard checks.

Use the browser's actual zoom controls for 200% and 400% runs. For the 400% release check, size a real Chrome window to 1280 × 1024 as prescribed by the matrix and record the actual window and content-viewport dimensions. Browser chrome can reduce the available content height; record it rather than assuming an exact 320 × 256 viewport. Confirm the zoom percentage in the browser UI.

This console expression records dimensions, not the browser's zoom setting:

```javascript
({
  window: [outerWidth, outerHeight],
  layoutViewport: [innerWidth, innerHeight],
  visualViewport: window.visualViewport && {
    width: window.visualViewport.width,
    height: window.visualViewport.height,
    scale: window.visualViewport.scale,
  },
});
```

A 320 × 256 emulated viewport or a changed device scale is not evidence of actual 400% browser zoom. Check the many-chips scenario: no horizontal page scrolling, a visible uncovered input, usable chip/list scrolling, and access to every action. Preserve query and selection while resizing the window.

### Text enlarged to 200%

At ordinary browser zoom, record the root's baseline computed font size. To reproduce the acceptance suite's text-only override, run:

```javascript
const textSizeOverride = document.createElement('style');
textSizeOverride.id = 'tessera-manual-text-size';
textSizeOverride.textContent = 'html { font-size: 200% !important; }';
document.head.append(textSizeOverride);
```

Check the computed root size and component text to confirm the enlargement took effect. Repeat the functional checks, including long labels. Record this as a CSS text-enlargement check, separately from actual browser zoom. Remove the override with `document.getElementById('tessera-manual-text-size')?.remove()` or reload.

### WCAG text-spacing overrides

Run the following at ordinary text size and zoom:

```javascript
const spacingOverride = document.createElement('style');
spacingOverride.id = 'tessera-manual-text-spacing';
spacingOverride.textContent = `
  * {
    line-height: 1.5 !important;
    letter-spacing: .12em !important;
    word-spacing: .16em !important;
  }
  p { margin-bottom: 2em !important; }
`;
document.head.append(spacingOverride);
```

These exercise the line, paragraph, letter, and word-spacing values in [WCAG 2.2 SC 1.4.12](https://www.w3.org/WAI/WCAG22/UNDERSTANDING/text-spacing.html). Confirm there is no lost text or functionality, overlapping labels, or unreachable controls. Remove the override with `document.getElementById('tessera-manual-text-spacing')?.remove()` or reload.

### Forced colors and reduced motion

On Windows, use an operating-system contrast theme for the forced-colors run. Use the platform's reduced-motion preference for that run. Record the settings and confirm they take effect; do not confuse a dark theme with forced colors. Browser media emulation can provide an additional diagnostic check, but label it as emulated.

Confirm focus remains visible, selected/active/disabled states remain distinguishable, controls stay readable, and interaction remains functional. Restore the original settings afterward. If a platform cannot supply a particular condition, record **Not run** with the reason rather than silently omitting it.

## Verify mobile reading order and keyboards

On each physical mobile combination:

1. Focus and activate Learners with the screen reader. Type using the real on-screen keyboard.
2. With results open, swipe forward from the input. Confirm options are reachable in reading order and the reader conveys their names and selected/disabled states.
3. Activate an option, then another. Confirm selection feedback, preserved query, and usable input focus. Record whether the actual keyboard stays visible during option selection.
4. Deselect, remove a chip, and clear all using screen-reader activation. Confirm names, feedback, and focus destinations.
5. Use the screen reader's documented scrolling gesture to scroll the result list. Scrolling must not accidentally select an option.
6. Repeat loading, empty, error/Retry, and validation checks. Verify status and error content can be reached without relying on visual placement.
7. Repeat inside the dialog and custom-template scenarios. Verify the popup is accessible while the dialog is open.
8. Rotate the device and repeat with long labels and many chips. Check input visibility and state preservation with the on-screen keyboard displayed.
9. Connect a hardware keyboard and perform the separate keyboard-only run. Record the keyboard and mapping; use the reader's documented interaction mode so navigation keys reach the input.

A browser's mobile emulation cannot establish these results. Preserve device-specific observations rather than copying a desktop pass into the mobile row.

## Record results and defects

Use **Pass**, **Fail**, or **Not run** for each check. Use a clearly justified **Not applicable** only when the requirement genuinely does not apply; an unavailable device or incomplete setup is **Not run**. Sign off a combination only after its required checks pass and unresolved failures are addressed.

Copy this template into a dated evidence file under `docs/verification/`, then update the combination's row in [the release matrix](combobox-screen-reader-matrix.md) with a link to the evidence:

```markdown
# Manual verification: <screen reader / browser / platform>

- Tester:
- Date:
- Commit and local changes:
- Component/package version:
- Screen reader and version:
- Browser and version:
- OS and version:
- Device and hardware keyboard:
- Keyboard layout / screen-reader modifier / interaction mode:
- Speech verbosity, extensions, and add-ons:
- Power mode:
- URL(s):
- Window/viewport dimensions, zoom, text override, display scaling:
- Forced-colors / reduced-motion settings:

| Check / scenario                         | Actual speech and focus/layout observations | Result  | Evidence / defect |
| ---------------------------------------- | ------------------------------------------- | ------- | ----------------- |
| Name, role, descriptions                 |                                             | Not run |                   |
| Open/close and focus                     |                                             | Not run |                   |
| Loading/results/empty                    |                                             | Not run |                   |
| Active/selected/disabled states          |                                             | Not run |                   |
| Select/deselect/remove/clear/limit       |                                             | Not run |                   |
| First-page error and Retry               |                                             | Not run |                   |
| Paging and append-error recovery         |                                             | Not run |                   |
| Required/invalid/error/hint/reset        |                                             | Not run |                   |
| Keyboard, RTL, tooltip, dialogs          |                                             | Not run |                   |
| Templates and reading order              |                                             | Not run |                   |
| Host expansion/collapse with input focus |                                             | Not run |                   |
| Widths and actual 200%/400% zoom         |                                             | Not run |                   |
| 200% text and text spacing               |                                             | Not run |                   |
| Forced colors and reduced motion         |                                             | Not run |                   |
| Mobile touch and real keyboard           |                                             | Not run |                   |

## Defects

- ID/link:
- Exact URL and starting state:
- Keys/gestures and interaction mode:
- Expected information/behavior:
- Actual speech, focus, and layout:
- Frequency and repeat steps:
- Transcript/recording/screenshot:
- Retest commit, result, and tester:

## Sign-off

- Outstanding failures or unexecuted checks:
- Overall combination result:
- Tester / date:
```

Record actual speech, including omissions. Screenshots show layout, transcripts show spoken content, and recordings can show their timing together. None alone proves all requirements. Reproduce defects from a fresh fixture state, keep the original evidence, fix through the project's ATDD workflow, and manually retest the affected checks. Never turn **Not run** into **Pass** based on an axe result or another platform's observations.

## Troubleshooting

| Problem                                             | Next action                                                                                              |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Typing invokes reader navigation instead of editing | Confirm input keyboard focus and browse/focus/Forms/scan-mode settings. Record the mode needed.          |
| Speech Viewer seems frozen                          | Return focus to the browser; NVDA pauses viewer updates while the viewer is focused or hovered.          |
| Results are empty unexpectedly                      | Confirm `results=normal` is in the URL. The default fixture deliberately returns no items.               |
| Retry no longer fails                               | Reload: first-request and first-append failures are deliberately one-shot.                               |
| A requested input parameter has no effect           | Check whether the URL uses a forms/template branch with its own bindings. Use the documented scenario.   |
| Popup closes while reaching the banner button       | Tab/external interaction dismisses it. Use the delayed event procedure for the focused open-popup check. |
| Popup options are not Tab stops                     | Use arrows with input focus; separately verify reading order with the screen reader.                     |
| The phone cannot reach the app                      | Check LAN binding, the computer's address, network isolation, and private-network firewall access.       |
| A check cannot be completed on the available device | Record Not run with the reason and assign it to a tester with the required setup.                        |

If you are new to a screen reader, practice its supported navigation commands before attributing a failure to the component. For ambiguous results, repeat with an experienced user or accessibility tester and preserve both sets of observations.
