import { Subscription } from 'rxjs';
import { VideoStreamTransport } from './video-stream-transport';
import { MediaSourcePipeline } from './media-source-pipeline';
import { ReconnectPolicy } from './reconnect-policy';
import {
  VideoPlayerErrorCode,
  VideoPlayerState,
  VideoPlayerStats,
  VideoStreamDescriptor,
  VideoStreamTransportOptions,
} from './types';

/** What a session needs from the component that hosts it. */
export interface VideoPlayerHost {
  setState(state: VideoPlayerState): void;
  applyDescriptor(descriptor: VideoStreamDescriptor): void;
  tick(): void;
  fail(code: VideoPlayerErrorCode, cause?: unknown): void;
  videoElement(): HTMLVideoElement;
  requestPlay(): void;
  state(): VideoPlayerState;
  emitStats(stats: VideoPlayerStats): void;
  fellBehind(seconds: number): void;
  jumpedToLive(): void;
  /** No chunk has arrived for 10 s (`true`), or chunks flow again (`false`). */
  sourceWaiting(waiting: boolean): void;
  connectionLost(): void;
  reconnectAttempt(attempt: number): void;
  reconnected(): void;
}

const ACTIVE_STATES = new Set<VideoPlayerState>([
  'connecting',
  'live',
  'buffering',
  'paused',
  'reconnecting',
]);

/** Orchestrates one stream: describe, subscribe, and the 1 Hz tick. */
export class VideoStreamSession {
  private disposed = false;
  private subscription: Subscription | undefined;
  private pipeline: MediaSourcePipeline | undefined;
  private readonly ticker = setInterval(() => this.tick(), 1000);
  private bytesReceived = 0;
  private ticksBehind = 0;
  private behindAnnounced = false;
  private stallTimers: ReturnType<typeof setTimeout>[] = [];
  private readonly policy = new ReconnectPolicy();
  private readonly connection: Subscription;
  private pausedBeforeLoss = false;

  constructor(
    private readonly transport: VideoStreamTransport,
    private readonly host: VideoPlayerHost,
    private readonly streamId: string,
    options: VideoStreamTransportOptions,
  ) {
    host.setState('connecting');
    transport.configure?.(options);
    this.connection = transport.connectionEvents.subscribe((event) => {
      if (event === 'reconnecting') this.onReconnecting();
      else if (event === 'reconnected') this.onReconnected();
      else if (host.state() === 'reconnecting') this.fail('connection');
    });
    this.start();
  }

  private async start(): Promise<void> {
    let descriptor: VideoStreamDescriptor;
    try {
      descriptor = await this.transport.describe(this.streamId);
    } catch (cause) {
      if (!this.disposed) this.fail(failureCode(cause), cause);
      return;
    }
    if (this.disposed) return;
    this.host.applyDescriptor(descriptor);
    if (!isSupported(descriptor.mimeType)) return this.fail('unsupported');
    const pipeline = new MediaSourcePipeline(this.host.videoElement(), descriptor.mimeType, {
      firstMedia: () => this.host.requestPlay(),
      failed: (cause) => this.fail('decode', cause),
    });
    this.pipeline = pipeline;
    this.subscribeChunks(pipeline);
  }

  private subscribeChunks(pipeline: MediaSourcePipeline): void {
    this.watchForStall();
    this.subscription = this.transport.subscribe(this.streamId).subscribe({
      next: (chunk) => {
        this.bytesReceived += chunk.data.byteLength;
        this.watchForStall();
        pipeline.push(chunk);
      },
      complete: () => {
        this.clearStallTimers();
        pipeline.endOfStream();
      },
      error: (cause) => this.fail(failureCode(cause, 'source'), cause),
    });
  }

  private onReconnecting(): void {
    if (this.disposed || this.host.state() === 'error') return;
    this.clearStallTimers();
    this.pausedBeforeLoss = this.host.state() === 'paused';
    this.host.setState('reconnecting');
    this.host.connectionLost();
    this.policy.start((attempt) => this.host.reconnectAttempt(attempt));
  }

