# Video stream backend implementation record

The demonstration backend (L2-085 to L2-094) in `demo/video-stream-backend/` is implemented. Each slice was built test
first: its xunit acceptance tests in `Tessera.VideoStream.Demo.Tests` ran and failed for the stated reason before
production code was written. Where a test passed before its behaviour was built, or could pass vacuously, a mutation of
the production code was run to show that it fails without the behaviour. No architecture tests were added.

Every slice is one commit on the `video-stream-backend` branch; its message repeats the red and green evidence.

| Slice | Criteria | Red evidence | Green evidence |
|---|---|---|---|
| 1. Fragment reader | L2-086 AC2, AC3, AC5; L2-093 AC2 | With an empty reader, all 7 reader tests failed | 7 of 7, with 1, 7, 4096 and header-splitting 3/5 byte reads |
| 2. Catalogue, Describe, token, MessagePack only | L2-085 AC1-4; L2-086 AC4; L2-088 AC1, AC2; L2-092 AC1 | 10 hub tests failed (404 at negotiate, no startup failure) | 18 of 18; the JSON-refusal test passed vacuously at first and fails with the protocol list removed |
| 3. CORS, token endpoint, query token, logging | L2-092 AC2-5 | Token endpoint, configured-origin and query-logging tests failed | 26 of 26; the unlisted-origin, hub-path-only and logging tests fail under mutations allowing any origin, accepting the query token anywhere, and logging `RequestQuery` |
| 4. Session lifecycle and init cache | L2-087 AC1, AC2, AC4; L2-089 AC1-4; L2-093 AC3 | Session tests did not compile | 31 of 31; session tests 5 of 5 repeats |
| 5. Backpressure and slow consumers | L2-090 AC1-4; L2-087 AC4; L2-093 AC3 | Three tests failed with a zero drop counter and no sweep | 34 of 34, three repeats |
| 6. Restart budget and failure reporting | L2-091 AC1, AC2, AC4; L2-087 AC3; L2-086 AC3; L2-093 AC3 | Four supervision tests failed (failures were unhandled) | 38 of 38, five repeats |
| 7. Subscribe, registry, shutdown | L2-088 AC2-5; L2-089 AC5; L2-093 AC4 | Streaming tests did not compile | 44 of 44, three repeats; the shutdown and dispose tests fail without the hosted registry and without the detach |
| 8. FFmpeg source and health | L2-086 AC1; L2-091 AC3-5; L2-093 AC1, AC5; L2-094 AC3 | Source tests did not compile; `/healthz` absent | 52 of 52 with FFmpeg, three repeats; with FFmpeg off `PATH`, 51 pass and the integration test skips with "ffmpeg not found on PATH" |
| 9. Run and document | L2-092 AC4, AC5; L2-094 AC1, AC2, AC4 | The opt-in Playwright test failed with `ECONNREFUSED 127.0.0.1:5180` | See below |

## Live run (slice 9)

On 2026-10-17, in a Linux container with .NET SDK 10.0.112 and FFmpeg on `PATH`, the backend was started with
`dotnet run --project demo/video-stream-backend/Tessera.VideoStream.Demo`. It listened on `https://localhost:7180` and
`http://localhost:5180`, `/healthz` answered `{"status":"Healthy","ffmpeg":true,"activeSessions":0}`, and
`/demo/token` answered the dev app's origin with credentials allowed.

A Node script drove it with `@microsoft/signalr` and `@microsoft/signalr-protocol-msgpack`, the player's own client
stack, over WebSockets:

| Check | Result |
|---|---|
| Negotiate without a token | 401 |
| `Describe("lecture-hall-a")` | Six members, `video/mp4; codecs="avc1.4d401f,mp4a.40.2"`, ISO-8601 UTC `startedAt` |
| `Describe("../etc/passwd")` | `HubException: unknown-stream` |
| `Subscribe("lecture-hall-a")`, 6 chunks | `kind` 0,1,1,1,1,1, `seq` 0 to 5, about 45 to 57 KB per fragment, in 5.6 s (real-time pacing) |
| A second connection joining | First chunk `kind` 0, `seq` 0, byte-identical to the cached init segment |
| `Subscribe("lab-camera-short")` | Completed after 9.8 s with 12 chunks |
| `ffprobe` on the captured init + 5 fragments | H.264 Main 320 by 180, 150 frames; AAC-LC, 235 frames |
| The token in the WebSocket query | Not present in the server log |
| FFmpeg processes | One while watched, none after the grace period; none left after SIGINT, which stopped the host in 0.11 s |

The opt-in Playwright test (`TESSERA_VIDEO_HUB_URL=http://localhost:5180/hubs/video`) then reached the backend and
applied the descriptor (the region was named "Video player: Lecture hall A") but ended in the `unsupported` error:
that environment's only Chromium (Playwright build 1194) has no H.264 or AAC decoder, and its proxy blocked
downloading another browser. The fixture-only pipeline tests in `video-player-pipeline.spec.ts`, which use no
backend, fail the same way there, so this is the browser, not the backend. The in-browser check of L2-094 AC4 is open
in [video-player-demo.md](video-player-demo.md).
