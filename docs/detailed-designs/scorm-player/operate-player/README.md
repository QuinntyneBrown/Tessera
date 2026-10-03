# Operate the player accessibly and recover from errors

## Overview

The player shell surrounds course-authored content with outline, navigation, status, and recovery controls.

**Player chrome** — controls and layout owned by the component outside course-authored content

This feature makes those controls usable by keyboard and assistive technology from extra-small to extra-large widths and at up to 400% zoom. It preserves the active course session when layout or zoom changes and presents actionable loading, runtime, and save failures.

## Description

- `ScormPlayer` owns the shell in `scorm-player.html` and responsive styles in `scorm-player.scss`.
- `PlayerViewState` holds outline expansion, load status, outcome, and the current loading, runtime, or integration error. Permitted actions come from `NavigationController.availableActions()`, and save status and persistence failures from `SaveState`; none are copied. The current activity is read from `SequencingState.currentActivityId`, never copied.
- `PlayerError` contains `category`, stable `code`, safe text, retryability, an opaque `correlationToken`, and, for an activity-launch failure, the failed `activityId`. Categories distinguish integration, loading, runtime, and persistence.
- `StatusAnnouncer` joins messages raised together into one update of a polite live region for loading started, course ready with its first or resumed activity, SCO-driven activity changes, an attempt ended by the course, a denied SCO navigation request with its reason, outcome changes, the first appearance of "Last saved at {time}", and a save status change from unsaved back to saved; the change to unsaved is announced by the save alert alone (L2-017 AC2). A new "Last saved" time within the saved status is not a status change and is not announced, and an unchanged status is never re-announced. A learner-initiated launch is announced by moving focus to the activity heading, not by the live region. Urgent actionable errors use an alert, not the live region as well. Each new failure is announced, including a repeated failure after Retry; one event is never announced twice. One general rule applies to every event: when the event moves focus to a heading that names it (the new activity, the newly opened error, the loading or idle state), that focus move is the announcement, and neither the polite region nor the alert repeats it. A fallback focus move that only follows a closing region, such as after a successful save Retry or an exit, does not name the event, so that event is still announced once in the polite region.
- `ScormPlayer.retry(error)` receives the error from the region whose Retry was pressed and routes by its category, then `code` within `loading`: manifest or package codes restart `CourseLoader`, a failed activity launch retries through `navigate(request)` for the error's `activityId`, so `NavigationController` re-checks it and sets the current activity, runtime errors relaunch the current activity through `navigate(request)` as well, except a flush failure during exit or source/attempt replacement, whose Retry re-runs that pending workflow (flush, then drain), and persistence errors call `PersistenceCoordinator.retry()`. No separate recovery class exists.
- `PlayerPage` in `src/e2e-app/` owns all Playwright selectors and interactions for the player screen. `ScormPlayerHarness` in `src/scorm-player/testing/` exposes consumer test actions through the same package entry point.

The outline uses a semantic navigation region and an ordered list of activity buttons; the list carries `role="list"` so WebKit keeps its list semantics without list markers. It does not introduce a tree widget unless its full keyboard behavior is specified. Current activity uses `aria-current="step"`. Unavailable activities and blocked Previous or Next actions use `aria-disabled="true"` rather than `disabled`, so they stay focusable; visible reason text is linked with `aria-describedby`. Activating a blocked control does nothing.

The narrow outline toggle is a button with `aria-expanded` and `aria-controls`. Collapsing an outline containing focus returns focus to that toggle. When widening hides a focused toggle, focus moves to the current activity's outline button. A successful learner launch moves focus to a stable, named activity heading outside the isolated content. A titled iframe follows in the keyboard sequence. SCO-driven transitions announce the new activity without stealing focus unnecessarily; if the retired iframe contained focus, focus moves to the activity heading and the live region stays silent, so the change is announced once.

All actions have visible focus, accessible names, and target dimensions meeting WCAG 2.2 AA. Status announcements do not require searching the page. Unknown outcomes use text; progress bars appear only with a defined value and accessible label.

Flexible columns wrap so the outline stacks above the player whenever the player would fall below 30rem, with wrapping controls, and bounded content-frame dimensions. Sizes use relative units so player text scales with the user's text size, and text containers do not fix their heights, so 200% text and the WCAG text-spacing overrides cause no clipping or overlap. At 320, 576, 768, 992, 1200, and 1920 px, and at 400% zoom in a 1280 px window, player chrome produces no horizontal page scrolling; at 400% zoom the layout uses the same single column as the 320 px width. Reflow changes styles and outline visibility without destroying the iframe, session, or pending save.

