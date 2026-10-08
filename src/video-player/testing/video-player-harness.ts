import { ComponentHarness } from '@angular/cdk/testing';
import { VideoPlayerState } from '../types';

/**
 * Consumer test API for `t-video-player`. It uses only the documented public DOM: the host's
 * `data-state`, the controls' `data-control` attributes, `aria-pressed` and `aria-disabled`, the
 * `t-video-player__status` text and the `role="alert"` error panel, so it works with any
 * VIDEO_PLAYER_I18N override.
 */
export class VideoPlayerHarness extends ComponentHarness {
  static hostSelector = 't-video-player';
  private readonly playPause = this.locatorFor('[data-control="play-pause"]');
  private readonly mute = this.locatorFor('[data-control="mute"]');
  private readonly volume = this.locatorFor('[data-control="volume"]');
  private readonly live = this.locatorFor('[data-control="live"]');
  private readonly captions = this.locatorFor('[data-control="captions"]');
  private readonly status = this.locatorForOptional('.t-video-player__status');
  private readonly errorHeading = this.locatorForOptional('[role="alert"] h2');
  private readonly retryButton = this.locatorFor('[role="alert"] button');

  async getState(): Promise<VideoPlayerState> {
    return (await (await this.host()).getAttribute('data-state')) as VideoPlayerState;
  }

  /** Activates Play when the player is paused. */
  async play(): Promise<void> {
    if ((await this.getState()) === 'paused') await (await this.playPause()).click();
  }

  /** Activates Pause when the player is live or buffering. */
  async pause(): Promise<void> {
    if (['live', 'buffering'].includes(await this.getState()))
      await (await this.playPause()).click();
  }

  async toggleMute(): Promise<void> {
    await (await this.mute()).click();
  }

  async isMuted(): Promise<boolean> {
    return (await (await this.mute()).getAttribute('aria-pressed')) === 'true';
  }

  /** Sets the volume slider (0 to 100) the way a viewer's input would. */
  async setVolume(volume: number): Promise<void> {
    const slider = await this.volume();
    await slider.setInputValue(String(volume));
    await slider.dispatchEvent('input');
  }

  async getVolume(): Promise<number> {
    return Number(await (await this.volume()).getProperty<string>('value'));
  }

  async toggleCaptions(): Promise<void> {
    await (await this.captions()).click();
  }

  async areCaptionsShowing(): Promise<boolean> {
    return (await (await this.captions()).getAttribute('aria-pressed')) === 'true';
  }

  /** Whether playback is at the live edge, as the LIVE badge reports. */
  async isLive(): Promise<boolean> {
    return (await (await this.live()).getAttribute('aria-disabled')) === 'true';
  }

  /** Activates the LIVE badge when playback is behind the live edge. */
  async goToLive(): Promise<void> {
    if (!(await this.isLive())) await (await this.live()).click();
  }

  async getStatusText(): Promise<string> {
    return (await (await this.status())?.text())?.trim() ?? '';
  }

  async getErrorMessage(): Promise<string | null> {
    return (await (await this.errorHeading())?.text())?.trim() ?? null;
  }

  async retry(): Promise<void> {
    await (await this.retryButton()).click();
  }
}
