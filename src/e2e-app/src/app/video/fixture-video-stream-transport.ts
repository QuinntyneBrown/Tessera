import {
  NEVER,
  Observable,
  Subject,
  concatMap,
  filter,
  from,
  map,
  merge,
  mergeMap,
  take,
  throwError,
} from 'rxjs';
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
  tokenRequests: number;
  stalled: boolean;
  transports: FixtureVideoStreamTransport[];
  stall(): void;
  resume(): void;
  /** Reports a transport loss; without restore() the connection closes after 27.1 s. */
  drop(): void;
  restore(): void;
  /** Fails every open subscription the way a HubException from the source would. */
  fail(): void;
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
  private options: VideoStreamTransportOptions | undefined;
  private dropped = false;
  private closeTimer: ReturnType<typeof setTimeout> | undefined;
  private readonly failures = new Subject<void>();

  constructor(private readonly parameters: URLSearchParams) {
    this.controls = window.__videoFixture ??= {
      calls: [],
      tokenRequests: 0,
      stalled: false,
      transports: [],
      stall() {
        this.stalled = true;
      },
      resume() {
        this.stalled = false;
      },
      drop() {
        this.transports.forEach((transport) => transport.drop());
      },
      restore() {
        this.transports.forEach((transport) => transport.restore());
      },
      fail() {
        this.transports.forEach((transport) => transport.failures.next());
      },
    };
    this.controls.transports.push(this);
  }

  private get scenario(): string {
    return this.parameters.get('scenario') || 'live';
  }

  configure(options: VideoStreamTransportOptions): void {
    this.controls.calls.push('configure');
    this.options = options;
  }

  private drop(): void {
    this.dropped = true;
    this.connectionEvents.next('reconnecting');
    this.closeTimer = setTimeout(() => this.connectionEvents.next('closed'), 27100);
  }

  private restore(): void {
    clearTimeout(this.closeTimer);
    this.dropped = false;
    this.connectionEvents.next('reconnected');
  }

  async describe(streamId: string): Promise<VideoStreamDescriptor> {
    this.controls.calls.push('describe');
    // Like a hub connection, starting asks the token factory for a token and never keeps it.
    if (this.options?.accessTokenFactory) {
      await this.options.accessTokenFactory();
      this.controls.tokenRequests++;
    }
    if (this.scenario === 'describe-pending') return new Promise(() => undefined);
    if (this.scenario === 'not-found') throw new Error('unknown-stream');
    if (this.scenario === 'unauthorized')
      throw Object.assign(new Error('Unauthorized'), { statusCode: 401 });
    const number = (name: string, fallback: number) =>
      this.parameters.has(name) ? Number(this.parameters.get(name)) : fallback;
    return {
      streamId,
      title: 'Lecture hall A',
      mimeType:
        this.scenario === 'unsupported'
          ? 'video/unknown'
          : 'video/mp4; codecs="avc1.4d401f,mp4a.40.2"',
      startedAt: new Date(Date.now() - number('startedAgo', 60) * 1000).toISOString(),
      width: number('width', 1280),
      height: number('height', 720),
    };
  }

  subscribe(_streamId: string): Observable<VideoChunk> {
    this.controls.calls.push('subscribe');
    if (this.scenario === 'connecting') return NEVER;
    const reinitAt = Number(this.parameters.get('reinitAt') || 0);
    const decodeAt = Number(this.parameters.get('decodeAt') || 0);
    const gapAt = Number(this.parameters.get('gapAt') || 0);
    let init: VideoChunk | undefined;
    let media = 0;
    const failure = this.failures.pipe(
      mergeMap(() => throwError(() => new Error('source-failed: encoder exited'))),
    );
    const replay = replayFragmentedMp4('/lecture-10s.fmp4', {
      rate: Number(this.parameters.get('rate') || 1),
      lead: Number(this.parameters.get('lead') || 0),
      stalled: () => this.controls.stalled || this.dropped,
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
    return merge(replay, failure);
  }
}

/** Keeps the moof header but destroys its contents, so the browser cannot parse the fragment. */
function corrupt(data: Uint8Array): Uint8Array {
  const copy = data.slice();
  copy.fill(0xff, 8, Math.min(copy.length, 512));
  return copy;
}
