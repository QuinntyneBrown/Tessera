// Acceptance tests. Traces to L2-060, L2-061, L2-062, L2-063, L2-064, L2-070, L2-071, L2-075.
import { test } from '@playwright/test';
import { VideoPlayerPage } from './pages/video-player-page';

// Real media decoding is slow on a loaded machine.
test.describe.configure({ timeout: 60_000 });

test('pauses holding the frame, renames the control Play and keeps the subscription open', async ({
  page,
}) => {
  // L2-061 AC1; L2-070 AC2: Given live, when Pause is activated, then the video pauses, the state
  // is paused, the control is named "Play", the central play affordance shows, "Paused." is
  // announced, and chunks keep arriving.
  const player = new VideoPlayerPage(page);
  await player.observeAnnouncements();
  await player.open('live', { realTime: true });
  await player.expectAnnouncementHistoryToEndWith('Live.');
  await player.expectControlBar();
  await player.expectPlayPause('Pause', false);
  await player.clickPlayPause();
  await player.expectState('paused');
  await player.expectVideoPaused(true);
  await player.expectPlayPause('Play', false);
  await player.expectCentralPlay(true);
  await player.expectAnnouncementHistoryToEndWith('Paused.');
  await player.expectBytesStillArriving();
  await player.expectNoAccessibilityViolations();
});

test('resumes at the live edge and announces Back live', async ({ page }) => {
  // L2-061 AC2; L2-060 AC4: Given paused, when Play is activated, then currentTime moves to 3 s
  // behind the buffered end, playback resumes live and "Back live." is announced.
  const player = new VideoPlayerPage(page);
  await player.observeAnnouncements();
  await player.open('live', { realTime: true, extra: { lead: 6 } });
  await player.expectState('live');
  await player.clickPlayPause();
  await player.expectState('paused');
  await player.expectLatencyAtLeast(5);
  await player.clickPlayPause();
  await player.expectState('live');
  await player.expectLatencyAtMost(3.6);
  await player.expectCentralPlay(false);
  await player.expectAnnouncementHistoryToEndWith('Back live.');
  await player.expectNoAccessibilityViolations();
});

test('toggles playback from a click on the stage', async ({ page }) => {
  // L2-061 AC3: Given live with visible controls, when the stage is clicked, then playback toggles.
  const player = new VideoPlayerPage(page);
  await player.open('live', { realTime: true });
  await player.expectState('live');
  await player.clickStage();
  await player.expectState('paused');
  await player.clickStage();
  await player.expectState('live');
  await player.expectNoAccessibilityViolations();
});

test('ignores Play while connecting and marks it aria-disabled', async ({ page }) => {
  // L2-061 AC4; L2-070 AC2: Given connecting, when Play/Pause is activated, then nothing happens and
  // the control is aria-disabled but focusable.
  const player = new VideoPlayerPage(page);
  await player.open('connecting');
  await player.expectState('connecting');
  await player.expectPlayPause('Play', true);
  await player.clickPlayPause();
  await player.expectState('connecting');
  await player.expectNoAccessibilityViolations();
});

test('stays paused without an error when play() is rejected after a gesture', async ({ page }) => {
  // L2-061 AC6: Given play() rejects with NotAllowedError after a gesture, then the state is paused,
  // the central play affordance shows, and no error is raised.
  const player = new VideoPlayerPage(page);
  await player.open('live', { realTime: true });
  await player.expectState('live');
  await player.clickPlayPause();
  await player.expectState('paused');
  await player.rejectNextPlay();
  await player.clickPlayPause();
  await player.expectState('paused');
  await player.expectCentralPlay(true);
  await player.expectErrorOutputs([]);
  await player.expectNoAccessibilityViolations();
});

test('mutes, remembers volume 60 and restores it when unmuted', async ({ page }) => {
  // L2-062 AC1; L2-071 AC2: Given volume 60, Mute sets video.muted, presses the control, renames it
  // "Unmute" and announces "Muted."; activating it again restores 60 and announces the volume.
  const player = new VideoPlayerPage(page);
  await player.observeAnnouncements();
  await player.open('live', { realTime: true, extra: { volume: 60 } });
  await player.expectAnnouncementHistoryToEndWith('Live.');
  await player.expectMute('Mute', false);
  await player.clickMute();
  await player.expectMute('Unmute', true);
  await player.expectVideoAudio({ muted: true, volume: 0.6 });
  await player.expectAnnouncementHistoryToEndWith('Muted.');
  await player.clickMute();
  await player.expectMute('Mute', false);
  await player.expectVideoAudio({ muted: false, volume: 0.6 });
  await player.expectAnnouncementHistoryToEndWith('Unmuted, volume 60%.');
  await player.expectNoAccessibilityViolations();
});

