// Acceptance tests. Traces to L2-082.
// Opt-in: runs against the demonstration backend only when TESSERA_VIDEO_HUB_URL is set, for
// example TESSERA_VIDEO_HUB_URL=http://localhost:5180/hubs/video pnpm e2e video-player-backend.
import { test } from '@playwright/test';
import { VideoPlayerPage } from './pages/video-player-page';

const hubUrl = process.env['TESSERA_VIDEO_HUB_URL'];

test.describe.configure({ timeout: 60_000 });

test('plays the looping demonstration stream through SignalR to the first frame', async ({
  page,
}) => {
  // L2-082 AC6: with the backend running, the player reaches the first frame of the looping demo
  // stream and the first chunk it received was the initialisation segment.
  test.skip(!hubUrl, 'Set TESSERA_VIDEO_HUB_URL to run against the demonstration backend.');
  const player = new VideoPlayerPage(page);
  const token = await player.requestDemoToken(new URL('/demo/token', hubUrl!).href);
  await player.open('backend', {
    realTime: true,
    extra: { hubUrl: hubUrl!, token, streamId: 'lecture-hall-a' },
  });
  await player.expectFirstFrame();
  await player.expectFirstChunkKind(0);
});
