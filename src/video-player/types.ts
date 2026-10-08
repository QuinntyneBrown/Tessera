/** The single state a video player is in at any moment. */
export type VideoPlayerState =
  'idle' | 'connecting' | 'live' | 'buffering' | 'paused' | 'reconnecting' | 'ended' | 'error';
