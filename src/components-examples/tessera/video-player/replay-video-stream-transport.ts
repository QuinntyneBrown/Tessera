import { Observable, Subject } from 'rxjs';
import type {
  VideoChunk,
  VideoStreamDescriptor,
  VideoStreamTransport,
} from '@tessera/video-player';
import { replayFragmentedMp4 } from './replay-fragmented-mp4';

/**
 * A custom VideoStreamTransport that replays a fragmented MP4 file as a live stream, with no
 * server. Provide it through VIDEO_STREAM_TRANSPORT to replace the default SignalR transport.
 */
export class ReplayVideoStreamTransport implements VideoStreamTransport {
  readonly connectionEvents = new Subject<'reconnecting' | 'reconnected' | 'closed'>();
  private readonly startedAt = new Date().toISOString();

  constructor(
    private readonly url = '/lecture-10s.fmp4',
    private readonly title = 'Lecture hall A',
  ) {}

  async describe(streamId: string): Promise<VideoStreamDescriptor> {
    return {
      streamId,
      title: this.title,
      mimeType: 'video/mp4; codecs="avc1.4d401f,mp4a.40.2"',
      startedAt: this.startedAt,
      width: 1280,
      height: 720,
    };
  }

  subscribe(): Observable<VideoChunk> {
    return replayFragmentedMp4(this.url);
  }
}
