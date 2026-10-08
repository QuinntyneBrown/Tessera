import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { DEFAULT_VIDEO_PLAYER_STRINGS, VIDEO_PLAYER_I18N } from './i18n';
import {
  VideoPlayerError,
  VideoPlayerErrorCode,
  VideoPlayerState,
  VideoStreamDescriptor,
} from './types';
import { VIDEO_STREAM_TRANSPORT } from './video-stream-transport';
import { VideoPlayerHost, VideoStreamSession } from './video-stream-session';
import { VideoPlayerAnnouncer } from './video-player-announcer';

/** Live video player that plays a fragmented-MP4 stream delivered by a hub. */
@Component({
  selector: 't-video-player',
  templateUrl: './video-player.html',
  styleUrl: './video-player.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[attr.data-state]': 'state()' },
})
export class VideoPlayer implements VideoPlayerHost {
  /** Hub endpoint passed unchanged to the transport. */
  readonly hubUrl = input<string | null>(null);
  /** Stream to describe and subscribe to; `null` releases the stream. */
  readonly streamId = input<string | null>(null);
  /** Supplies the access token to the transport only. */
  readonly accessTokenFactory = input<(() => string | Promise<string>) | undefined>(undefined);
  /** Replaces the descriptor title in the region name and announcements. */
  readonly titleOverride = input<string | undefined>(undefined);
  /** Emits the new state once per transition. */
  readonly stateChange = output<VideoPlayerState>();
  /** Emits each failure once, with a typed code. */
  readonly error = output<VideoPlayerError>();

  protected readonly strings = { ...DEFAULT_VIDEO_PLAYER_STRINGS, ...inject(VIDEO_PLAYER_I18N) };
  private readonly stateValue = signal<VideoPlayerState>('idle');
  /** Current playback state; mirrored to the host `data-state` attribute. */
  readonly state = this.stateValue.asReadonly();
  private readonly descriptor = signal<VideoStreamDescriptor | null>(null);
  private readonly now = signal(Date.now());
  protected readonly currentError = signal<VideoPlayerError | null>(null);
  protected readonly title = computed(
    () => this.titleOverride() ?? this.descriptor()?.title ?? null,
  );
  protected readonly regionName = computed(() => this.strings.regionLabel(this.title()));
  protected readonly aspectRatio = computed(() => {
    const descriptor = this.descriptor();
    return descriptor && descriptor.width > 0 && descriptor.height > 0
      ? `${descriptor.width} / ${descriptor.height}`
      : '16 / 9';
  });
  protected readonly elapsed = computed(() => {
    const startedAt = this.descriptor()?.startedAt;
    return startedAt ? formatClock((this.now() - Date.parse(startedAt)) / 1000) : '';
  });

  private readonly liveRegion = viewChild.required<ElementRef<HTMLElement>>('liveRegion');
  private readonly announcer = new VideoPlayerAnnouncer(() => this.liveRegion().nativeElement);
  private readonly transport = inject(VIDEO_STREAM_TRANSPORT, { optional: true });
  private session: VideoStreamSession | undefined;

  constructor() {
    effect(() => {
      const hubUrl = this.hubUrl();
      const streamId = this.streamId();
      const accessTokenFactory = this.accessTokenFactory();
      untracked(() => {
        this.session?.stop();
        this.session =
          streamId && this.transport
            ? new VideoStreamSession(this.transport, this, streamId, {
                hubUrl,
                accessTokenFactory,
              })
            : undefined;
      });
    });
    inject(DestroyRef).onDestroy(() => {
      this.session?.stop();
      this.announcer.destroy();
    });
  }

  setState(state: VideoPlayerState): void {
    if (state === this.stateValue()) return;
    this.stateValue.set(state);
    this.stateChange.emit(state);
  }

  applyDescriptor(descriptor: VideoStreamDescriptor): void {
    this.descriptor.set(descriptor);
    this.now.set(Date.now());
    this.announcer.status(this.strings.connecting(this.title()!));
  }

  fail(code: VideoPlayerErrorCode, cause?: unknown): void {
    const error: VideoPlayerError = { code, message: this.errorMessage(code), cause };
    this.announcer.clear();
    this.currentError.set(error);
    this.setState('error');
    this.error.emit(error);
  }

  private errorMessage(code: VideoPlayerErrorCode): string {
    switch (code) {
      case 'unsupported':
        return this.strings.errorUnsupported(this.descriptor()?.mimeType ?? '');
      default:
        return this.strings.errorNotFound;
    }
  }

  tick(): void {
    this.now.set(Date.now());
  }
}

function formatClock(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const pad = (value: number) => String(value).padStart(2, '0');
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return hours
    ? `${hours}:${pad(minutes)}:${pad(seconds % 60)}`
    : `${minutes}:${pad(seconds % 60)}`;
}
