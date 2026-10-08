// Regenerates the committed fragmented-MP4 fixture used by the video player tests and examples.
// Requires FFmpeg on PATH. Run: node tools/generate-video-fixture.mjs
import { execFileSync } from 'node:child_process';

const output = 'src/e2e-app/public/lecture-10s.fmp4';
// 10.24 s is a whole number of 25 fps frames and of 1024-sample AAC frames at 48 kHz, so a
// replayed loop can be shifted by an exact period on both tracks.
execFileSync(
  'ffmpeg',
  [
    ...['-y', '-hide_banner', '-loglevel', 'warning'],
    ...['-f', 'lavfi', '-i', 'testsrc2=size=320x180:rate=25'],
    ...['-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=48000'],
    ...['-t', '10.24', '-map', '0:v', '-map', '1:a'],
    ...['-c:v', 'libx264', '-profile:v', 'main', '-level:v', '3.1', '-pix_fmt', 'yuv420p'],
    ...['-preset', 'veryfast', '-tune', 'zerolatency', '-b:v', '150k'],
    ...['-x264-params', 'keyint=25:min-keyint=25:scenecut=0:bframes=0'],
    ...['-c:a', 'aac', '-b:a', '32k', '-ac', '1', '-ar', '48000'],
    ...['-movflags', 'frag_keyframe+empty_moov+default_base_moof'],
    ...['-map_metadata', '-1', '-fflags', '+bitexact', '-f', 'mp4', output],
  ],
  { stdio: 'inherit' },
);
console.log(`Wrote ${output}`);
