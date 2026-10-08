# Video player subsystem

## Overview

`@tessera/video-player` provides `t-video-player`, a browser-only Angular component that plays a live video stream delivered by the host application's SignalR hub.

**Live stream** — video that is produced while it is watched, with no fixed duration and no seekable past

**Fragmented MP4** — MP4 layout in which one initialisation segment (`ftyp` and `moov`) is followed by self-contained media fragments (`moof` and `mdat`)

**Initialisation segment** — bytes that describe the tracks and codecs and that a decoder needs before any media fragment

**Media Source Extensions (MSE)** — browser API through which script appends media bytes to a `SourceBuffer` behind a native `<video>` element

**Live edge** — most recent moment that the player has received; playback stays a short, fixed distance behind it

**Chunk** — one hub message carrying either the initialisation segment or one media fragment

**Live region** — visually hidden element whose text changes assistive technology reads aloud

The component serves a learning management system that shows a live lecture, laboratory camera, or similar source to a learner. The host backend runs the source through FFmpeg and streams fragmented MP4 over a SignalR hub with the MessagePack protocol. The player appends those chunks to a `MediaSource` on a native `<video>` element, hides the native controls, and owns a slim control bar, state presentation, keyboard operation, and announcements. The consuming application supplies the hub location, the stream identifier, an access token factory, and an optional caption track.

The requirements are in [L1](../../specs/L1.md) (`L1-020` to `L1-028`, with `L1-019` for theme tokens) and [L2](../../specs/L2.md) (`L2-057` to `L2-084`). These repository specifications are the source of truth. [ADR-0002](../../adr/frontend/0002-stream-live-video-as-fmp4-over-signalr-messagepack.md) records the transport decision. The [HTML mock](../../mocks/video-player/index.html) and its [guide](../../mocks/video-player/README.md) illustrate the states and controls without implementing streaming. The demonstration backend that produces the stream is designed in the [video stream backend subsystem](../video-stream-backend/).

## Description

Eleven vertical features cover the full L2 requirement set for the player:

| Feature | Capability |
|---------|------------|
| [Connect and subscribe](connect-and-subscribe/) | `L2-057`, `L2-058` |
| [Play the live stream](play-live-stream/) | `L2-059`, `L2-060` |
| [Control playback](control-playback/) | `L2-061`, `L2-062`, `L2-063`, `L2-064` |
| [Show status and controls](show-status-and-controls/) | `L2-065`, `L2-066` |
| [Recover from interruptions](recover-from-interruptions/) | `L2-067`, `L2-068` |
| [Operate by keyboard](operate-by-keyboard/) | `L2-069` |
| [Expose state to assistive technology](expose-to-assistive-tech/) | `L2-070`, `L2-071` |
| [Present the player accessibly](present-accessibly/) | `L2-072`, `L2-073`, `L2-074` |
| [Customize, localise, and publish the API](customize-and-localise/) | `L2-075`, `L2-076`, `L2-077` |
| [Secure and perform](secure-and-perform/) | `L2-078`, `L2-079`, `L2-080` |
| [Verify and document](verify-and-document/) | `L2-081`, `L2-082`, `L2-083`, `L2-084` |

The package runs entirely in the host application's browser. Bytes arrive through an injectable transport whose default implementation uses `@microsoft/signalr` with `@microsoft/signalr-protocol-msgpack`. Server-side rendering is not supported. iOS Safari's `ManagedMediaSource` is out of scope for v1; a browser without `MediaSource`, or without support for the stream's `mimeType`, shows the unsupported error.

The package has no secondary entry points. Its source layout follows `AGENTS.md`, mirrors `src/combobox/`, and uses Angular CLI and ng-packagr. The package depends on `@angular/cdk` for the component-harness base and on `@tessera/theme` for shared tokens.

The component keeps playback state in one component and delegates the stream, the media pipeline, and presentation timing to small internal collaborators.

