import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import { VideoChunk, VideoStreamDescriptor, VideoStreamTransportOptions } from './types';

/** Source of stream descriptors, chunks and connection events for one player. */
export interface VideoStreamTransport {
  describe(streamId: string): Promise<VideoStreamDescriptor>;
  subscribe(streamId: string): Observable<VideoChunk>;
  readonly connectionEvents: Observable<'reconnecting' | 'reconnected' | 'closed'>;
  /** Receives the hub location and token factory before the first `describe` of a connection. */
  configure?(options: VideoStreamTransportOptions): void;
  /** Releases the connection. */
  stop?(): void | Promise<void>;
}

/** Replaces the default SignalR transport for every player below the provider. */
export const VIDEO_STREAM_TRANSPORT = new InjectionToken<VideoStreamTransport>(
  'VIDEO_STREAM_TRANSPORT',
);
