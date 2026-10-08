/** The single state a video player is in at any moment. */
export type VideoPlayerState =
  'idle' | 'connecting' | 'live' | 'buffering' | 'paused' | 'reconnecting' | 'ended' | 'error';

/** Stream metadata returned by the hub's `Describe` method. Every field is untrusted text. */
export interface VideoStreamDescriptor {
  streamId: string;
  title: string;
  mimeType: string;
  /** ISO-8601 time at which the live stream started. */
  startedAt: string;
  width: number;
  height: number;
}

/** One hub message: the initialisation segment (`kind` 0) or one media fragment (`kind` 1). */
export interface VideoChunk {
  kind: 0 | 1;
  seq: number;
  data: Uint8Array;
}

/** Connection settings a transport may receive before the first `describe`. */
export interface VideoStreamTransportOptions {
  hubUrl: string | null;
  accessTokenFactory?: () => string | Promise<string>;
}

/** Classifies a failure shown in the error panel and emitted through `error`. */
export type VideoPlayerErrorCode =
  'unsupported' | 'unauthorized' | 'not-found' | 'connection' | 'source' | 'decode' | 'stalled';

/** A failure as emitted by the `error` output. `cause` carries raw details, never the token. */
export interface VideoPlayerError {
  code: VideoPlayerErrorCode;
  message: string;
  cause?: unknown;
}
