# ADR-0002: Stream live video as fragmented MP4 chunks over SignalR with MessagePack

**Date:** 2026-10-07
**Category:** frontend
**Status:** Accepted
**Deciders:** Tessera maintainers

## Context

Tessera is adding `t-video-player`, a real-time video player for a Learning Management System. The host backend owns a live video source, runs it through FFmpeg, and pushes bytes to the browser over a SignalR hub using the MessagePack protocol. A demonstration .NET backend in this repository streams a local `.mp4` file the same way. The player is an MVP: live only, no seeking, slim controls.

Three questions had to be settled before the requirements (L2-057 to L2-094) could be written, because they decide what FFmpeg emits, what travels over the hub, and what the browser does with it:

1. How the browser turns a byte stream into pictures and sound.
2. Whether each hub message is a bare `byte[]` or a small typed envelope.
3. Whether the hub streams through `IAsyncEnumerable<T>` or `ChannelReader<T>`, and how a stream that ended is told apart from one that failed.

## Decision

1. **Media Source Extensions with fragmented MP4.** FFmpeg produces fMP4 (H.264 video, AAC audio, `-movflags frag_keyframe+empty_moov+default_base_moof`, one-second keyframe-aligned fragments). The player attaches a `MediaSource` to a native `<video>` with native controls hidden, calls `addSourceBuffer(mimeType)` once, appends the initialisation segment (`ftyp`+`moov`) first, then appends each media fragment (`moof`+`mdat`) in order. The backend parses FFmpeg's stdout into box-aligned fragments so that any fragment is a valid starting point, and caches the initialisation segment for subscribers that join late.

2. **A typed envelope, not raw bytes.** Each hub message is `VideoChunk { kind: 0 = init | 1 = media, seq: uint32, data: byte[] }` with integer MessagePack keys. A separate invocation `Describe(streamId)` returns `StreamDescriptor { streamId, title, mimeType, startedAt, width, height }` and is awaited before `Subscribe(streamId)`, so `MediaSource.isTypeSupported(mimeType)` runs before any bytes flow.

3. **`IAsyncEnumerable<VideoChunk>` with cancellation.** `Subscribe` is a server-to-client streaming hub method. The client disposing its subscription, or disconnecting, cancels the enumerator, which is the unsubscribe signal. The enumerable completing means the source ended normally; a `HubException` thrown from it (`source-failed: …`, `slow-consumer`) means it failed. `Describe` throws `HubException("unknown-stream")` for an unknown or malformed stream identifier. A transport loss is handled by SignalR automatic reconnect; server streams do not survive a reconnect, so the player re-subscribes, receives a fresh initialisation segment, and rebuilds its `MediaSource`.

## Options Considered

### Option 1: MSE with fragmented MP4 (chosen)
- **Pros:** Native `<video>` playback with hardware decoding, audio for free, native caption tracks (`<track>`), fullscreen and media-session integration, and the smallest player code. H.264/AAC in fMP4 is supported by every evergreen desktop browser and Android Chrome.
- **Cons:** Requires box-aligned fragments and an initialisation segment per subscription, so the backend must parse MP4 boxes. iOS Safari needs `ManagedMediaSource` and is out of scope for v1 (the player shows its unsupported state).

### Option 2: WebCodecs with a canvas
- **Pros:** Lowest achievable latency; the backend could send raw encoded access units without muxing.
- **Cons:** No native audio path (a separate `AudioDecoder` and `AudioContext` pipeline would be needed), no native captions, fullscreen and accessibility must be rebuilt around a `<canvas>`, and support is narrower. Far more code for an MVP.

### Option 3: MJPEG frames over the hub
- **Pros:** Trivial on both ends.
- **Cons:** No audio, very high bandwidth, no inter-frame compression, and no path to captions. Unsuitable for lecture video.

### Envelope: raw `byte[]` messages
- **Pros:** No type to define; one fewer MessagePack map per message.
- **Cons:** A late joiner, a reconnecting client, and a client whose source FFmpeg process restarted all receive an initialisation segment in the middle of a subscription. With raw bytes the client could only guess that "the first message is the init", which breaks on restart. Without a sequence number the client cannot tell a server-side drop (backpressure) from a stall and would wait for a gap that never fills instead of jumping to the live edge. The envelope costs about three bytes per 50–200 KB chunk.

### Envelope: metadata as the first stream item
- **Cons:** Heterogeneous item types are awkward in a C# `IAsyncEnumerable<T>`, and the codec support check would happen after bytes already flow.

### Streaming: `ChannelReader<VideoChunk>`
- **Pros:** Equally supported by SignalR.
- **Cons:** The "cached init first, then the subscriber's channel" sequence becomes a separate write into a channel the hub method hands back, instead of a `yield return` followed by `await foreach`. Cancellation still arrives as a token. It gains nothing over the enumerable.

## Consequences

### Positive
- The player is a thin layer over `<video>` + `MediaSource`; most behaviour the requirements describe (buffering, captions, fullscreen, volume) is native.
- The transport is a small interface (`describe`, `subscribe`, connection events), so end-to-end tests run against an in-page fixture transport that replays a committed fMP4 file, with no SignalR server.
- The backend's one non-trivial piece, the MP4 box parser, is a pure function of bytes and is unit-testable without FFmpeg.

### Negative
- Every reconnect and every FFmpeg restart rebuilds the `MediaSource`, which costs roughly half a second of black. This is accepted in v1 over `SourceBuffer.changeType()` and in-place appends, which have more edge cases.
- The SignalR WebSocket transport sends the access token as the `access_token` query parameter. Hosts must use TLS outside localhost and must not log query strings; the player's documentation says so.
- The host page needs a Content Security Policy that allows `media-src blob:` and `connect-src` for the hub origin.

### Risks
- Browsers differ in how much data a `SourceBuffer` may hold before `QuotaExceededError`. The player prunes with `SourceBuffer.remove()` and retries once; the buffer window defaults are in the L2 section.
- An FFmpeg restart on the server changes the `moov`. The backend must replace its cached initialisation segment and resend it to every subscriber before further media, otherwise decoding fails silently.

## Implementation Notes

- Backend FFmpeg arguments, the box parser contract, backpressure policy (bounded channel of 30 fragments, drop oldest; evict a subscriber that has not drained for 60 seconds), and session lifecycle are specified in L2-085 to L2-094.
- Client defaults (target latency 3 s, jump when more than 8 s behind, 30 s buffer window, reconnect schedule 0, 2, 5, 10, 10 s) are listed in the L2 section preamble.
- The HTML mock in `docs/mocks/video-player/` models the player's states and controls with a generated canvas stream; it contains no SignalR, MessagePack, or MSE code.

## References

- [Video player requirements, L2-057 to L2-094](../../specs/L2.md)
- [Media Source Extensions](https://www.w3.org/TR/media-source-2/)
- [ASP.NET Core SignalR streaming](https://learn.microsoft.com/aspnet/core/signalr/streaming)
- [ASP.NET Core SignalR MessagePack protocol](https://learn.microsoft.com/aspnet/core/signalr/messagepackhubprotocol)
- [FFmpeg MP4 muxer, `movflags`](https://ffmpeg.org/ffmpeg-formats.html#mov_002c-mp4_002c-ismv)
