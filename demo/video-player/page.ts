import { expect as baseExpect, Locator, Page } from '@playwright/test';

// Real media decoding is slow while the video is also being recorded.
const expect = baseExpect.configure({ timeout: 20_000 });

export type Example = 'basic' | 'custom-transport' | 'captions' | 'i18n' | 'themed';
type Control = 'play-pause' | 'mute' | 'volume' | 'live' | 'captions';

/** Console errors the hub example produces by design when no hub is listening. */
const EXPECTED_HUB_ERRORS = [
  /ERR_CONNECTION_REFUSED/,
  /Failed to complete negotiation with the server/,
  /Failed to start the connection/,
];

/**
 * Selectors, user actions and observable outcomes for the shared video player examples and the
 * acceptance screen. The story states intent; this object knows the DOM.
 */
export class VideoPlayerDemoPage {
  private readonly errors: string[] = [];

  constructor(private readonly page: Page) {
    page.on('pageerror', (error) => this.errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') this.errors.push(message.text());
    });
  }

  private player(example?: Example): Locator {
    return example
      ? this.page.locator(`tsr-video-player-${example}-example t-video-player`)
      : this.page.locator('t-video-player').first();
  }

  private control(control: Control, example?: Example): Locator {
    return this.player(example).locator(`[data-control="${control}"]`);
  }

  private announcer(example?: Example): Locator {
    return this.player(example).locator('[aria-live="polite"]');
  }

  async openExamples(): Promise<void> {
    await this.page.goto('/?screen=video-player-examples');
    await expect(
      this.page.getByRole('heading', { name: 'Video player examples', exact: true }),
    ).toBeVisible();
    await expect(this.page.locator('t-video-player')).toHaveCount(5);
  }

  /** Scrolls an example's section to the middle of the viewport. */
  async show(example: Example): Promise<void> {
    await this.player(example).evaluate((node) =>
      node.closest('section')!.scrollIntoView({ block: 'center', behavior: 'smooth' }),
    );
    await this.page.waitForTimeout(700);
  }

  async showTop(): Promise<void> {
    await this.page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
    await this.page.waitForTimeout(700);
  }

  /** Rests the pointer on the control bar, which keeps it visible while live. */
  async hoverControls(example?: Example): Promise<void> {
    const box = (await this.player(example).locator('.t-video-player__bar').boundingBox())!;
    await this.page.mouse.move(box.x + box.width * 0.6, box.y + box.height / 2, { steps: 12 });
  }

  async click(control: Control, example?: Example): Promise<void> {
    await this.control(control, example).click();
  }

  /** Clicks the volume slider part-way along its track. */
  async clickVolumeAt(fraction: number, example?: Example): Promise<void> {
    const box = (await this.control('volume', example).boundingBox())!;
    await this.page.mouse.click(box.x + box.width * fraction, box.y + box.height / 2);
  }

  async press(key: string): Promise<void> {
    await this.page.keyboard.press(key);
    await this.page.waitForTimeout(450);
  }

  /** Clicks a section heading, then Tabs: the next focusable element is that player's first control. */
  async tabIntoPlayerAfter(heading: string): Promise<void> {
    await this.page.getByRole('heading', { name: heading, exact: true }).click();
    await this.press('Tab');
  }

  /** Moves the pointer away and clicks empty page space, as a viewer stepping away would. */
  async stepAway(): Promise<void> {
    await this.page.mouse.move(80, 360, { steps: 12 });
    await this.page.mouse.click(80, 360);
  }

  async expectState(state: string, example?: Example): Promise<void> {
    await expect(this.player(example)).toHaveAttribute('data-state', state);
  }

  async expectRegion(name: string, example?: Example): Promise<void> {
    await expect(this.player(example).getByRole('region', { name, exact: true })).toBeVisible();
  }

  async expectLiveBadge(name: string | RegExp, example?: Example): Promise<void> {
    await expect(this.control('live', example)).toBeVisible();
    await expect(this.control('live', example)).toHaveAttribute('aria-label', name);
  }

  async expectLiveBadgeText(text: string, example?: Example): Promise<void> {
    await expect(this.control('live', example)).toHaveText(text);
  }

  async expectElapsedRunning(example?: Example): Promise<void> {
    const elapsed = this.player(example).locator('.t-video-player__elapsed');
    await expect(elapsed).toHaveText(/^\d+:\d\d$/);
    const first = await elapsed.textContent();
    await expect(elapsed).not.toHaveText(first!);
  }

  async expectPauseShowsPlayButton(example?: Example): Promise<void> {
    await expect(this.control('play-pause', example)).toHaveAttribute('aria-label', 'Play');
    await expect(this.player(example).locator('.t-video-player__central-play')).toBeVisible();
  }

  /** Seconds between the newest buffered media and the playhead. */
  private latency(example?: Example): Promise<number> {
    return this.player(example)
      .locator('video')
      .evaluate((video: HTMLVideoElement) =>
        video.buffered.length
          ? video.buffered.end(video.buffered.length - 1) - video.currentTime
          : Infinity,
      );
  }

  async expectNearLiveEdge(example?: Example): Promise<void> {
    await expect.poll(() => this.latency(example)).toBeLessThan(5);
  }

  async expectPlaying(example?: Example): Promise<void> {
    const video = this.player(example).locator('video');
    await expect
      .poll(() => video.evaluate((node: HTMLVideoElement) => !node.paused && node.readyState >= 2))
      .toBe(true);
    const before = await video.evaluate((node: HTMLVideoElement) => node.currentTime);
    await expect
      .poll(() => video.evaluate((node: HTMLVideoElement) => node.currentTime))
      .toBeGreaterThan(before + 0.3);
  }

  async expectAnnouncement(text: string, example?: Example): Promise<void> {
    await expect(this.announcer(example)).toHaveText(text);
  }

  async expectMuted(muted: boolean, example?: Example): Promise<void> {
    await expect(this.control('mute', example)).toHaveAttribute('aria-pressed', String(muted));
    await expect(this.control('mute', example)).toHaveAttribute(
      'aria-label',
      muted ? 'Unmute' : 'Mute',
    );
    await expect
      .poll(() =>
        this.player(example)
          .locator('video')
          .evaluate((node: HTMLVideoElement) => node.muted),
      )
      .toBe(muted);
  }

  async expectVolume(volume: number | 'lowered', example?: Example): Promise<number> {
    const slider = this.control('volume', example);
    if (volume === 'lowered')
      await expect.poll(async () => Number(await slider.inputValue())).toBeLessThan(100);
    else await expect(slider).toHaveValue(String(volume));
    const value = Number(await slider.inputValue());
    await expect(slider).toHaveAttribute('aria-valuetext', `${value}%`);
    await expect
      .poll(() =>
        this.player(example)
          .locator('video')
          .evaluate((node: HTMLVideoElement) => Math.round(node.volume * 100)),
      )
      .toBe(value);
    return value;
  }

  async expectFocused(control: Control, example?: Example): Promise<void> {
    await expect(this.control(control, example)).toBeFocused();
    expect(
      await this.control(control, example).evaluate((node) => node.matches(':focus-visible')),
    ).toBe(true);
  }

  async expectCaptions(showing: boolean, example?: Example): Promise<void> {
    await expect(this.control('captions', example)).toHaveAttribute(
      'aria-pressed',
      String(showing),
    );
    await expect
      .poll(() =>
        this.player(example)
          .locator('video')
          .evaluate((node: HTMLVideoElement) => {
            const track = node.textTracks[0];
            return `${track.mode}:${track.activeCues?.[0] ? (track.activeCues[0] as VTTCue).text : ''}`;
          }),
      )
      .toBe(showing ? 'showing:Welcome to lecture hall A.' : 'hidden:Welcome to lecture hall A.');
  }

  async expectControlsHidden(hidden: boolean, example?: Example): Promise<void> {
    const bar = this.player(example).locator('.t-video-player__bar');
    if (hidden) await expect(bar).toHaveClass(/t-video-player__bar--hidden/);
    else await expect(bar).not.toHaveClass(/t-video-player__bar--hidden/);
  }

  async expectPlayLabel(label: string, example?: Example): Promise<void> {
    await expect(this.control('play-pause', example)).toHaveAttribute('aria-label', label);
  }

  async expectAccent(color: string, example?: Example): Promise<void> {
    await expect(this.player(example).locator('.t-video-player__central-play svg')).toHaveCSS(
      'background-color',
      color,
    );
  }

  async connectToHub(): Promise<void> {
    await this.page.getByRole('button', { name: 'Connect to the hub', exact: true }).click();
  }

  async expectError(message: string, example?: Example): Promise<void> {
    const alert = this.player(example).getByRole('alert');
    await expect(alert).toBeVisible();
    await expect(alert.getByRole('heading')).toHaveText(message);
    await expect(alert.getByRole('button', { name: 'Retry', exact: true })).toBeVisible();
  }

  /** The acceptance screen, whose fixture transport can simulate transport events. */
  async openAcceptance(parameters: Record<string, string>): Promise<void> {
    await this.page.goto('/video-player?' + new URLSearchParams(parameters).toString());
    await expect(
      this.page.getByRole('heading', { name: 'Video player', exact: true }),
    ).toBeVisible();
  }

  /** Has the acceptance screen's fixture transport report a lost connection. */
  async simulateConnectionLoss(): Promise<void> {
    await this.page.evaluate(() =>
      (window as unknown as { __videoFixture: { drop(): void } }).__videoFixture.drop(),
    );
  }

  async simulateConnectionRestored(): Promise<void> {
    await this.page.evaluate(() =>
      (window as unknown as { __videoFixture: { restore(): void } }).__videoFixture.restore(),
    );
  }

  async expectStatus(text: string): Promise<void> {
    await expect(this.player().locator('.t-video-player__status')).toHaveText(text);
  }

  async expectDimmed(): Promise<void> {
    await expect(this.player().locator('video')).toHaveCSS('filter', 'brightness(0.45)');
  }

  /** The host page's log of stateChange outputs begins and ends with the given states. */
  async expectReportedStatesStartAndEnd(first: string[], last: string[]): Promise<void> {
    await expect
      .poll(async () => {
        const states: string[] = JSON.parse(
          (await this.page
            .getByRole('status', { name: 'State changes', exact: true })
            .textContent()) || '[]',
        );
        return [states.slice(0, first.length), states.slice(-last.length)];
      })
      .toEqual([first, last]);
  }

  async expectEnded(duration: string): Promise<void> {
    await this.expectState('ended');
    const stage = this.player().locator('.t-video-player__ended');
    await expect(stage.getByRole('heading', { name: 'Stream ended', exact: true })).toBeVisible();
    await expect(stage).toContainText(`Live for ${duration}`);
  }

  /** No page errors, and no console errors other than the hub example's refused connection. */
  async expectHealthy(): Promise<void> {
    expect(
      this.errors.filter((error) => !EXPECTED_HUB_ERRORS.some((pattern) => pattern.test(error))),
    ).toEqual([]);
  }
}
