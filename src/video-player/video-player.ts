import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  linkedSignal,
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
  VideoPlayerStats,
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
  host: { '[attr.data-state]': 'state()', '(keydown)': 'onKeydown($event)' },
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
  /** Starts playback as soon as the first frame is buffered. */
  readonly autoplay = input(true);
  /** Mutes the video element; changing it never restarts the stream. */
  readonly muted = input(false);
  /** Volume from 0 to 100; changing it never restarts the stream. */
  readonly volume = input(100);
  /** Emits the new state once per transition. */
  readonly stateChange = output<VideoPlayerState>();
  /** Emits each failure once, with a typed code. */
  readonly error = output<VideoPlayerError>();
  /** Emits playback statistics once per second while the player is active. */
  readonly stats = output<VideoPlayerStats>();

  protected readonly strings = { ...DEFAULT_VIDEO_PLAYER_STRINGS, ...inject(VIDEO_PLAYER_I18N) };
  private readonly stateValue = signal<VideoPlayerState>('idle');
  /** Current playback state; mirrored to the host `data-state` attribute. */
  readonly state = this.stateValue.asReadonly();
  private readonly descriptor = signal<VideoStreamDescriptor | null>(null);
  private readonly now = signal(Date.now());
  protected readonly currentError = signal<VideoPlayerError | null>(null);
  private readonly latency = signal(0);
  protected readonly volumeValue = linkedSignal(() => clampVolume(this.volume()));
  private readonly isMuted = linkedSignal(() => this.muted());
  protected readonly mutePressed = computed(() => this.isMuted() || this.volumeValue() === 0);
  protected readonly unmuteChip = signal(false);
  private rememberedVolume = 100;
  protected readonly fullscreenSupported = document.fullscreenEnabled;
  protected readonly isFullscreen = signal(false);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  protected readonly playing = computed(() => ['live', 'buffering'].includes(this.state()));
  protected readonly playPauseDisabled = computed(
    () => !['live', 'buffering', 'paused'].includes(this.state()),
  );
  protected readonly behindLive = computed(() => this.latency() > 5);
  protected readonly liveName = computed(() =>
    this.behindLive() ? this.strings.goToLive(Math.round(this.latency())) : this.strings.live,
  );
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
  private readonly video = viewChild.required<ElementRef<HTMLVideoElement>>('video');
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
    effect(() => {
      const video = this.video().nativeElement;
      video.muted = this.isMuted();
      video.volume = this.volumeValue() / 100;
    });
    const onFullscreenChange = () => {
      const fullscreen = document.fullscreenElement === this.host;
      if (fullscreen === this.isFullscreen()) return;
      this.isFullscreen.set(fullscreen);
      this.announcer.toggle(fullscreen ? this.strings.fullscreenOn : this.strings.fullscreenOff);
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    inject(DestroyRef).onDestroy(() => {
      document.removeEventListener('fullscreenchange', onFullscreenChange);
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
    if (this.state() === 'error') return;
    const error: VideoPlayerError = { code, message: this.errorMessage(code), cause };
    this.announcer.clear();
    this.currentError.set(error);
    this.setState('error');
    this.error.emit(error);
  }

  private errorMessage(code: VideoPlayerErrorCode): string {
    const strings = this.strings;
    const messages: Record<VideoPlayerErrorCode, string> = {
      unsupported: strings.errorUnsupported(this.descriptor()?.mimeType ?? ''),
      unauthorized: strings.errorUnauthorized,
      'not-found': strings.errorNotFound,
      connection: strings.errorConnection,
      source: strings.errorSource,
      decode: strings.errorDecode,
      stalled: strings.errorStalled,
    };
    return messages[code];
  }

  protected onVideoError(): void {
    if (this.session) this.fail('decode', this.videoElement().error?.code);
  }

  videoElement(): HTMLVideoElement {
    return this.video().nativeElement;
  }

  requestPlay(): void {
    if (!this.autoplay()) return this.setState('paused');
    const video = this.videoElement();
    video.play().catch((cause) => {
      if (!isNotAllowed(cause)) return;
      this.isMuted.set(true);
      video.muted = true;
      video.play().then(
        () => this.unmuteChip.set(true),
        () => this.setState('paused'),
      );
    });
  }

  protected toggleMute(): void {
    if (this.mutePressed()) {
      if (this.volumeValue() === 0) this.volumeValue.set(this.rememberedVolume);
      this.isMuted.set(false);
      this.unmuteChip.set(false);
      this.announcer.toggle(this.strings.unmuted(this.volumeValue()));
    } else {
      this.isMuted.set(true);
      this.announcer.toggle(this.strings.muted);
    }
  }

  protected setVolume(value: number): void {
    const volume = clampVolume(value);
    this.volumeValue.set(volume);
    if (volume === 0) return;
    this.rememberedVolume = volume;
    this.isMuted.set(false);
  }

  protected toggleFullscreen(): void {
    if (this.isFullscreen()) document.exitFullscreen();
    else this.host.requestFullscreen();
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape' && this.isFullscreen()) {
      event.preventDefault();
      document.exitFullscreen();
    }
  }

  protected dismissUnmuteChip(): void {
    this.unmuteChip.set(false);
  }

  protected onPlaying(): void {
    if (this.state() !== 'connecting') return;
    this.setState('live');
    this.announcer.status(this.strings.liveAnnounced);
  }

  emitStats(stats: VideoPlayerStats): void {
    this.latency.set(stats.latencySeconds);
    this.stats.emit(stats);
  }

  fellBehind(seconds: number): void {
    this.announcer.status(this.strings.behindLive(seconds));
  }

  jumpedToLive(): void {
    this.latency.set(0);
    this.announcer.status(this.strings.backLive);
  }

  protected togglePlayback(): void {
    const video = this.videoElement();
    if (this.playing()) {
      video.pause();
      this.setState('paused');
      this.announcer.toggle(this.strings.paused);
    } else if (this.state() === 'paused') {
      this.session?.goToLive();
      video.play().then(
        () => {
          if (this.state() !== 'paused') return;
          this.latency.set(0);
          this.setState('live');
          this.announcer.toggle(this.strings.backLive);
        },
        () => undefined,
      );
    }
  }

  protected goToLive(): void {
    if (!this.behindLive()) return;
    this.session?.goToLive();
    this.latency.set(0);
  }

  tick(): void {
    this.now.set(Date.now());
  }
}

function clampVolume(value: number): number {
  return Math.min(100, Math.max(0, Math.round(value)));
}

function isNotAllowed(cause: unknown): boolean {
  return cause instanceof DOMException && cause.name === 'NotAllowedError';
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
