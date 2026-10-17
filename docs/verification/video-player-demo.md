# Video player demonstration record

This is the manual end-to-end check of L2-094 AC4: with the demonstration backend and the dev app both running, the
dev app's video player page plays a backend stream. The dev app falls back to the replayed fixture when the backend is
absent (L2-084), so every entry states which transport played.

## Procedure

1. Install the prerequisites in the [backend README](../../demo/video-stream-backend/README.md#prerequisites).
2. Start the backend: `dotnet run --project demo/video-stream-backend/Tessera.VideoStream.Demo`.
3. Check `http://localhost:5180/healthz` reports `"ffmpeg": true`.
4. Start the dev app: `corepack pnpm start`, and open its video player page in a browser that decodes H.264 and AAC
   (desktop Chrome, Edge, or Firefox; not iOS Safari, which is out of scope for v1).
5. Confirm the page says "Playing from the demonstration backend at http://localhost:5180".
6. With "Lecture hall A (looping)" selected, confirm the picture and the 440 Hz tone play, the LIVE badge shows, and
   playback continues past the ten-second loop point.
7. Select "Lab camera (ends)" and confirm the player reaches "Stream ended" after about ten seconds.
8. Optionally run `TESSERA_VIDEO_HUB_URL=http://localhost:5180/hubs/video corepack pnpm e2e video-player-backend`.
9. Add a row below.

## Results

| Date | Browser and OS | Transport | Result | Defects | Recorded by |
|---|---|---|---|---|---|
| 2026-10-17 | Playwright Chromium build 1194, Linux container | Backend over SignalR (WebSockets) | **Not passed: browser limitation.** The player reached the backend and applied its descriptor, then showed the `unsupported` error because this Chromium build has no H.264 or AAC decoder; the fixture-only pipeline tests fail the same way in it. The backend itself was verified with the player's SignalR client and `ffprobe`; see the [backend implementation record](video-stream-backend-implementation.md#live-run-slice-9). | None found in the backend | Claude Code |

L2-094 AC4 stays open until a row records a pass on a browser with H.264 and AAC.
