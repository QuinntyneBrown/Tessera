import { Subscription } from 'rxjs';
import { VideoStreamTransport } from './video-stream-transport';
import { VideoPlayerState, VideoStreamDescriptor, VideoStreamTransportOptions } from './types';

/** What a session needs from the component that hosts it. */
export interface VideoPlayerHost {
  setState(state: VideoPlayerState): void;
  applyDescriptor(descriptor: VideoStreamDescriptor): void;
  tick(): void;
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
    const descriptor = await this.transport.describe(this.streamId);
    if (this.disposed) return;
    this.host.applyDescriptor(descriptor);
    this.subscription = this.transport.subscribe(this.streamId).subscribe();
  }

  stop(): void {
    this.disposed = true;
    clearInterval(this.ticker);
    this.subscription?.unsubscribe();
  }
}