  /** Server streams do not survive a reconnect: subscribe again on the same connection. */
  private onReconnected(): void {
    if (this.disposed || this.host.state() !== 'reconnecting') return;
    this.policy.reset();
    this.subscription?.unsubscribe();
    if (this.pausedBeforeLoss) this.host.setState('paused');
    this.host.reconnected();
    if (this.pipeline) this.subscribeChunks(this.pipeline);
  }

  /** Restarts the 10 s waiting and 30 s stalled timers; called for every received chunk. */
  private watchForStall(): void {
    this.clearStallTimers();
    this.host.sourceWaiting(false);
    this.stallTimers = [
      setTimeout(() => this.host.sourceWaiting(true), 10000),
      setTimeout(() => this.fail('stalled'), 30000),
    ];
  }

  private clearStallTimers(): void {
    this.stallTimers.forEach(clearTimeout);
    this.stallTimers = [];
  }

  /** Seeks to the live edge on the viewer's request. */
  goToLive(): void {
    this.pipeline?.seekToLive();
  }

  private tick(): void {
    this.host.tick();
    const state = this.host.state();
    if (!ACTIVE_STATES.has(state)) return;
    if (state === 'live') this.watchLiveEdge(this.pipeline?.latency() ?? 0);
    const video = this.host.videoElement();
    this.host.emitStats({
      state,
      latencySeconds: round(this.pipeline?.latency() ?? 0),
      bufferedAheadSeconds: round(this.pipeline?.bufferedAhead() ?? 0),
      bytesReceived: this.bytesReceived,
      droppedFrames: video.getVideoPlaybackQuality?.().droppedVideoFrames ?? 0,
    });
  }

  private watchLiveEdge(latency: number): void {
    if (latency <= 5) this.behindAnnounced = false;
    if (latency >= 10 && !this.behindAnnounced) {
      this.behindAnnounced = true;
      this.host.fellBehind(10);
    }
    this.ticksBehind = latency > 8 ? this.ticksBehind + 1 : 0;
    if (this.ticksBehind < 2) return;
    this.ticksBehind = 0;
    this.behindAnnounced = false;
    this.pipeline?.seekToLive();
    this.host.jumpedToLive();
  }

  private fail(code: VideoPlayerErrorCode, cause?: unknown): void {
    clearInterval(this.ticker);
    this.clearStallTimers();
    this.policy.reset();
    this.subscription?.unsubscribe();
    this.host.fail(code, cause);
  }

  /**
   * Releases everything this session holds. A stream switch keeps the hub connection
   * (`stopConnection` false); clearing the stream, a new hub URL, Retry and destroy stop it.
   */
  stop(stopConnection = true): void {
    this.disposed = true;
    clearInterval(this.ticker);
    this.clearStallTimers();
    this.policy.reset();
    this.connection.unsubscribe();
    this.subscription?.unsubscribe();
    this.pipeline?.dispose();
    if (stopConnection) this.transport.stop?.();
  }
}

function isSupported(mimeType: string): boolean {
  try {
    return typeof MediaSource !== 'undefined' && MediaSource.isTypeSupported(mimeType);
  } catch {
    return false;
  }
}

/** Maps a transport failure to its code; raw details stay in the error's cause. */
function failureCode(
  cause: unknown,
  fallback: VideoPlayerErrorCode = 'connection',
): VideoPlayerErrorCode {
  const status = (cause as { statusCode?: number } | null)?.statusCode;
  if (status === 401 || status === 403) return 'unauthorized';
  const message = cause instanceof Error ? cause.message : String(cause);
  if (message.includes('unknown-stream')) return 'not-found';
  if (message.includes('source-failed') || message.includes('slow-consumer')) return 'source';
  return fallback;
}

function round(seconds: number): number {
  return Math.round(seconds * 10) / 10;
}
