import { Subscription } from 'rxjs';
import { VideoStreamTransport } from './video-stream-transport';
import { MediaSourcePipeline } from './media-source-pipeline';
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

  constructor(
    private readonly transport: VideoStreamTransport,
    private readonly host: VideoPlayerHost,
    private readonly streamId: string,
    options: VideoStreamTransportOptions,
  ) {
    host.setState('connecting');
    transport.configure?.(options);
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
    this.subscription = this.transport.subscribe(this.streamId).subscribe((chunk) => {
      this.bytesReceived += chunk.data.byteLength;
      pipeline.push(chunk);
    });
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
    this.subscription?.unsubscribe();
    this.host.fail(code, cause);
  }

  stop(): void {
    this.disposed = true;
    clearInterval(this.ticker);
    this.subscription?.unsubscribe();
  }
}

function isSupported(mimeType: string): boolean {
  try {
    return typeof MediaSource !== 'undefined' && MediaSource.isTypeSupported(mimeType);
  } catch {
    return false;
  }
}

function failureCode(cause: unknown): VideoPlayerErrorCode {
  const message = cause instanceof Error ? cause.message : String(cause);
  return message.includes('unknown-stream') ? 'not-found' : 'connection';
}

function round(seconds: number): number {
  return Math.round(seconds * 10) / 10;
}