Errors and the unsaved-exit warning are inline regions above the player, not modal dialogs. A new save failure is announced by writing its text into an alert inside the save region. Requesting exit while progress is unsaved reuses that same region without writing to the alert: it adds an Exit without saving action and moves focus to the region heading, so the warning is read once and only one Retry is ever shown. When any player status region (loading, idle, error, or warning) closes while it contains focus, focus moves to the activity heading, or to the visible loading or idle status heading when no activity is loaded; when a region closes because an error region opened, focus moves to that error region's heading, and that error is not also written to the alert, so it is read once. If entering the loading state hides the element that has focus, focus moves to the loading heading, and that move is the loading-started announcement. Cancel moves focus to the idle heading. The skip link targets the player region, which exists in every state. Manifest or package loading retry starts a fresh validated load; activity-launch retry re-requests that activity. Runtime retry relaunches the current activity from the host-validated attempt state. It discards the failed session's wrapper without a flush; operations the host never received are lost, and the runtime error text says so. Failed persistence offers Retry and blocks unacknowledged exit until the warning is resolved. Cross-origin script errors are detectable only through the supported bridge or host delivery signals.

Diagnostic callbacks carry category, stable code, and correlation token. URLs, raw runtime values, learner identifiers, stack contents, and raw host errors stay out of console output and diagnostics. Required SCO state and score fields appear only in their documented state/outcome contracts.

Final labels, host exit behavior, runtime restart safety, and detailed screen reader scripts are `<TO SUPPLY>`. Reference WCAG criteria and interaction patterns are the [WCAG 2.2 standard](https://www.w3.org/TR/WCAG22/) and [WAI-ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/).

Each component change includes Chromium keyboard behavior and automated accessibility checks. Manual verification covers JAWS, NVDA, VoiceOver, TalkBack, and Narrator on their supported platforms. Manual verification is separate from automated browser tests, which run only in Chromium.

ATDD slices cover outline use, launch focus, disabled explanations, Retry, exit warning, live announcements, each specified width, 400% zoom, 200% text, text-spacing overrides, and resize or zoom with unsaved values. Manual records include platform, screen reader version, script, result, and defects. These designs do not claim that verification has occurred.

## Requirements

Source: [L2 detailed requirements](../../../specs/L2.md). The table quotes source wording exactly, including its use of `must`.

| L2 ID | Refines (L1) | Requirement |
|-------|--------------|-------------|
| `L2-017` | `L1-007` | The player controls must use semantic roles, visible focus, predictable focus movement, and text status announcements. Player-owned interactions must satisfy WCAG 2.2 AA and the applicable WAI-ARIA Authoring Practices. |
| `L2-018` | `L1-008` | The player shell and its own controls must remain fully usable at extra-small, small, medium, large, and extra-large viewport widths, at up to 400% browser zoom, and with enlarged text or increased text spacing, without horizontal page scrolling or loss of content or functionality caused by player chrome. |
| `L2-020` | `L1-008` | The player must distinguish loading, runtime, and persistence failures; show the learner an actionable message; and send the host a machine-readable error category without exposing private learner data. |

## Diagrams

The context view places this capability between the learner, the host LMS, and isolated course delivery. Authorization remains the host's responsibility.

![C4 context: Operate the player accessibly and recover from errors](diagrams/c4-context.png)

The container view separates the LMS browser application, host API, isolated course frames, and course delivery. Tessera deploys as part of the LMS browser application.

![C4 containers: Operate the player accessibly and recover from errors](diagrams/c4-container.png)

The component view shows the proposed collaborators for this slice. Components inside the course boundary hold only the current SCO's allowed runtime state.

![C4 components: Operate the player accessibly and recover from errors](diagrams/c4-component.png)

The class view records the proposed fields, methods, and ownership relationships. Types shared between slices retain the same meaning throughout the design tree.

![Class structure: Operate the player accessibly and recover from errors](diagrams/class-structure.png)

Keyboard actions operate semantic controls. Responsive reflow preserves the same course frame and runtime session.

![Sequence diagram: Use controls and retain state during reflow](diagrams/sequence-keyboard.png)

Each error offers the relevant recovery workflow. Host diagnostics omit private runtime data.

![Sequence diagram: Present categorized failure and retry](diagrams/sequence-recover.png)
