# Video player demo narration

Spoken by `en-US-AndrewMultilingualNeural` (edge-tts). Each tagged paragraph is one synthesized clip
and is shown word for word as the on-screen caption while it plays. Tags name the step in
`demo/video-player/record.story.ts` that shows the paragraph, in capture order. Spoken
replacements for written forms come from `pronunciations.json`.

## Opening

[opening] This is Tessera's live video player for learning platforms. You'll watch a stream, control it by mouse and keyboard, turn on captions, customise it, and see how it handles failures.

## 1. Watch a live stream

[live] This example replays a short test pattern as a live stream, right in the browser, with no video server. The LIVE badge and the elapsed time show that you're watching live.

[pause] Pause holds the current picture. The stream keeps arriving in the background, so you start to fall behind.

[behind] Now the LIVE badge offers to take you back, and tells screen readers how many seconds behind you are.

[resume] Press Play, and the player jumps back to the live edge instead of resuming where you left off.

[volume] This player started muted. Unmute it, then lower the volume with the slider. Screen readers hear each change.

## 2. Keyboard and captions

[tab] This player waits at the live edge until you press Play. Tab takes you straight to its controls, and a clear focus ring shows where you are.

[keys] Space starts playback. M mutes and unmutes, and the arrow keys change the volume in steps of five.

[captions] C turns on captions. They come from a WebVTT file that your platform supplies.

[caption-clear] Step away, and the controls fade after three seconds, leaving the caption clear. At this width, the control bar covers the caption while it's showing. That's a known issue.

## 3. Make it yours

[i18n] Provide your own strings, and the region name, buttons and LIVE badge follow. Here they're in Spanish; anything you leave out stays in English.

[theme] Theme tokens restyle one player without touching the others. This one swaps in a purple accent.

## 4. When the hub can't be reached

[hub] This example uses the default transport, which connects to a SignalR hub when you ask it to.

[hub-error] No hub is running for this recording, so the connection fails. The player says so in plain words, offers Retry, and screen readers hear it as an alert.

## 5. Recover from interruptions

[fixture] This is the acceptance test screen. Its stand-in transport can simulate a dropped connection, and the page lists every state the player reports.

[reconnecting] When the connection drops, the last picture stays on screen, dimmed, while the player retries up to five times.

[reconnected] When the connection comes back, the player rebuilds the stream and returns to live by itself.

[ending-soon] This next stream is set to finish after a few seconds.

[ended] When the source finishes, the player says the stream has ended and how long it was live.

## Closing

[ending] That's the Tessera video player: live playback, keyboard control, captions, your own strings and colours, and automatic recovery. Manual screen reader checks and a demonstration video server are still to come.
