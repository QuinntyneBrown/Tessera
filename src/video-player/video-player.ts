import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  afterEveryRender,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  linkedSignal,
  output,
  signal,
  untracked,
  viewChild,
  viewChildren,
} from '@angular/core';
import { DEFAULT_VIDEO_PLAYER_STRINGS, VIDEO_PLAYER_I18N, formatDuration } from './i18n';
import {
  VideoPlayerCaptions,
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
  host: {
    '[attr.data-state]': 'state()',
    '(keydown)': 'onKeydown($event)',
    '(focusin)': 'onFocusin($event)',
  },
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
  /** Host-supplied WebVTT captions; `null` or unset removes the track and the control. */
  readonly captions = input<VideoPlayerCaptions | null | undefined>(undefined);
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
  protected readonly waitingForSource = signal(false);
  protected readonly reconnectAttemptValue = signal(1);
  private resumingAfterReconnect = false;
  protected readonly liveDuration = signal('');
  protected readonly controlsDisabled = computed(() => this.state() === 'ended');
  private bufferingAnnouncement: ReturnType<typeof setTimeout> | undefined;
  protected readonly volumeValue = linkedSignal(() => clampVolume(this.volume()));
  private readonly isMuted = linkedSignal(() => this.muted());
  protected readonly mutePressed = computed(() => this.isMuted() || this.volumeValue() === 0);
  protected readonly unmuteChip = signal(false);
  private rememberedVolume = 100;
  protected readonly captionTracks = computed(() => {
    const captions = this.captions();
    return captions ? [captions] : [];
  });
  protected readonly captionsShowing = signal(false);
  private readonly trackElements = viewChildren<ElementRef<HTMLTrackElement>>('track');
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
  private readonly errorHeading = viewChild<ElementRef<HTMLElement>>('errorHeading');
  private readonly playPause = viewChild.required<ElementRef<HTMLElement>>('playPause');
  private readonly injector = inject(Injector);
  private readonly region = viewChild.required<ElementRef<HTMLElement>>('region');
  private readonly bar = viewChild.required<ElementRef<HTMLElement>>('bar');
  private readonly slider = viewChild.required<ElementRef<HTMLInputElement>>('slider');
  /** The control that last held focus and its position, for focus recovery. */
  private focusedControl: { element: HTMLElement; index: number; wasDisabled: boolean } | undefined;
  private readonly announcer = new VideoPlayerAnnouncer(() => this.liveRegion().nativeElement);
  private readonly transport = inject(VIDEO_STREAM_TRANSPORT, { optional: true });
  private session: VideoStreamSession | undefined;

  constructor() {
    effect(() => {
      this.hubUrl();
      this.streamId();
      this.accessTokenFactory();
      untracked(() => this.startSession());
    });
    effect(() => {
      const video = this.video().nativeElement;
      video.muted = this.isMuted();
      video.volume = this.volumeValue() / 100;
    });
    effect(() => {
      const mode = this.captionsShowing() ? 'showing' : 'hidden';
      for (const track of this.trackElements()) track.nativeElement.track.mode = mode;
    });
    const onFullscreenChange = () => {
      const fullscreen = document.fullscreenElement === this.host;
      if (fullscreen === this.isFullscreen()) return;
      this.isFullscreen.set(fullscreen);
      this.announcer.toggle(fullscreen ? this.strings.fullscreenOn : this.strings.fullscreenOff);
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    afterEveryRender({ write: () => this.recoverFocus() });
    inject(DestroyRef).onDestroy(() => {
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      clearTimeout(this.bufferingAnnouncement);
      this.session?.stop();
      this.announcer.destroy();
    });
  }

  private startSession(): void {
    this.session?.stop();
    const streamId = this.streamId();
    this.session =
      streamId && this.transport
        ? new VideoStreamSession(this.transport, this, streamId, {
            hubUrl: this.hubUrl(),
            accessTokenFactory: this.accessTokenFactory(),
          })
        : undefined;
  }

  /** Closes the error panel and starts a fresh connection. */
  retry(): void {
    if (this.state() !== 'error' || this.currentError()?.code === 'unsupported') return;
    this.currentError.set(null);
    this.startSession();
    this.afterRender(() => this.playPause().nativeElement.focus());
  }

  private afterRender(write: () => void): void {
    afterNextRender({ write }, { injector: this.injector });
  }

  connectionLost(): void {
    this.resumingAfterReconnect = false;
    this.announcer.status(this.strings.connectionLost);
  }

  reconnectAttempt(attempt: number): void {
    this.reconnectAttemptValue.set(attempt);
  }

  reconnected(): void {
    this.resumingAfterReconnect = true;
    this.announcer.status(this.strings.reconnected);
  }

  setState(state: VideoPlayerState): void {
    if (state === this.stateValue()) return;
    this.stateValue.set(state);
    this.stateChange.emit(state);
    clearTimeout(this.bufferingAnnouncement);
    if (state === 'buffering')
      this.bufferingAnnouncement = setTimeout(
        () => this.announcer.status(this.strings.buffering),
        1000,
      );
  }

  applyDescriptor(descriptor: VideoStreamDescriptor): void {
    this.descriptor.set(descriptor);
    this.now.set(Date.now());
    this.announcer.status(this.strings.connecting(this.title()!));
  }

  fail(code: VideoPlayerErrorCode, cause?: unknown): void {
    if (this.state() === 'error') return;
    const error: VideoPlayerError = { code, message: this.errorMessage(code), cause };
    if (this.host.contains(document.activeElement))
      this.afterRender(() => this.errorHeading()?.nativeElement.focus());
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
    if (this.state() === 'paused') return;
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
    if (this.controlsDisabled()) return;
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

  protected setVolume(value: number, slider?: HTMLInputElement): void {
    if (this.controlsDisabled()) {
      if (slider) slider.value = String(this.volumeValue());
      return;
    }
    const volume = clampVolume(value);
    this.volumeValue.set(volume);
    if (volume === 0) return;
    this.rememberedVolume = volume;
    this.isMuted.set(false);
  }

  protected toggleCaptions(): void {
    if (!this.captions() || this.controlsDisabled()) return;
    this.captionsShowing.update((showing) => !showing);
    this.announcer.toggle(
      this.captionsShowing() ? this.strings.captionsOn : this.strings.captionsOff,
    );
  }

  protected toggleFullscreen(): void {
    if (this.isFullscreen()) document.exitFullscreen();
    else this.host.requestFullscreen();
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (event.ctrlKey || event.altKey || event.metaKey) return;
    const onSlider = event.target === this.slider().nativeElement;
    const key = event.key === ' ' ? 'space' : event.key.toLowerCase();
    if ((key === 'space' || key === 'k') && !onSlider) this.togglePlayback();
    else if (key === 'm') this.toggleMute();
    else if (key === 'f' && this.fullscreenSupported) this.toggleFullscreen();
    else if (key === 'c' && this.captions()) this.toggleCaptions();
    else if ((key === 'arrowup' || key === 'arrowdown') && !onSlider)
      this.setVolume(this.volumeValue() + (key === 'arrowup' ? 5 : -5));
    else if (key === 'escape' && this.isFullscreen()) document.exitFullscreen();
    else return;
    event.preventDefault();
  }

  protected onFocusin(event: FocusEvent): void {
    const controls = this.controls();
    const index = controls.indexOf(event.target as HTMLElement);
    const element = controls[index];
    this.focusedControl =
      index < 0
        ? undefined
        : { element, index, wasDisabled: element.getAttribute('aria-disabled') === 'true' };
  }

  private controls(): HTMLElement[] {
    return Array.from(this.bar().nativeElement.querySelectorAll<HTMLElement>('button, input'));
  }

  /** Moves focus off a focused control that was removed or disabled, never to body. */
  private recoverFocus(): void {
    const focused = this.focusedControl;
    if (!focused) return;
    const active = document.activeElement;
    const removed = !focused.element.isConnected && (!active || active === document.body);
    const disabled =
      active === focused.element &&
      !focused.wasDisabled &&
      focused.element.getAttribute('aria-disabled') === 'true';
    if (!removed && !disabled) return;
    const controls = this.controls();
    const usable = (control: HTMLElement) =>
      control.getAttribute('aria-disabled') !== 'true' && control.checkVisibility();
    const start = Math.min(focused.index, controls.length) - 1;
    const candidates = [
      ...controls.slice(0, start + 1).reverse(),
      ...controls.slice(start + 1),
    ].filter((control) => control !== focused.element);
    (candidates.find(usable) ?? this.region().nativeElement).focus();
  }

  protected dismissUnmuteChip(): void {
    this.unmuteChip.set(false);
  }

  protected onPlaying(): void {
    const state = this.state();
    if (state === 'reconnecting' && !this.resumingAfterReconnect) return;
    if (state !== 'connecting' && state !== 'buffering' && state !== 'reconnecting') return;
    this.resumingAfterReconnect = false;
    this.setState('live');
    if (state === 'connecting') this.announcer.status(this.strings.liveAnnounced);
  }

  protected onWaiting(): void {
    if (this.state() === 'live') this.setState('buffering');
  }

  protected onEnded(): void {
    const startedAt = this.descriptor()?.startedAt;
    const duration = formatDuration(startedAt ? (Date.now() - Date.parse(startedAt)) / 1000 : 0);
    this.liveDuration.set(duration);
    this.setState('ended');
    this.announcer.status(this.strings.endedAfter(duration));
  }

  sourceWaiting(waiting: boolean): void {
    this.waitingForSource.set(waiting);
    if (waiting) this.onWaiting();
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
    if (!this.behindLive() || this.controlsDisabled()) return;
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
