# @tessera/video-player

Browser-only, standalone Angular player for a live video stream. The host's SignalR hub sends
fragmented MP4 (H.264 video, AAC audio) with the MessagePack protocol; the player appends it to a
`MediaSource` behind a native `<video>` element and owns a slim, accessible control bar. It is live
only: there is no seek bar, pause holds the picture, and resume jumps back to the live edge.

Requires Angular 22.2, CDK 22.2.1, RxJS 7.8, `@tessera/theme`, and, for the default transport,
`@microsoft/signalr` and `@microsoft/signalr-protocol-msgpack` 10. The SignalR packages are peer
dependencies, so an app that provides its own transport does not need to bundle them.

```ts
import { Component } from '@angular/core';
import { VideoPlayer, VideoPlayerError, VideoPlayerState } from '@tessera/video-player';

@Component({
  imports: [VideoPlayer],
  template: `
    <t-video-player
      hubUrl="https://lms.example/hubs/video"
      streamId="lecture-hall-a"
      [accessTokenFactory]="token"
      [captions]="{ src: '/captions/lecture-hall-a.vtt', srclang: 'en', label: 'English' }"
      (stateChange)="state = $event"
      (error)="report($event)"
    />
  `,
})
export class LectureStream {
  state: VideoPlayerState = 'idle';
  /** Your app's token source; the player hands it to the transport only. */
  readonly token = () => fetch('/api/video-token').then((response) => response.text());
  report(error: VideoPlayerError) {
    console.info(error.code);
  }
}
```

## Inputs and outputs

| Input                | Type                              | Default | Meaning                                                                                                             |
| -------------------- | --------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------- |
| `hubUrl`             | `string \| null`                  | `null`  | Hub endpoint, passed to the transport unchanged                                                                     |
| `streamId`           | `string \| null`                  | `null`  | Stream to play; changing it re-subscribes on the same connection; `null` stops the connection and returns to `idle` |
| `accessTokenFactory` | `() => string \| Promise<string>` | unset   | Called by the transport for every connection; the player never stores the token                                     |
| `captions`           | `VideoPlayerCaptions \| null`     | unset   | One WebVTT track, `{ src, srclang, label }`                                                                         |
| `autoplay`           | `boolean`                         | `true`  | Play as soon as the first frame is buffered; `false` waits paused at the live edge                                  |
| `muted`              | `boolean`                         | `false` | Mutes the video without restarting the stream                                                                       |
| `volume`             | `number`                          | `100`   | 0 to 100, without restarting the stream                                                                             |
| `titleOverride`      | `string`                          | unset   | Replaces the descriptor title in the region name and messages                                                       |

| Output        | Payload                                         | When                                                                                                                                                                            |
| ------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `stateChange` | `VideoPlayerState`                              | Once per transition between `idle`, `connecting`, `live`, `buffering`, `paused`, `reconnecting`, `ended` and `error`; the host's `data-state` attribute always equals the state |
| `error`       | `VideoPlayerError` (`code`, `message`, `cause`) | Once per failure; codes are `unsupported`, `unauthorized`, `not-found`, `connection`, `source`, `decode`, `stalled`; raw server text travels only in `cause`                    |
| `stats`       | `VideoPlayerStats`                              | Every second while `connecting`, `live`, `buffering`, `paused` or `reconnecting`: `state`, `latencySeconds`, `bufferedAheadSeconds`, `bytesReceived`, `droppedFrames`           |

Playback stays 3 seconds behind the newest buffered media and jumps back when it falls more than
8 seconds behind for two seconds. Media more than 30 seconds behind the playhead is pruned once
over 60 seconds is buffered behind it. A lost connection reconnects on 0, 2, 5, 10 and 10 seconds,
then fails with `connection`; ten seconds without a chunk shows "Waiting for the source…" and
thirty fails with `stalled`. Every error except `unsupported` offers Retry, which starts a fresh
connection and asks the token factory again.

## Transport contract

The default transport is `SignalRVideoStreamTransport`; every player without a provider creates
its own, so each owns one hub connection. The hub must offer `Describe(streamId)`, returning the
descriptor, and `Subscribe(streamId)`, a server-to-client stream of chunks, both with
integer-keyed MessagePack objects (see
[ADR-0002](../../docs/adr/frontend/0002-stream-live-video-as-fmp4-over-signalr-messagepack.md)).
A chunk is `{ kind: 0 | 1, seq, data }`: kind 0 is the initialisation segment (`ftyp` and
`moov`), kind 1 one media fragment (`moof` and `mdat`). Completion means the source ended; a
`HubException` such as `unknown-stream` or `source-failed: …` means it failed.

Provide `VIDEO_STREAM_TRANSPORT` to replace SignalR for every player below the provider:

```ts
interface VideoStreamTransport {
  describe(streamId: string): Promise<VideoStreamDescriptor>;
  subscribe(streamId: string): Observable<VideoChunk>;
  readonly connectionEvents: Observable<'reconnecting' | 'reconnected' | 'closed'>;
  configure?(options: {
    hubUrl: string | null;
    accessTokenFactory?: () => string | Promise<string>;
  }): void;
  stop?(): void | Promise<void>;
}
```

The player calls `configure` before each connection's first `describe`, and `stop` when the stream
is cleared, the hub URL or token factory changes, on Retry and on destroy. A rejection carrying
`statusCode` 401 or 403 maps to `unauthorized`.

## Host security obligations

- The page's Content Security Policy must allow `media-src blob:` (the `MediaSource` object URL)
  and `connect-src` for the hub origin, for both the negotiate request and the WebSocket.
- SignalR's WebSocket transport sends the token as the `access_token` query parameter. Use TLS
  (`https:` or `wss:`) everywhere except `localhost`; development builds warn once otherwise.
