// Acceptance tests. Traces to L2-061, L2-070, L2-071, L2-075.
import { test } from '@playwright/test';
import { VideoPlayerPage } from './pages/video-player-page';

test('pauses holding the frame, renames the control Play and keeps the subscription open', async ({
  page,
}) => {
  // L2-061 AC1; L2-070 AC2: Given live, when Pause is activated, then the video pauses, the state
  // is paused, the control is named "Play", the central play affordance shows, "Paused." is
  // announced, and chunks keep arriving.
  const player = new VideoPlayerPage(page);
  await player.observeAnnouncements();
  await player.open('live', { realTime: true });
  await player.expectState('live');
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
  await player.open('live', { realTime: true });
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
