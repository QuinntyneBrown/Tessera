# Tessera video stream demonstration backend

`Tessera.VideoStream.Demo` turns a catalogued local MP4 file into a live fragmented-MP4 stream and serves it to
`t-video-player` (`@tessera/video-player`) over a SignalR hub with the MessagePack protocol. It exists to prove the
transport end to end, to give the dev app a real stream, and to show a host what its own streaming backend has to
provide. It is a demonstration, not a production service.

It lives in `demo/` as an explicit exception to the angular/components layout. The requirements are
[L2-085 to L2-094](../../docs/specs/L2.md#l2-085-stream-catalogue-and-stream-identifier-validation), the design is in
[docs/detailed-designs/video-stream-backend](../../docs/detailed-designs/video-stream-backend/), and the hub contract
is recorded in [ADR-0002](../../docs/adr/frontend/0002-stream-live-video-as-fmp4-over-signalr-messagepack.md).

## Prerequisites

- The [.NET 10 SDK](https://dotnet.microsoft.com/download) (`global.json` accepts any 10.0 feature band).
- [FFmpeg](https://ffmpeg.org/download.html) built with the `libx264` and `aac` encoders, on `PATH` or at
  `Ffmpeg:Path`. Streaming needs it; the automated tests do not.
- The ASP.NET Core development certificate for HTTPS: `dotnet dev-certs https --trust`.

## Run

From the repository root:

```sh
dotnet run --project demo/video-stream-backend/Tessera.VideoStream.Demo
```

The default launch profile listens on `https://localhost:7180` and `http://localhost:5180`. It serves:

| Endpoint | Purpose |
| --- | --- |
| `/hubs/video` | The SignalR hub, MessagePack only, behind the access token |
| `GET /demo/token` | Returns `{ "token": "<Demo:AccessToken>" }` to an allowed origin, so the dev app needs no secret |
| `GET /healthz` | `{ status, description, ffmpeg, activeSessions }`; 200 when `{Ffmpeg:Path} -version` succeeds, 503 otherwise |

Two streams are catalogued, both replaying the committed ten-second fixture
`src/e2e-app/public/lecture-10s.fmp4`:

| Stream | Behaviour |
| --- | --- |
| `lecture-hall-a` | Loops forever (`-stream_loop -1`) |
| `lab-camera-short` | Plays once and completes after about ten seconds, so the player's ended state can be seen |

Then start the dev app (`corepack pnpm start`) and open its video player page. It plays from the backend when
`http://localhost:5180/demo/token` answers, and falls back to the replayed fixture otherwise; `?backend=` points it at
another origin. The opt-in Playwright test plays `lecture-hall-a` through the real SignalR transport:

```sh
TESSERA_VIDEO_HUB_URL=http://localhost:5180/hubs/video corepack pnpm e2e video-player-backend
```

Without FFmpeg the backend still starts: it logs an error naming the configured path, `/healthz` reports unhealthy,
`Describe` still succeeds, and every `Subscribe` ends with `source-failed: ffmpeg not found`.

## Test

From this folder (its `global.json` selects the Microsoft.Testing.Platform runner):

```sh
cd demo/video-stream-backend
dotnet test
```

The xunit v3 project needs no FFmpeg: sessions consume an `IFragmentSource`, and the tests supply sources that replay
the committed fixture. One test, `[Trait("Category", "Integration")]`, runs the real FFmpeg pipeline on the fixture
to its first fragment and skips with "ffmpeg not found on PATH" when FFmpeg is absent. To leave it out:

```sh
dotnet test -- --filter-not-trait "Category=Integration"
```

## Configuration

Every key can be set in `appsettings.json`, an environment variable (`Ffmpeg__Path`), or the command line
(`--Ffmpeg:Path=/opt/ffmpeg/bin/ffmpeg`).

| Key | Default | Meaning |
| --- | --- | --- |
| `MediaRoot` | `../../../src/e2e-app/public` | Directory every catalogue `File` resolves under; relative to the project folder |
| `Streams:{id}:Title` | | Title returned by `Describe` |
| `Streams:{id}:File` | | Media file, relative to `MediaRoot` |
| `Streams:{id}:Loop` | `false` | Restart the file at its end instead of completing the stream |
| `Streams:{id}:Codecs` | `avc1.4d401f,mp4a.40.2` | Codecs in the descriptor's `mimeType`, `video/mp4; codecs="{Codecs}"` |
| `Ffmpeg:Path` | `ffmpeg` | FFmpeg executable |
| `Demo:AccessToken` | `tessera-demo` | The one bearer token the demonstration handler accepts |
| `Cors:AllowedOrigins` | `["http://localhost:4200"]` | Browser origins allowed to negotiate, with credentials |
| `IdleStopSeconds` | `10` | Grace period after the last subscriber leaves before FFmpeg is stopped |

A stream identifier must match `^[a-z0-9][a-z0-9-]{0,63}$`. Clients only ever name a stream by identifier; the
backend never accepts a path. Startup fails, naming the entry, when a `File` resolves outside `MediaRoot` or does not
exist.

### Stream any local MP4 file

Point an entry's `File` at the file, with `MediaRoot` set to a directory that contains it. For example, to stream
`/home/me/videos/lecture.mp4`:

```json
{
  "MediaRoot": "/home/me/videos",
  "Streams": {
    "my-lecture": { "Title": "My lecture", "File": "lecture.mp4", "Loop": true }
  }
}
```

FFmpeg transcodes the input to H.264 Main and AAC-LC in real time, so any input FFmpeg can read works and the default
`Codecs` stay correct. Then set the dev app's stream to `my-lecture`, or call `Describe("my-lecture")`.

## Hub contract

The hub at `/hubs/video` supports the MessagePack protocol only; a JSON-protocol client is refused at the handshake.
Both messages use integer keys, so they arrive in JavaScript as arrays.

| Method | Shape |
| --- | --- |
| `Describe(streamId)` | `StreamDescriptor`: `[0] streamId`, `[1] title`, `[2] mimeType`, `[3] startedAt` (ISO-8601 UTC), `[4] width`, `[5] height` |
| `Subscribe(streamId)` | Server-to-client stream of `VideoChunk`: `[0] kind` (0 init, 1 media), `[1] seq` (uint32), `[2] data` (bytes) |

`startedAt` is the running session's start, or the current time when nobody is watching yet. `width` and `height`
are 0, because the catalogue carries no dimensions; the player then uses 16:9.

The first chunk of every subscription is the initialisation segment (`ftyp` + `moov`) with `seq` 0, including for a
subscriber that joins a running stream; media starts at the next fragment (`moof` + `mdat`, about one second, starting
on a keyframe). `seq` increases by 1 per chunk delivered to that subscriber. When FFmpeg restarts, every subscriber
receives a new initialisation segment before further media.

| Outcome | What the client sees |
| --- | --- |
| The source ends (non-looping file) | The stream completes |
| Malformed or uncatalogued identifier | `HubException("unknown-stream")` from `Describe` or `Subscribe` |
| FFmpeg fails more than 3 times in 60 s, or cannot start | `HubException("source-failed: ffmpeg exited {code}")` or `source-failed: ffmpeg not found` |
| The subscriber leaves 60 s of chunks unread | `HubException("slow-consumer")` |

No FFmpeg output ever reaches a client. Its standard error is logged at debug level, and its last 20 lines are logged
with each failure.

Each subscriber has a channel of 30 chunks. When it is full the oldest chunk is dropped, the drop is counted and
logged, and the `seq` gap tells the player to jump to the live edge; one slow viewer never delays the others. FFmpeg
starts with the first subscriber, is shared by every later one, stops `IdleStopSeconds` after the last one leaves, is
restarted 2 s after a failure (at most 3 times in any 60 s) or 15 s after it stops writing, and is killed on shutdown.

## Security

- **Replace the authentication handler.** `DemoTokenAuthenticationHandler` accepts one configured token and is
  registered in one place in `Program.cs`. A real host replaces that `AddAuthentication(...).AddScheme(...)`
  registration with its identity provider's JWT bearer scheme; the `[Authorize]` hub does not change. A real host also
  does not expose `/demo/token`.
- **HTTPS is required outside localhost.** The SignalR WebSocket transport sends the access token as the
  `access_token` query parameter. The backend accepts that parameter on `/hubs/video` only and logs requests without
  their query string, but anything that is not `localhost` must be served over HTTPS so the token is never sent in the
  clear.
- **CORS.** Only `Cors:AllowedOrigins` may negotiate from a browser, with credentials.

## Fixture

`src/e2e-app/public/lecture-10s.fmp4` is a synthetic 10.24 s test pattern with a 440 Hz tone, generated from FFmpeg
`lavfi` sources by `node tools/generate-video-fixture.mjs`, which runs:

```sh
ffmpeg -y -hide_banner -loglevel warning \
  -f lavfi -i testsrc2=size=320x180:rate=25 \
  -f lavfi -i sine=frequency=440:sample_rate=48000 \
  -t 10.24 -map 0:v -map 1:a \
  -c:v libx264 -profile:v main -level:v 3.1 -pix_fmt yuv420p \
  -preset veryfast -tune zerolatency -b:v 150k \
  -x264-params keyint=25:min-keyint=25:scenecut=0:bframes=0 \
  -c:a aac -b:a 32k -ac 1 -ar 48000 \
  -movflags frag_keyframe+empty_moov+default_base_moof \
  -map_metadata -1 -fflags +bitexact -f mp4 src/e2e-app/public/lecture-10s.fmp4
```

The same file is the player's acceptance-test fixture, the backend tests' fixture, and the demonstration's media, so
there is one copy in the repository.
