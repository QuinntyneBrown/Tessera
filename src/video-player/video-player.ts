import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  output,
  signal,
} from '@angular/core';
import { DEFAULT_VIDEO_PLAYER_STRINGS, VIDEO_PLAYER_I18N } from './i18n';
import { VideoPlayerState } from './types';

/** Live video player that plays a fragmented-MP4 stream delivered by a hub. */
@Component({
  selector: 't-video-player',
  templateUrl: './video-player.html',
  styleUrl: './video-player.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[attr.data-state]': 'state()' },
})
export class VideoPlayer {
  /** Emits the new state once per transition. */
  readonly stateChange = output<VideoPlayerState>();

  protected readonly strings = { ...DEFAULT_VIDEO_PLAYER_STRINGS, ...inject(VIDEO_PLAYER_I18N) };
  private readonly stateValue = signal<VideoPlayerState>('idle');
  /** Current playback state; mirrored to the host `data-state` attribute. */
  readonly state = this.stateValue.asReadonly();
  protected readonly regionName = computed(() => this.strings.regionLabel(null));
}