- Servers and proxies must not log query strings.
- Descriptor fields are untrusted: the player renders them as text only.

## Captions

Captions are a host-supplied WebVTT file rendered as `<track kind="captions">`; the player never
generates them. Cue times are on the stream's media timeline, so the host must align them with the
fragments it sends. Changing `captions.src` replaces the track and keeps the viewer's on or off
choice. Cue text uses `--t-video-player-caption-bg` and `--t-video-player-caption-fg`.

## Keyboard and accessibility

The player is a region named "Video player: {title}" with a `role="group"` control bar of native
buttons and a native range slider, in this Tab order: Play/Pause, Mute, Volume (hidden below
47.5em), the LIVE badge, Captions (when supplied) and Fullscreen (when supported). The stage is not
in the Tab sequence. Toggles use `aria-pressed`; unavailable controls use `aria-disabled` and stay
focusable. One polite live region per player announces milestones and toggles; errors use
`role="alert"`.

| Key (focus inside the player)            | Action                   |
| ---------------------------------------- | ------------------------ |
| Space or K (not on the slider)           | Play or pause            |
| M                                        | Mute or unmute           |
| F                                        | Enter or exit fullscreen |
| C                                        | Captions on or off       |
| Arrow Up, Arrow Down (not on the slider) | Volume up or down by 5   |
| Escape                                   | Exit fullscreen          |

Letters ignore Ctrl, Alt and Meta. On the slider, arrow keys keep their native behaviour.

## Localisation

Provide `VIDEO_PLAYER_I18N` with any subset of `VideoPlayerStrings`; other keys keep their English
defaults (`DEFAULT_VIDEO_PLAYER_STRINGS`). Strings that embed values are functions:
`regionLabel(title)`, `connecting(title)`, `volumeValue(volume)`, `unmuted(volume)`,
`goToLive(seconds)`, `behindLive(seconds)`, `reconnecting(attempt, max)`, `duration(seconds)`,
`liveFor(duration)`, `endedAfter(duration)` and `errorUnsupported(mimeType)`. The other keys are
`connectingStatus`, `liveAnnounced`, `buffering`, `waitingForSource`, `connectionLost`,
`reconnected`, `streamEnded`, `controlsLabel`, `play`, `pause`, `paused`, `backLive`, `mute`,
`unmute`, `volumeLabel`, `muted`, `unmuteChip`, `dismiss`, `live`, `liveBadge`, `captions`,
`captionsOn`, `captionsOff`, `fullscreen`, `exitFullscreen`, `fullscreenOn`, `fullscreenOff`,
`retry`, and the error messages `errorUnauthorized`, `errorNotFound`, `errorConnection`,
`errorSource`, `errorDecode` and `errorStalled`.

## Theme tokens

Each value resolves from the component token, then the shared `@tessera/theme` token, then the
theme's default. Set them on any ancestor.

| Token                               | Shared fallback                            |
| ----------------------------------- | ------------------------------------------ |
| `--t-video-player-scrim`            | `colorNeutralBackground1`                  |
| `--t-video-player-control-fg`       | `colorNeutralForeground1`                  |
| `--t-video-player-control-bg-hover` | `colorNeutralBackground1Hover`             |
| `--t-video-player-accent`           | `colorBrandBackground`                     |
| `--t-video-player-accent-fg`        | `colorNeutralForegroundOnBrand`            |
| `--t-video-player-live`             | `colorPaletteRedForeground1`               |
| `--t-video-player-focus-ring`       | `colorStrokeFocus2`                        |
| `--t-video-player-error`            | `colorPaletteRedForeground1`               |
| `--t-video-player-error-fg`         | `colorNeutralForeground1`                  |
| `--t-video-player-skeleton`         | `colorNeutralBackground2`                  |
| `--t-video-player-caption-bg`       | none (black at 85%)                        |
| `--t-video-player-caption-fg`       | none (white)                               |
| `--t-video-player-motion-duration`  | `durationNormal` (0s under reduced motion) |
| `--t-video-player-radius`           | `borderRadiusMedium`                       |

Custom palettes remain the host's accessibility responsibility: keep control text at 4.5:1 and
icons and the focus ring at 3:1 against the scrim.

## Consumer testing and examples

`VideoPlayerHarness` (exported from the package root) operates a player through its public DOM:
`getState()`, `play()`, `pause()`, `toggleMute()`, `isMuted()`, `setVolume(n)`, `getVolume()`,
`toggleCaptions()`, `areCaptionsShowing()`, `isLive()`, `goToLive()`, `getStatusText()`,
`getErrorMessage()` and `retry()`. It relies on the host's `data-state`, the controls'
`data-control` attributes (`play-pause`, `mute`, `volume`, `live`, `captions`, `fullscreen`,
`unmute-chip`), the `t-video-player__status` element and the `role="alert"` panel, which are part
of the public contract and do not change with localisation.

Runnable examples live in `src/components-examples/tessera/video-player/`: a hub connection, a
custom transport that replays a file, captions, localised strings and a themed player. The dev app
plays the demonstration backend's streams when it answers `GET /demo/token`, and the replayed
fixture otherwise.

## Definition of done

The player is complete when every acceptance criterion of L2-057 to L2-094 passes, axe-core reports
zero violations in every listed state, the
[manual screen reader matrix](../../docs/verification/video-player-screen-reader-matrix.md) is
signed with no open failures, `pnpm api:check` passes, and the zoneless acceptance app exercises
play, pause, mute and reconnect. L2-085 to L2-094 (the demonstration backend) and the manual matrix
are still open; see the
[implementation status](../../docs/detailed-designs/implementation-status.md).
