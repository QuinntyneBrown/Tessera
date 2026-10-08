# Video stream backend subsystem

## Overview

`Tessera.VideoStream.Demo` is a demonstration ASP.NET Core backend that turns a catalogued local MP4 file into a live fragmented-MP4 stream and serves it to `t-video-player` over a SignalR hub with the MessagePack protocol. It exists to prove the transport end to end, to give the dev app a real stream, and to show a host what its own streaming backend has to provide.

**Stream session** — running FFmpeg process plus the subscribers attached to it for one stream identifier

**Subscriber** — one hub connection that is receiving chunks for one stream

**Fragment** — one `moof` and `mdat` pair, about one second of media starting at a keyframe

**Initialisation segment** — `ftyp` and `moov` bytes that every subscriber needs before any fragment

**Catalogue** — configured map from a stream identifier to a media file and its presentation details

**Backpressure** — handling of a subscriber that reads more slowly than the stream is produced

The backend is a demonstration. Its authentication handler accepts one configured token and is meant to be replaced by the host's identity provider. It is an explicit exception to the angular/components repository layout and is proposed to live in `demo/video-stream-backend/`.

The requirements are in [L1](../../specs/L1.md) (`L1-029`) and [L2](../../specs/L2.md) (`L2-085` to `L2-094`). These repository specifications are the source of truth. [ADR-0002](../../adr/frontend/0002-stream-live-video-as-fmp4-over-signalr-messagepack.md) records the hub contract, the chunk envelope, and the streaming method shape. The consuming component is designed in the [video player subsystem](../video-player/).

## Description

Five vertical features cover the full L2 requirement set for the backend:

| Feature | Capability |
|---------|------------|
| [Resolve the stream catalogue](resolve-stream-catalogue/) | `L2-085` |
| [Transcode and fragment the source](transcode-and-fragment/) | `L2-086`, `L2-087` |
| [Serve the hub stream](serve-hub-stream/) | `L2-088`, `L2-092` |
| [Manage stream sessions](manage-stream-sessions/) | `L2-089`, `L2-090`, `L2-091` |
| [Test and operate the backend](test-and-operate-backend/) | `L2-093`, `L2-094` |

The solution `Tessera.VideoStream.sln` holds the web project `Tessera.VideoStream.Demo` and the xunit project `Tessera.VideoStream.Demo.Tests`. The .NET version is `<TO SUPPLY>`. FFmpeg is an external tool found on `PATH` or at `Ffmpeg:Path`; it is a prerequisite for streaming but not for the automated tests.

| Building block | Responsibility |
|----------------|----------------|
| `VideoStreamHub` | `[Authorize]` hub at `/hubs/video` exposing `Describe` and the streaming `Subscribe` |
| `StreamDescriptor` and `VideoChunk` | MessagePack contracts with integer keys matching ADR-0002 |
| `StreamCatalogue`, `StreamCatalogueEntry`, `StreamCatalogueOptions` | Configuration-bound catalogue validated at startup and looked up by identifier |
| `StreamIdValidator` | Identifier pattern check before any lookup |
| `IFragmentSource`, `FfmpegFragmentSource`, `FixtureFragmentSource` | Source of initialisation and fragment events, from FFmpeg in production and from a committed fixture in tests |
| `FfmpegProcess` | Starts, drains, watches, and kills the FFmpeg process |
| `Mp4FragmentReader` | Pure parser that turns a byte stream into initialisation segments and fragments |
| `LiveStreamSession` | Per-stream lifecycle, initialisation cache, fan-out, restart budget, idle stop, and subscriber sweep |
| `StreamSubscriber` | Bounded channel per subscriber with sequence and drop counters |
| `StreamSessionRegistry` | Map of stream identifier to session and the hosted service that stops everything on shutdown |
| `DemoTokenAuthenticationHandler` and `DemoTokenEndpoint` | Replaceable demonstration authentication and the token endpoint for the dev app |
| `FfmpegHealthCheck` | `/healthz` with FFmpeg availability and the active session count |

Configuration keys are `MediaRoot`, `Streams`, `Ffmpeg:Path`, `Demo:AccessToken`, `Cors:AllowedOrigins`, and `IdleStopSeconds`.

The backend never maps a client-supplied identifier to a filesystem path. It never sends FFmpeg output or error text to a client. It drops a slow subscriber's oldest fragments rather than slowing the others, and it evicts a subscriber that has not read for 60 s.

## Requirements

Each feature page lists its L2 requirements with their exact source wording. This table maps every backend L2 requirement to its L1 parent and primary feature.

| L2 ID | Refines (L1) | Requirement |
|-------|--------------|-----------------|
| `L2-085` | `L1-029` | The backend must resolve `streamId` through a configured catalogue and never through a filesystem path supplied by the client. |
| `L2-086` | `L1-029` | The backend must run FFmpeg to produce fragmented MP4 on standard output and split that output into an initialisation segment and keyframe-aligned fragments. |
| `L2-087` | `L1-029` | The backend must cache the current initialisation segment and deliver it before any media to every subscriber, including those that join after the session started. |
| `L2-088` | `L1-029` | The hub must expose `Describe` and `Subscribe` with the MessagePack protocol only and the message shapes recorded in ADR-0002. |
| `L2-089` | `L1-029` | The backend must start FFmpeg on the first subscriber, stop it after the last subscriber leaves plus a grace period, and stop every process on shutdown. |
| `L2-090` | `L1-029` | The backend must never let one slow subscriber delay the others, must drop that subscriber's oldest fragments first, and must evict a subscriber that stops draining. |
| `L2-091` | `L1-029` | The backend must restart a failed FFmpeg process within a bounded budget, report exhausted failures to subscribers, drain its standard error, and detect a missing or hung process. |
| `L2-092` | `L1-029` | The hub must require an access token through a replaceable authentication handler, accept the token on the hub path only, and restrict cross-origin access to configured origins. |
| `L2-093` | `L1-029` | The backend must have an xunit test project that runs without FFmpeg by replaying a committed fixture, plus one opt-in integration test for the real pipeline. |
| `L2-094` | `L1-029` | The demonstration backend must run with one command, expose a looping and a finite stream, report its health, and document how to point it at any local MP4 file. |

Shared requirements recur where two features enforce the same behavior. `L2-087` and `L2-091` share the initialisation-segment replacement after a restart. `L2-088` and `L2-090` share the stream completion and `HubException` semantics. `L2-091` and `L2-094` share the health report.

## Diagrams

Each feature contains C4 context, container, and component views, a class diagram, and two behavioral sequence diagrams. Each diagram has a PlantUML source and an inline PNG sibling.

C4 diagrams use offline `<C4/...>` macros. Sequence boxes distinguish the host browser application, the demo API (hub and authentication), the streaming classes, and infrastructure (the FFmpeg process and media files).
