import { NEVER, Observable, Subject } from 'rxjs';
import {
  VideoChunk,
  VideoStreamDescriptor,
  VideoStreamTransport,
  VideoStreamTransportOptions,
} from '@tessera/video-player';

/** Test controls and observations shared by every fixture transport on the page. */
export interface VideoFixtureWindow {
  calls: string[];
}

declare global {
  interface Window {
    __videoFixture: VideoFixtureWindow;
  }
}

/** Scenario-driven transport for the acceptance suite; it never touches a network. */
export class FixtureVideoStreamTransport implements VideoStreamTransport {
  readonly connectionEvents = new Subject<'reconnecting' | 'reconnected' | 'closed'>();
  private readonly controls: VideoFixtureWindow;

  constructor(private readonly parameters: URLSearchParams) {
    this.controls = window.__videoFixture ??= { calls: [] };
  }

  private get scenario(): string {
    return this.parameters.get('scenario') || 'live';
  }

  configure(_options: VideoStreamTransportOptions): void {
    this.controls.calls.push('configure');
  }

  describe(streamId: string): Promise<VideoStreamDescriptor> {
    this.controls.calls.push('describe');
    if (this.scenario === 'describe-pending') return new Promise(() => undefined);
    if (this.scenario === 'not-found') return Promise.reject(new Error('unknown-stream'));
    const number = (name: string, fallback: number) =>
      this.parameters.has(name) ? Number(this.parameters.get(name)) : fallback;
    return Promise.resolve({
      streamId,
      title: 'Lecture hall A',
      mimeType:
        this.scenario === 'unsupported'
          ? 'video/unknown'
          : 'video/mp4; codecs="avc1.4d401f,mp4a.40.2"',
      startedAt: new Date(Date.now() - number('startedAgo', 60) * 1000).toISOString(),
      width: number('width', 1280),
      height: number('height', 720),
    });
  }

  subscribe(_streamId: string): Observable<VideoChunk> {
    this.controls.calls.push('subscribe');
    return NEVER;
  }
}