| Building block | Responsibility |
|----------------|----------------|
| `VideoPlayer` | Standalone OnPush component; owns inputs, outputs, the `state` signal, the `<video>` reference, the control bar, keyboard handling, and the host `data-state` attribute |
| `VideoStreamSession` | Per-stream orchestrator; describes, checks codec support, subscribes, feeds chunks to the pipeline, owns the reconnect policy, the stall timers, and the 1 Hz statistics tick |
| `MediaSourcePipeline` | Owns the `MediaSource`, its object URL, the single `SourceBuffer`, the serialised append queue, initialisation rebuilds, pruning, and the seek to the live edge |
| `ReconnectPolicy` | The schedule 0, 2, 5, 10, 10 s with attempt counting and reset |
| `ControlsVisibility` | The 3000 ms hide timer and the rules that keep the control bar visible |
| `VideoPlayerAnnouncer` | Text queue for the instance-owned polite live region with 150 ms coalescing |
| `VideoStreamTransport`, `VIDEO_STREAM_TRANSPORT`, `SignalRVideoStreamTransport` | Public transport contract, its injection token, and the default SignalR implementation |
| `VIDEO_PLAYER_I18N` and `VideoPlayerStrings` | Partial string overrides merged by the component over English defaults |
| Public types | `VideoPlayerState`, `VideoPlayerError`, `VideoPlayerErrorCode`, `VideoPlayerStats`, `VideoPlayerCaptions`, `VideoStreamDescriptor`, and `VideoChunk` |
| `VideoPlayerHarness` | Root-exported consumer test API in `src/video-player/testing/` |

Signal state drives the Angular view. RxJS carries chunks from the transport into the pipeline and connection events into the session. `DestroyRef` releases the subscription, the hub connection, the media pipeline, and every listener and timer.

Public example usages live in `src/components-examples/tessera/video-player/`, a demonstration page in `src/dev-app/`, and the public API golden in `goldens/video-player/`.

These v1 decisions come from the requirements: the player is live only, with no seek bar and no playback-rate catch-up; pause holds the picture and resume jumps to the live edge; the subscription stays open while paused; captions are a host-supplied WebVTT track; elapsed time is wall clock from `startedAt`; a new initialisation chunk always rebuilds the `MediaSource`; the control bar is `role="group"` rather than `toolbar`; the LIVE badge doubles as the latency indicator and the go-to-live control; and each player instance owns one hub connection.

The feature pages describe the connection, pipeline, control, status, recovery, keyboard, assistive-technology, presentation, localisation, and lifecycle contracts. Automated evidence and manual verification records are produced during implementation and do not exist yet; the [verify and document](verify-and-document/) feature names where they will live.

## Requirements

Each feature page lists its L2 requirements with their exact source wording. This table maps every video player L2 requirement to its L1 parent and primary feature.

