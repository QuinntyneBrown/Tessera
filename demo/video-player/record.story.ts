import { test } from '@playwright/test';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Narrator } from '../narration';
import { VideoPlayerDemoPage } from './page';

interface Segment {
  id: string;
  text: string;
  duration: number;
}

test('narrated continuous video player walkthrough', async ({ page }) => {
  const run = process.env['VIDEO_PLAYER_DEMO_RUN']!;
  const segments: Segment[] = JSON.parse(readFileSync(join(run, 'segments.json'), 'utf8'));
  const narrator = new Narrator(page);
  const player = new VideoPlayerDemoPage(page);
  const speech: { id: string; at: number; duration: number }[] = [];
  const said = new Set<string>();
  /** Shows one narration paragraph as the caption for as long as its clip plays, plus a margin. */
  const say = async (id: string, at: 'top' | 'bottom' = 'top') => {
    const segment = segments.find((item) => item.id === id);
    if (!segment || said.has(id)) throw new Error(`Unknown or repeated narration step: ${id}`);
    said.add(id);
    narrator.mark(id);
    speech.push({ id, at: narrator.markers[id], duration: segment.duration });
    await narrator.caption(segment.text, segment.duration * 1000 + 700, at);
    await narrator.clearCaption();
  };
  const length = (id: string) => segments.find((item) => item.id === id)!.duration * 1000;

  // One page records the whole story; nothing below injects player state.
  const opening = narrator.card(
    'Tessera video player',
    'A narrated tour of the live video player component',
    length('opening') + 1200,
  );
  await say('opening');
  await opening;
  await player.openExamples();

  await narrator.chapter('1. Watch a live stream', 'Pause holds the picture; Play returns to live');
  await player.show('custom-transport');
  await player.hoverControls('custom-transport');
  await player.expectState('live', 'custom-transport');
  await player.expectPlaying('custom-transport');
  await player.expectRegion('Video player: Lecture hall A', 'custom-transport');
  await player.expectLiveBadge('Live', 'custom-transport');
  await player.expectElapsedRunning('custom-transport');
  narrator.mark('poster');
  await say('live');
  await player.click('play-pause', 'custom-transport');
  await player.expectState('paused', 'custom-transport');
  await player.expectPauseShowsPlayButton('custom-transport');
  await player.expectAnnouncement('Paused.', 'custom-transport');
  await say('pause');
  await player.expectLiveBadge(/^Go to live, ([5-9]|\d\d) seconds behind$/, 'custom-transport');
  await say('behind');
  await player.click('play-pause', 'custom-transport');
  await player.expectState('live', 'custom-transport');
  await player.expectNearLiveEdge('custom-transport');
  await player.expectLiveBadge('Live', 'custom-transport');
  await player.expectAnnouncement('Back live.', 'custom-transport');
  await say('resume');
  await player.expectMuted(true, 'custom-transport');
  await player.click('mute', 'custom-transport');
  await player.expectMuted(false, 'custom-transport');
  await player.expectAnnouncement('Unmuted, volume 100%.', 'custom-transport');
  await player.clickVolumeAt(0.45, 'custom-transport');
  await player.expectVolume('lowered', 'custom-transport');
  await say('volume');

  await narrator.chapter('2. Keyboard and captions', 'Every control works without a mouse');
  await player.show('captions');
  await player.expectState('paused', 'captions');
  await player.tabIntoPlayerAfter('Captions');
  await player.expectFocused('play-pause', 'captions');
  await say('tab');
  await player.press('Space');
  await player.expectState('live', 'captions');
  await player.expectPlaying('captions');
  await player.press('m');
  await player.expectMuted(true, 'captions');
  await player.expectAnnouncement('Muted.', 'captions');
  await player.press('m');
  await player.expectMuted(false, 'captions');
  await player.press('ArrowDown');
  await player.press('ArrowDown');
  await player.expectVolume(90, 'captions');
  await say('keys');
  await player.press('c');
  await player.expectCaptions(true, 'captions');
  await player.expectAnnouncement('Captions on.', 'captions');
  await say('captions');
  await player.stepAway();
  await player.expectControlsHidden(true, 'captions');
  await player.expectCaptions(true, 'captions');
  await say('caption-clear');

  await narrator.chapter('3. Make it yours', 'Your words, your colours');
  await player.show('i18n');
  await player.expectRegion('Reproductor de vídeo: Lecture hall A', 'i18n');
  await player.expectPlayLabel('Reproducir', 'i18n');
  await player.expectLiveBadgeText('EN DIRECTO', 'i18n');
  await say('i18n');
  await player.show('themed');
  await player.expectAccent('rgb(122, 62, 157)', 'themed');
  await say('theme');

  await narrator.chapter("4. When the hub can't be reached", 'Clear errors, and a way to retry');
  await player.showTop();
  await player.expectState('idle', 'basic');
  await say('hub');
  await player.connectToHub();
  await player.expectState('error', 'basic');
  await player.expectError("The connection was lost and couldn't be restored.", 'basic');
  await say('hub-error');

  await narrator.chapter('5. Recover from interruptions', 'Reconnect on its own, end cleanly');
  await player.openAcceptance({ scenario: 'live', containerWidth: '640' });
  await player.expectState('live');
  await player.expectPlaying();
  await player.expectReportedStatesStartAndEnd(['connecting'], ['live']);
  await say('fixture');
  await player.simulateConnectionLoss();
  await player.expectState('reconnecting');
  await player.expectStatus('Reconnecting… attempt 1 of 5');
  await player.expectDimmed();
  await player.expectAnnouncement('Connection lost. Reconnecting.');
  await say('reconnecting');
  await player.simulateConnectionRestored();
  await player.expectState('live');
  await player.expectPlaying();
  await player.expectAnnouncement('Reconnected. Live.');
  await player.expectReportedStatesStartAndEnd(['connecting'], ['reconnecting', 'live']);
  await say('reconnected');
  await player.openAcceptance({ scenario: 'live', containerWidth: '640', endAfter: '8' });
  await player.expectState('live');
  await say('ending-soon');
  await player.expectEnded('1 minute');
  await player.expectAnnouncement('Stream ended. It was live for 1 minute.');
  await say('ended');

  await player.expectHealthy();
  const ending = narrator.card(
    'Tessera video player',
    'Live playback · Keyboard control · Captions · Recovery',
    length('ending') + 1500,
  );
  await say('ending');
  await ending;
  if (said.size !== segments.length) throw new Error('Some narration paragraphs were not shown');

  const video = page.video()!;
  await page.close();
  mkdirSync(join(run, 'staging'), { recursive: true });
  await video.saveAs(join(run, 'staging', 'video-player-raw.webm'));
  writeFileSync(
    join(run, 'timeline.json'),
    JSON.stringify({ chapters: narrator.chapters, markers: narrator.markers, speech }, null, 2),
  );
});
