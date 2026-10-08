import { expect, Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/** Owns the selectors and interactions of the video player acceptance screen. */
export class VideoPlayerPage {
  private readonly errors: string[] = [];

  constructor(readonly page: Page) {
    page.setDefaultTimeout(10000);
    page.on('pageerror', (error) => this.errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') this.errors.push(message.text());
    });
  }

  async open(
    scenario = 'live',
    options: { realTime?: boolean; extra?: Record<string, string | number | boolean> } = {},
  ): Promise<void> {
    if (!options.realTime) await this.page.clock.install();
    const parameters = new URLSearchParams({ scenario });
    for (const [key, value] of Object.entries(options.extra || {}))
      parameters.set(key, String(value));
    await this.page.goto('/video-player?' + parameters.toString());
  }

  private host() {
    return this.page.locator('t-video-player');
  }

  async expectState(state: string): Promise<void> {
    await expect(this.host()).toHaveAttribute('data-state', state);
  }

  async expectRegionName(name: string): Promise<void> {
    await expect(this.host().getByRole('region', { name, exact: true })).toBeVisible();
  }

  async expectNativeControlsHidden(): Promise<void> {
    const video = this.host().locator('video');
    await expect(video).toHaveCount(1);
    await expect(video).not.toHaveAttribute('controls', /.*/);
    await expect(video).not.toHaveAttribute('aria-hidden', /.*/);
  }

  async expectEmptyLiveRegion(): Promise<void> {
    const live = this.host().locator('[aria-live="polite"]');
    await expect(live).toHaveCount(1);
    await expect(live).toHaveText('');
  }

  async expectStateHistory(states: string[]): Promise<void> {
    await expect
      .poll(async () =>
        JSON.parse(
          (await this.page
            .getByRole('status', { name: 'State changes', exact: true })
            .textContent()) || '[]',
        ),
      )
      .toEqual(states);
  }

  async expectStatusText(text: string): Promise<void> {
    await expect(this.host().locator('.t-video-player__status')).toHaveText(text);
  }

  async expectTransportCalls(calls: string[]): Promise<void> {
    await expect
      .poll(() =>
        this.page.evaluate(
          () => (window as unknown as { __videoFixture: { calls: string[] } }).__videoFixture.calls,
        ),
      )
      .toEqual(calls);
  }

  async expectAnnouncement(text: string): Promise<void> {
    const live = this.host().locator('[aria-live="polite"]');
    await expect(live).toHaveCount(1);
    await expect(live).toHaveText(text);
  }

  async freezeTime(): Promise<void> {
    await this.page.clock.pauseAt(new Date(Date.now() + 1000));
  }

  async elapse(milliseconds: number): Promise<void> {
    await this.page.clock.runFor(milliseconds);
  }

  async resumeTime(): Promise<void> {
    await this.page.clock.resume();
  }

  async elapsedSeconds(): Promise<number> {
    const text = (await this.host().locator('.t-video-player__elapsed').textContent()) || '';
    return text
      .trim()
      .split(':')
      .map(Number)
      .reduce((total, part) => total * 60 + part, 0);
  }

  async expectElapsedHiddenFromAssistiveTech(): Promise<void> {
    await expect(this.host().locator('.t-video-player__elapsed')).toHaveAttribute(
      'aria-hidden',
      'true',
    );
  }

  async expectAspectRatio(ratio: string): Promise<void> {
    await expect(this.host().locator('.t-video-player__stage')).toHaveCSS('aspect-ratio', ratio);
  }

  async expectNoAccessibilityViolations(): Promise<void> {
    expect(this.errors).toEqual([]);
    const result = await new AxeBuilder({ page: this.page })
      .include('t-video-player')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(result.violations).toEqual([]);
  }
}
