import { isDevMode } from '@angular/core';
import { VideoChunk } from './types';

/** Callbacks a pipeline raises to its session. */
export interface MediaSourcePipelineEvents {
  /** The first media fragment is buffered and the playhead sits near the live edge. */
  firstMedia(): void;
}

/** Owns one MediaSource, its object URL, one SourceBuffer and the serialised append queue. */
export class MediaSourcePipeline {
  private mediaSource: MediaSource | undefined;
  private objectUrl: string | undefined;
  private sourceBuffer: SourceBuffer | undefined;
  private readonly queue: VideoChunk[] = [];
  private initReceived = false;
  private mediaAppended = false;
  private seekedToLive = false;

  constructor(
    private readonly video: HTMLVideoElement,
    private readonly mimeType: string,
    private readonly events: MediaSourcePipelineEvents,
  ) {
    this.attach();
  }

  push(chunk: VideoChunk): void {
    if (chunk.kind === 0) this.initReceived = true;
    else if (!this.initReceived) {
      if (isDevMode())
        console.warn(
          't-video-player: discarded a media chunk received before the initialisation segment.',
        );
      return;
    }
    this.queue.push(chunk);
    this.appendNext();
  }

  private attach(): void {
    const mediaSource = new MediaSource();
    this.mediaSource = mediaSource;
    this.objectUrl = URL.createObjectURL(mediaSource);
    mediaSource.addEventListener('sourceopen', () => this.appendNext(), { once: true });
    this.video.src = this.objectUrl;
  }

  private appendNext(): void {
    if (this.mediaSource?.readyState !== 'open' || !this.queue.length) return;
    if (!this.sourceBuffer) {
      this.sourceBuffer = this.mediaSource.addSourceBuffer(this.mimeType);
      this.sourceBuffer.addEventListener('updateend', () => this.onUpdateEnd());
    }
    if (this.sourceBuffer.updating) return;
    const chunk = this.queue.shift()!;
    this.mediaAppended ||= chunk.kind === 1;
    this.sourceBuffer.appendBuffer(chunk.data as Uint8Array<ArrayBuffer>);
  }

  private onUpdateEnd(): void {
    const buffered = this.sourceBuffer!.buffered;
    if (this.mediaAppended && !this.seekedToLive && buffered.length) {
      this.seekedToLive = true;
      const last = buffered.length - 1;
      this.video.currentTime = Math.max(buffered.start(last), buffered.end(last) - 3);
      this.events.firstMedia();
    }
    this.appendNext();
  }
}