test('steps the native volume slider by 5 and reports it without announcements', async ({
  page,
}) => {
  // L2-062 AC2; L2-070 AC3; L2-071 AC4: the slider is a native range 0-100 step 5 named "Volume";
  // arrow keys change it by 5, update aria-valuetext and video.volume, and announce nothing.
  const player = new VideoPlayerPage(page);
  await player.observeAnnouncements();
  await player.open('live', { realTime: true, extra: { volume: 60 } });
  await player.expectState('live');
  await player.expectVolumeSlider();
  await player.focusVolume();
  for (const [key, value] of [
    ['ArrowUp', 65],
    ['ArrowRight', 70],
    ['ArrowDown', 65],
    ['ArrowLeft', 60],
  ] as const) {
    await player.pressKey(key);
    await player.expectVolume(value);
  }
  await player.expectAnnouncementHistoryToEndWith('Live.');
  await player.expectNoAccessibilityViolations();
});

test('shows the muted state at volume 0 and unmutes at a non-zero value', async ({ page }) => {
  // L2-062 AC2 (clamping), AC3: volume 0 presses the mute control; a non-zero value unmutes.
  const player = new VideoPlayerPage(page);
  await player.open('live', { realTime: true, extra: { volume: 5 } });
  await player.expectState('live');
  await player.focusVolume();
  await player.pressKey('ArrowDown');
  await player.expectVolume(0);
  await player.pressKey('ArrowDown');
  await player.expectVolume(0);
  await player.expectMute('Unmute', true);
  await player.pressKey('ArrowUp');
  await player.expectVolume(5);
  await player.expectMute('Mute', false);
  await player.expectVideoAudio({ muted: false, volume: 0.05 });
  await player.expectNoAccessibilityViolations();
});

test('applies muted and volume input changes without restarting the stream', async ({ page }) => {
  // L2-062 AC5: Given the muted or volume input changes, then the video and controls update and the
  // stream is not restarted.
  const player = new VideoPlayerPage(page);
  await player.open('live', { realTime: true });
  await player.expectState('live');
  await player.setHostVolume(40);
  await player.expectVolume(40);
  await player.setHostMuted();
  await player.expectMute('Unmute', true);
  await player.expectVideoAudio({ muted: true, volume: 0.4 });
  await player.expectTransportCalls(['configure', 'describe', 'subscribe']);
  await player.expectNoAccessibilityViolations();
});

test('falls back to muted autoplay with an Unmute chip that restores audio', async ({ page }) => {
  // L2-062 AC4: Given audible autoplay is blocked, when the muted retry resolves, then playback runs
  // muted, the mute control is pressed and an Unmute chip is shown; the chip restores audio.
  const player = new VideoPlayerPage(page);
  await player.blockAudiblePlay();
  await player.open('live', { realTime: true, extra: { volume: 60 } });
  await player.expectState('live');
  await player.expectVideoAudio({ muted: true, volume: 0.6 });
  await player.expectMute('Unmute', true);
  await player.expectUnmuteChip(true);
  await player.expectNoAccessibilityViolations();
  await player.clickUnmuteChip();
  await player.expectUnmuteChip(false);
  await player.expectVideoAudio({ muted: false, volume: 0.6 });
  await player.expectMute('Mute', false);
});

test('keeps playback muted when the Unmute chip is dismissed', async ({ page }) => {
  // L2-062 AC4: dismissing the chip leaves playback muted.
  const player = new VideoPlayerPage(page);
  await player.blockAudiblePlay();
  await player.open('live', { realTime: true });
  await player.expectUnmuteChip(true);
  await player.dismissUnmuteChip();
  await player.expectUnmuteChip(false);
  await player.expectVideoAudio({ muted: true, volume: 1 });
  await player.expectNoAccessibilityViolations();
});

test('pauses with the central play affordance when muted autoplay is also blocked', async ({
  page,
}) => {
  // L2-062 AC4: Given the muted retry also rejects, then the state is paused with the affordance.
  const player = new VideoPlayerPage(page);
  await player.blockAllPlay();
  await player.open('live', { realTime: true });
  await player.expectState('paused');
  await player.expectCentralPlay(true);
  await player.expectErrorOutputs([]);
  await player.expectNoAccessibilityViolations();
});

test('waits paused at the live edge when autoplay is off', async ({ page }) => {
  // L2-075 AC1 (autoplay input): Given autoplay is false, then the first frame waits paused.
  const player = new VideoPlayerPage(page);
  await player.open('live', { realTime: true, extra: { autoplay: false } });
  await player.expectState('paused');
  await player.expectVideoPaused(true);
  await player.expectCentralPlay(true);
  await player.clickPlayPause();
  await player.expectState('live');
  await player.expectNoAccessibilityViolations();
});

test('enters fullscreen on the host, presses the control and announces it', async ({ page }) => {
  // L2-063 AC1: Given the Fullscreen control is activated, when requestFullscreen() on the host
  // resolves, then the control is pressed, renamed "Exit fullscreen", and "Fullscreen." is announced.
  const player = new VideoPlayerPage(page);
  await player.stubFullscreen();
  await player.observeAnnouncements();
  await player.open('live', { realTime: true });
  await player.expectAnnouncementHistoryToEndWith('Live.');
  await player.expectFullscreen('Fullscreen', false);
  await player.clickFullscreen();
  await player.expectFullscreenRequestedOnHost();
  await player.expectFullscreen('Exit fullscreen', true);
  await player.expectAnnouncementHistoryToEndWith('Fullscreen.');
  await player.expectNoAccessibilityViolations();
});

