import { Subscription } from 'rxjs';
import { VideoStreamTransport } from './video-stream-transport';
import {
  VideoPlayerErrorCode,
  VideoPlayerState,
  VideoStreamDescriptor,
  VideoStreamTransportOptions,
} from './types';

/** What a session needs from the component that hosts it. */
export interface VideoPlayerHost {
  setState(state: VideoPlayerState): void;
  applyDescriptor(descriptor: VideoStreamDescriptor): void;
  tick(): void;
  fail(code: VideoPlayerErrorCode, cause?: unknown): void;
}

/** Orchestrates one stream: describe, subscribe, and the 1 Hz tick. */
export class VideoStreamSession {
  private disposed = false;
  private subscription: Subscription | undefined;
  private readonly ticker = setInterval(() => this.host.tick(), 1000);

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
    this.subscription = this.transport.subscribe(this.streamId).subscribe();
  }

  private fail(code: VideoPlayerErrorCode, cause?: unknown): void {
    clearInterval(this.ticker);
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
