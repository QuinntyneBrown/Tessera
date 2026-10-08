import { NEVER, Observable, Subject, concatMap, filter, from, map, take } from 'rxjs';
import { replayFragmentedMp4 } from '../../../../components-examples/tessera/video-player/replay-fragmented-mp4';
import {
  VideoChunk,
  VideoStreamDescriptor,
  VideoStreamTransport,
  VideoStreamTransportOptions,
} from '@tessera/video-player';

/** Test controls and observations shared by every fixture transport on the page. */
export interface VideoFixtureWindow {
  calls: string[];
  stalled: boolean;
  stall(): void;
  resume(): void;
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
    this.controls = window.__videoFixture ??= {
      calls: [],
      stalled: false,
      stall() {
        this.stalled = true;
      },
      resume() {
        this.stalled = false;
      },
    };
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
    if (this.scenario === 'connecting') return NEVER;
    const reinitAt = Number(this.parameters.get('reinitAt') || 0);
    const decodeAt = Number(this.parameters.get('decodeAt') || 0);
    const gapAt = Number(this.parameters.get('gapAt') || 0);
    let init: VideoChunk | undefined;
    let media = 0;
    return replayFragmentedMp4('/lecture-10s.fmp4', {
      rate: Number(this.parameters.get('rate') || 1),
      lead: Number(this.parameters.get('lead') || 0),
      stalled: () => this.controls.stalled,
    }).pipe(
      take(
        this.parameters.has('endAfter') ? Number(this.parameters.get('endAfter')) + 1 : Infinity,
      ),
      filter((chunk) => chunk.kind === 1 || this.parameters.get('skipInit') !== 'true'),
      filter((chunk) => chunk.kind === 0 || chunk.seq !== gapAt),
      map((chunk) => {
        if (chunk.kind === 0) init = chunk;
        else if (++media === decodeAt) return { ...chunk, data: corrupt(chunk.data) };
        return chunk;
      }),
      concatMap((chunk) =>
        from(chunk.kind === 1 && media === reinitAt && init ? [init, chunk] : [chunk]),
      ),
    );
  }
}

/** Keeps the moof header but destroys its contents, so the browser cannot parse the fragment. */
function corrupt(data: Uint8Array): Uint8Array {
  const copy = data.slice();
  copy.fill(0xff, 8, Math.min(copy.length, 512));
  return copy;
}
