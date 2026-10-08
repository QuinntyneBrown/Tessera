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

  async expectError(message: string): Promise<void> {
    const alert = this.host().getByRole('alert');
    await expect(alert).toBeVisible();
    await expect(alert.getByRole('heading')).toHaveText(message);
  }

  async expectRetry(present: boolean): Promise<void> {
    await expect(
      this.host().getByRole('alert').getByRole('button', { name: 'Retry', exact: true }),
    ).toHaveCount(present ? 1 : 0);
  }

  async expectErrorOutputs(errors: { code: string; message: string }[]): Promise<void> {
    await expect
      .poll(async () =>
        JSON.parse(
          (await this.page.getByRole('status', { name: 'Errors', exact: true }).textContent()) ||
            '[]',
        ),
      )
      .toEqual(errors);
  }

  async removeMediaSource(): Promise<void> {
    await this.page.addInitScript(() => {
      delete (window as unknown as Record<string, unknown>)['MediaSource'];
    });
  }

  async makeTypeCheckThrow(): Promise<void> {
    await this.page.addInitScript(() => {
      MediaSource.isTypeSupported = () => {
        throw new TypeError('Fixture type check failure');
      };
    });
  }

  async recordMediaSourceCalls(): Promise<void> {
    await this.page.addInitScript(() => {
      const record = { addSourceBuffer: 0, appends: [] as { type: string; updating: boolean }[] };
      (window as unknown as { __mse: typeof record }).__mse = record;
      const add = MediaSource.prototype.addSourceBuffer;
      MediaSource.prototype.addSourceBuffer = function (type: string) {
        record.addSourceBuffer++;
        return add.call(this, type);
      };
      const append = SourceBuffer.prototype.appendBuffer;
      SourceBuffer.prototype.appendBuffer = function (data: BufferSource) {
        const bytes = ArrayBuffer.isView(data)
          ? new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
          : new Uint8Array(data);
        record.appends.push({
          type: String.fromCharCode(...bytes.subarray(4, 8)),
          updating: this.updating,
        });
        return append.call(this, data);
      };
    });
  }

  async expectSerialisedAppends(): Promise<void> {
    const record = await this.page.evaluate(
      () =>
        (
          window as unknown as {
            __mse: { addSourceBuffer: number; appends: { type: string; updating: boolean }[] };
          }
        ).__mse,
    );
    expect(record.addSourceBuffer).toBe(1);
    expect(record.appends.length).toBeGreaterThan(1);
    expect(record.appends[0].type).toBe('ftyp');
    expect(record.appends.slice(1).every((append) => append.type === 'moof')).toBe(true);
    expect(record.appends.every((append) => !append.updating)).toBe(true);
  }

  private videoMetrics() {
    return this.host()
      .locator('video')
      .evaluate((video: HTMLVideoElement) => ({
        readyState: video.readyState,
        currentTime: video.currentTime,
        paused: video.paused,
        muted: video.muted,
        volume: video.volume,
        ranges: Array.from({ length: video.buffered.length }, (_, index) => [
          video.buffered.start(index),
          video.buffered.end(index),
        ]),
      }));
  }

  async expectFirstFrame(): Promise<void> {
    await expect
      .poll(async () => {
        const metrics = await this.videoMetrics();
        return metrics.readyState >= 2 && metrics.currentTime > 0;
      })
      .toBe(true);
  }

  async expectStartedNearLiveEdge(): Promise<void> {
    const metrics = await this.videoMetrics();
    const [start, end] = metrics.ranges[metrics.ranges.length - 1];
    expect(metrics.currentTime).toBeGreaterThanOrEqual(start);
    expect(end - metrics.currentTime).toBeLessThanOrEqual(3.6);
  }

  async expectBufferedEndBeyond(seconds: number): Promise<void> {
    await expect
      .poll(async () => {
        const { ranges } = await this.videoMetrics();
        return ranges.length === 1 && ranges[0][1] > seconds;
      })
      .toBe(true);
  }

  async observeAnnouncements(): Promise<void> {
    await this.page.addInitScript(() => {
      const messages: string[] = [];
      (window as unknown as { __announcements: string[] }).__announcements = messages;
      new MutationObserver((records) => {
        for (const record of records) {
          const region =
            record.target.nodeType === Node.TEXT_NODE ? record.target.parentElement : record.target;
          if (
            region instanceof Element &&
            region.matches('t-video-player [aria-live="polite"]') &&
            region.textContent
          )
            messages.push(region.textContent);
        }
      }).observe(document, { subtree: true, childList: true, characterData: true });
    });
  }

  private announcements(): Promise<string[]> {
    return this.page.evaluate(
      () => (window as unknown as { __announcements: string[] }).__announcements,
    );
  }

  async expectAnnouncementHistoryToEndWith(message: string): Promise<void> {
    await expect.poll(async () => (await this.announcements()).at(-1)).toBe(message);
  }

  async expectAnnouncementHistory(messages: string[]): Promise<void> {
    await expect.poll(() => this.announcements()).toEqual(messages);
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