| L2 ID | Refines (L1) | Requirement |
|-------|--------------|-----------------|
| `L2-057` | `L1-022` | The player must connect to `hubUrl` with the MessagePack protocol when `streamId` is set and the component is in the document, invoke `Describe` and then `Subscribe`, and stop the hub connection when the component is destroyed or `streamId` is cleared. |
| `L2-058` | `L1-020` | The player must use the `Describe` result to name the player, size the stage, and start the elapsed-time display, and must verify `MediaSource.isTypeSupported(mimeType)` before subscribing. |
| `L2-059` | `L1-020` | The player must append the initialisation chunk to a fresh `SourceBuffer` before any media chunk, append media chunks in `seq` order one at a time, and rebuild the media pipeline whenever a new initialisation chunk arrives. |
| `L2-060` | `L1-020` | The player must start playback `targetLatencySeconds` behind the buffered end, keep the retained buffer within the buffer window, and jump to the live edge whenever playback falls more than `maxLatencySeconds` behind. |
| `L2-061` | `L1-021` | The player must toggle playback from the play/pause control, the stage, and the keyboard; pausing must hold the current frame; resuming must jump to the live edge. |
| `L2-062` | `L1-021` | The player must expose mute and volume controls bound to the `<video>` element, remember the pre-mute volume, and fall back to muted playback when the browser blocks audible autoplay. |
| `L2-063` | `L1-021` | The player must enter and exit fullscreen on the component host, not on the bare `<video>` element, so that its own controls remain available. |
| `L2-064` | `L1-021` | The player must render a host-supplied WebVTT track as a `<track kind="captions">` element and toggle it with a captions control. |
| `L2-065` | `L1-021` | The player must hide the control bar 3000 ms after the last pointer movement while playing, reveal it on pointer movement, key press, focus, or touch, and never hide it while a control has focus, the pointer is over it, or the player is not playing. |
| `L2-066` | `L1-021` | The player must be in exactly one of `idle`, `connecting`, `live`, `buffering`, `paused`, `reconnecting`, `ended`, or `error` at any time, drive its visible status from that state, and emit `stateChange` on every transition. |
| `L2-067` | `L1-022` | On transport loss the player must retry on the schedule 0, 2, 5, 10, 10 s, re-subscribe when the connection returns, and fail with code `connection` after the fifth failed attempt. |
| `L2-068` | `L1-022` | Every failure must be presented as a visible, focusable error panel with a plain-language message and, except for unsupported media, a Retry control, and must be emitted through the `error` output with a typed code. |
| `L2-069` | `L1-023` | Every control must be reachable with Tab in reading order, and the documented shortcuts must act when focus is anywhere inside the host except where the key already has a native meaning. |
| `L2-070` | `L1-024` | The player must own its ARIA pattern so that a consuming application cannot break it: a labelled region, a grouped control bar of native buttons and a native slider, pressed and disabled states on the controls, and an alert for errors. |
| `L2-071` | `L1-024` | The player must own one visually hidden polite live region per instance, present from first render, announce state milestones and control toggles through it, report failures through its alert, and never announce per-second changes. |
| `L2-072` | `L1-025` | The player's controls, states, motion, and forced-colors presentation must meet WCAG 2.2 AA regardless of the video content beneath them. |
| `L2-073` | `L1-025` | The player must fill its container at the descriptor's aspect ratio (16:9 by default), must not introduce horizontal page scrolling or lose functionality at 320, 576, 768, 992, 1200, and 1920 CSS px, at 400% browser zoom, with 200% text, and with WCAG text-spacing overrides, and must meet pointer target sizes. |
| `L2-074` | `L1-025` | Touch must reveal the controls before acting, and no function is permitted to require a gesture that has no button equivalent. |
| `L2-075` | `L1-026` | The player must ship as the standalone package `@tessera/video-player` with no secondary entry points, documented inputs, outputs, tokens, and types, and a public API golden. |
| `L2-076` | `L1-026` | Every user-visible string in the player must come from `VIDEO_PLAYER_I18N` with English defaults, and strings that embed numbers must be functions. |
| `L2-077` | `L1-019` | The player's colours, radius, and motion must resolve from `--t-video-player-*` overrides first, then from the shared `--t-*` semantic tokens of `@tessera/theme`, then from built-in defaults. |
| `L2-078` | `L1-027` | The player must render descriptor fields as text, never write HTML from data, never expose the access token, and document the host's Content Security Policy and transport obligations. |
| `L2-079` | `L1-027` | The player must show the first frame quickly, keep memory bounded, and avoid main-thread stalls while appending. |
| `L2-080` | `L1-027` | The player must use OnPush change detection, work under `provideZonelessChangeDetection()`, and release every resource it acquires when destroyed. |
| `L2-081` | `L1-028` | The package must ship `VideoPlayerHarness` under `src/video-player/testing/`, built on the CDK `ComponentHarness`, that operates the player through its public DOM only. |
| `L2-082` | `L1-028` | The player must be verified by Playwright in Chromium using page objects against an in-page fixture transport, with axe checks in every state, and the SignalR adapter must be unit-tested against a mocked hub connection. |
| `L2-083` | `L1-028` | Before release the player must pass a manual matrix with NVDA and Chrome, JAWS and Chrome, VoiceOver with Safari on macOS and iOS, TalkBack with Chrome on Android, and Narrator with Edge, recorded in `docs/verification/video-player-screen-reader-matrix.md`; unexecuted checks remain pending. |
| `L2-084` | `L1-028` | The player must ship with an adoption guide, example components, a dev-app page, and a definition of done. |

Shared requirements recur where two features enforce the same behavior. `L2-060` and `L2-061` share the seek to the live edge. `L2-062` and `L2-069` share volume changes by arrow key. `L2-065` and `L2-073` share the narrow-width placement of the control bar. `L2-068` and `L2-071` share the alert and the clearing of the polite region. `L2-070` and `L2-076` share control names.

## Diagrams

Each feature contains C4 context, container, and component views, a class diagram, and two behavioral sequence diagrams. Each diagram has a PlantUML source and an inline PNG sibling.

C4 diagrams use offline `<C4/...>` macros. The player is a frontend package, so sequence boxes distinguish the host Angular application, the `@tessera/video-player` package, and the browser's media APIs. A demo API box appears only where a diagram shows the transport reaching the hub.
