import { isDevMode } from '@angular/core';
import { VideoChunk } from './types';

/** Callbacks a pipeline raises to its session. */
export interface MediaSourcePipelineEvents {
  /** The first media fragment is buffered and the playhead sits near the live edge. */
  firstMedia(): void;
  /** Appending failed for good; the session reports it as a decode error. */
  failed(cause: unknown): void;
}

/** Owns one MediaSource, its object URL, one SourceBuffer and the serialised append queue. */
export class MediaSourcePipeline {
  private mediaSource: MediaSource | undefined;
  private objectUrl: string | undefined;
  private sourceBuffer: SourceBuffer | undefined;
  private queue: VideoChunk[] = [];
  private initReceived = false;
  private mediaAppended = false;
  private seekedToLive = false;
  private quotaRetry: VideoChunk | undefined;

  constructor(
    private readonly video: HTMLVideoElement,
    private readonly mimeType: string,
    private readonly events: MediaSourcePipelineEvents,
  ) {
    this.attach();
  }

  push(chunk: VideoChunk): void {
    if (chunk.kind === 0) {
      if (this.initReceived) this.rebuild();
      this.initReceived = true;
    } else if (!this.initReceived) {
      if (isDevMode())
        console.warn(
          't-video-player: discarded a media chunk received before the initialisation segment.',
        );
      return;
    }
    this.queue.push(chunk);
    this.appendNext();
  }

  /** Detaches the current MediaSource, revokes its URL and attaches a fresh one. */
  rebuild(): void {
    this.detach();
    this.queue = [];
    this.mediaAppended = false;
    this.seekedToLive = false;
    this.quotaRetry = undefined;
    this.attach();
  }

  private attach(): void {
    const mediaSource = new MediaSource();
    this.mediaSource = mediaSource;
    this.objectUrl = URL.createObjectURL(mediaSource);
    mediaSource.addEventListener('sourceopen', () => this.appendNext(), { once: true });
    this.video.src = this.objectUrl;
  }

  private detach(): void {
    this.sourceBuffer = undefined;
    this.mediaSource = undefined;
    if (this.objectUrl) URL.revokeObjectURL(this.objectUrl);
    this.objectUrl = undefined;
    this.video.removeAttribute('src');
  }

  private appendNext(): void {
    const mediaSource = this.mediaSource;
    if (mediaSource?.readyState !== 'open' || !this.queue.length) return;
    if (!this.sourceBuffer) {
      const sourceBuffer = mediaSource.addSourceBuffer(this.mimeType);
      sourceBuffer.addEventListener('updateend', () => {
        if (sourceBuffer === this.sourceBuffer) this.onUpdateEnd();
      });
      this.sourceBuffer = sourceBuffer;
    }
    if (this.sourceBuffer.updating) return;
    const chunk = this.queue.shift()!;
    try {
      this.sourceBuffer.appendBuffer(chunk.data as Uint8Array<ArrayBuffer>);
      this.mediaAppended ||= chunk.kind === 1;
      this.quotaRetry = undefined;
    } catch (cause) {
      this.onAppendError(chunk, cause);
    }
  }

  private onAppendError(chunk: VideoChunk, cause: unknown): void {
    const quota = cause instanceof DOMException && cause.name === 'QuotaExceededError';
    if (!quota || this.quotaRetry === chunk) return this.events.failed(cause);
    this.quotaRetry = chunk;
    this.queue.unshift(chunk);
    if (!this.prune()) this.appendNext();
  }

  /** Removes media more than 30 s behind the playhead; returns whether a removal started. */
  private prune(): boolean {
    const end = this.video.currentTime - 30;
    if (!this.sourceBuffer || end <= 0) return false;
    this.sourceBuffer.remove(0, end);
    return true;
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