for (const exit of ['Escape', 'control'] as const) {
  test(`exits fullscreen with the ${exit} and announces it`, async ({ page }) => {
    // L2-063 AC2: Given fullscreen, when Escape is pressed or the control is activated, then
    // fullscreen exits, the name reverts and "Exited fullscreen." is announced.
    const player = new VideoPlayerPage(page);
    await player.stubFullscreen();
    await player.observeAnnouncements();
    await player.open('live', { realTime: true });
    await player.expectAnnouncementHistoryToEndWith('Live.');
    await player.clickFullscreen();
    await player.expectFullscreen('Exit fullscreen', true);
    if (exit === 'Escape') await player.pressKey('Escape');
    else await player.clickFullscreen();
    await player.expectFullscreen('Fullscreen', false);
    await player.expectAnnouncementHistoryToEndWith('Exited fullscreen.');
    await player.expectNoAccessibilityViolations();
  });
}

test('omits the Fullscreen control when fullscreen is not enabled', async ({ page }) => {
  // L2-063 AC3: Given document.fullscreenEnabled is false, then the control is omitted.
  const player = new VideoPlayerPage(page);
  await player.disableFullscreen();
  await player.open('live', { realTime: true });
  await player.expectState('live');
  await player.expectNoFullscreenControl();
  await player.expectNoAccessibilityViolations();
});

test('derives the pressed state from fullscreenElement on every fullscreenchange', async ({
  page,
}) => {
  // L2-063 AC5: Given fullscreenchange fires for any reason, then the pressed state follows
  // document.fullscreenElement, not the last activation.
  const player = new VideoPlayerPage(page);
  await player.stubFullscreen();
  await player.open('live', { realTime: true });
  await player.expectState('live');
  await player.clickFullscreen();
  await player.expectFullscreen('Exit fullscreen', true);
  await player.exitFullscreenExternally();
  await player.expectFullscreen('Fullscreen', false);
  await player.expectNoAccessibilityViolations();
});

test('renders the host caption track hidden with an unpressed Captions control', async ({
  page,
}) => {
  // L2-064 AC1: Given captions { src, srclang, label }, then the video holds a captions track with
  // those attributes in mode hidden, and the Captions control shows with aria-pressed false.
  const player = new VideoPlayerPage(page);
  await player.open('live', { realTime: true, extra: { captions: true } });
  await player.expectState('live');
  await player.expectTrack({
    src: '/captions-en.vtt',
    srclang: 'en',
    label: 'English',
    mode: 'hidden',
  });
  await player.expectCaptions(false);
  await player.expectNoAccessibilityViolations();
});

test('toggles the caption track between showing and hidden with announcements', async ({
  page,
}) => {
  // L2-064 AC2; L2-071 AC2: toggling on shows the track and announces "Captions on."; toggling off
  // hides it and announces "Captions off.".
  const player = new VideoPlayerPage(page);
  await player.observeAnnouncements();
  await player.open('live', { realTime: true, extra: { captions: true } });
  await player.expectAnnouncementHistoryToEndWith('Live.');
  await player.clickCaptions();
  await player.expectCaptions(true);
  await player.expectTrack({
    src: '/captions-en.vtt',
    srclang: 'en',
    label: 'English',
    mode: 'showing',
  });
  await player.expectAnnouncementHistoryToEndWith('Captions on.');
  await player.expectNoAccessibilityViolations();
  await player.clickCaptions();
  await player.expectCaptions(false);
  await player.expectTrack({
    src: '/captions-en.vtt',
    srclang: 'en',
    label: 'English',
    mode: 'hidden',
  });
  await player.expectAnnouncementHistoryToEndWith('Captions off.');
});

test('renders no caption track or control when captions is null', async ({ page }) => {
  // L2-064 AC3: Given captions is null, then no captions control and no track exist.
  const player = new VideoPlayerPage(page);
  await player.open('live', { realTime: true });
  await player.expectState('live');
  await player.expectNoCaptions();
  await player.expectNoAccessibilityViolations();
});

test('replaces the track on a source change and keeps the showing preference', async ({ page }) => {
  // L2-064 AC4: Given captions.src changes, then the old track is removed, the new one added, and
  // the showing preference is preserved.
  const player = new VideoPlayerPage(page);
  await player.open('live', { realTime: true, extra: { captions: true } });
  await player.expectState('live');
  await player.clickCaptions();
  await player.changeCaptionSource();
  await player.expectTrack({
    src: '/captions-en-b.vtt',
    srclang: 'en',
    label: 'English',
    mode: 'showing',
  });
  await player.expectCaptions(true);
  await player.expectNoAccessibilityViolations();
});
