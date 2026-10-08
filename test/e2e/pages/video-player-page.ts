import { expect as baseExpect, Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// Real media decoding is slow on a loaded machine; every assertion here waits up to 15 s.
const expect = baseExpect.configure({ timeout: 15000 });

/** Owns the selectors and interactions of the video player acceptance screen. */
export class VideoPlayerPage {
  private readonly errors: string[] = [];
  private readonly warnings: string[] = [];

  constructor(readonly page: Page) {
    page.setDefaultTimeout(10000);
    page.on('pageerror', (error) => this.errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') this.errors.push(message.text());
      if (message.type() === 'warning') this.warnings.push(message.text());
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
    await expect(this.host()).toHaveAttribute('data-state', state, { timeout: 20000 });
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
      const record = {
        addSourceBuffer: 0,
        appends: [] as { type: string; updating: boolean }[],
        created: 0,
        revoked: 0,
      };
      const urls = new Set<string>();
      const create = URL.createObjectURL;
      URL.createObjectURL = (object: Blob | MediaSource) => {
        const url = create(object);
        if (object instanceof MediaSource) {
          urls.add(url);
          record.created++;
        }
        return url;
      };
      const revoke = URL.revokeObjectURL;
      URL.revokeObjectURL = (url: string) => {
        if (urls.delete(url)) record.revoked++;
        revoke(url);
      };
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

  private mediaSourceRecord() {
    return this.page.evaluate(
      () =>
        (
          window as unknown as {
            __mse: { addSourceBuffer: number; created: number; revoked: number };
          }
        ).__mse,
    );
  }

  async expectMediaSourceUrls(counts: { created: number; revoked: number }): Promise<void> {
    await expect
      .poll(async () => {
        const { created, revoked } = await this.mediaSourceRecord();
        return { created, revoked };
      })
      .toEqual(counts);
  }

  async expectSourceBuffersAdded(count: number): Promise<void> {
    await expect.poll(async () => (await this.mediaSourceRecord()).addSourceBuffer).toBe(count);
  }

  async expectPlaybackAdvancing(): Promise<void> {
    const before = (await this.videoMetrics()).currentTime;
    await expect.poll(async () => (await this.videoMetrics()).currentTime).toBeGreaterThan(before);
  }

  async expectWarning(fragment: string): Promise<void> {
    await expect.poll(() => this.warnings.join(' ')).toContain(fragment);
  }

  async failAppendsWithQuota(times: number): Promise<void> {
    await this.page.addInitScript((times) => {
      let remaining = times;
      const append = SourceBuffer.prototype.appendBuffer;
      SourceBuffer.prototype.appendBuffer = function (data: BufferSource) {
        const bytes = ArrayBuffer.isView(data)
          ? new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
          : new Uint8Array(data);
        const media = String.fromCharCode(...bytes.subarray(4, 8)) === 'moof';
        if (media && remaining > 0) {
          remaining--;
          throw new DOMException('Fixture quota', 'QuotaExceededError');
        }
        return append.call(this, data);
      };
    }, times);
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
      .poll(
        async () => {
          const metrics = await this.videoMetrics();
          return metrics.readyState >= 2 && metrics.currentTime > 0;
        },
        { timeout: 20000 },
      )
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
    await expect
      .poll(async () => (await this.announcements()).at(-1), { timeout: 20000 })
      .toBe(message);
  }

  async expectAnnouncementHistory(messages: string[]): Promise<void> {
    await expect.poll(() => this.announcements()).toEqual(messages);
  }

  private async statsOutput(): Promise<{ count: number; last: Record<string, unknown> | null }> {
    return JSON.parse(
      (await this.page.getByRole('status', { name: 'Stats', exact: true }).textContent()) ||
        '{"count":0,"last":null}',
    );
  }

  async statsCount(): Promise<number> {
    return (await this.statsOutput()).count;
  }

  async expectLastStats(): Promise<void> {
    const { last } = await this.statsOutput();
    expect(Object.keys(last!).sort()).toEqual([
      'bufferedAheadSeconds',
      'bytesReceived',
      'droppedFrames',
      'latencySeconds',
      'state',
    ]);
    expect(last!['state']).toBe('live');
    expect(Number(last!['bytesReceived'])).toBeGreaterThan(0);
    const latency = Number(last!['latencySeconds']);
    expect(Math.round(latency * 10) / 10).toBe(latency);
  }

  async expectAnnounced(message: string): Promise<void> {
    await expect.poll(() => this.announcements(), { timeout: 15000 }).toContain(message);
  }

  async expectLatencyAtMost(seconds: number): Promise<void> {
    await expect
      .poll(async () => {
        const { ranges, currentTime } = await this.videoMetrics();
        return ranges.length ? ranges[ranges.length - 1][1] - currentTime : Infinity;
      })
      .toBeLessThanOrEqual(seconds);
  }

  async expectBufferWindowPruned(): Promise<void> {
    await expect
      .poll(
        async () => {
          const { ranges, currentTime } = await this.videoMetrics();
          return ranges.length > 0 && ranges[0][0] > 0 && currentTime - ranges[0][0] <= 62;
        },
        { timeout: 20000 },
      )
      .toBe(true);
  }

  async expectPlayheadInNewestRange(): Promise<void> {
    await expect
      .poll(
        async () => {
          const { ranges, currentTime } = await this.videoMetrics();
          const newest = ranges[ranges.length - 1];
          return ranges.length > 1 && currentTime >= newest[0] && currentTime <= newest[1];
        },
        { timeout: 15000 },
      )
      .toBe(true);
  }

  private liveBadge() {
    return this.host().locator('[data-control="live"]');
  }

  async expectLiveBadge(name: string | RegExp, disabled: boolean): Promise<void> {
    await expect(this.liveBadge()).toHaveRole('button');
    await expect(this.liveBadge()).toHaveAccessibleName(name);
    if (disabled) await expect(this.liveBadge()).toHaveAttribute('aria-disabled', 'true');
    else await expect(this.liveBadge()).not.toHaveAttribute('aria-disabled', /.*/);
  }

  async goToLiveWhenBehind(): Promise<void> {
    await this.expectLiveBadge(/^Go to live, \d+ seconds behind$/, false);
    await this.liveBadge().click();
  }

  private control(name: string) {
    return this.host().locator(`[data-control="${name}"]`);
  }

  async expectControlBar(): Promise<void> {
    const group = this.host().getByRole('group', { name: 'Player controls', exact: true });
    await expect(group).toBeVisible();
    await expect(group.locator('[data-control="play-pause"]')).toHaveCount(1);
  }

  async expectPlayPause(name: string, disabled: boolean): Promise<void> {
    const control = this.control('play-pause');
    await expect(control).toHaveRole('button');
    await expect(control).toHaveAttribute('type', 'button');
    await expect(control).toHaveAccessibleName(name);
    if (disabled) await expect(control).toHaveAttribute('aria-disabled', 'true');
    else await expect(control).not.toHaveAttribute('aria-disabled', /.*/);
  }

  async clickPlayPause(): Promise<void> {
    await this.clickControl('play-pause');
  }

  /** Clicks a control; an aria-disabled control is clicked by position to exercise its guard. */
  private async clickControl(name: string): Promise<void> {
    const control = this.control(name);
    if ((await control.getAttribute('aria-disabled')) !== 'true') return control.click();
    const box = (await control.boundingBox())!;
    await this.page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  }

  async clickStage(): Promise<void> {
    await this.host().locator('.t-video-player__stage').click();
  }

  async expectCentralPlay(visible: boolean): Promise<void> {
    await expect(this.host().locator('.t-video-player__central-play')).toHaveCount(visible ? 1 : 0);
  }

  async expectVideoPaused(paused: boolean): Promise<void> {
    await expect.poll(async () => (await this.videoMetrics()).paused).toBe(paused);
  }

  async expectLatencyAtLeast(seconds: number): Promise<void> {
    await expect
      .poll(async () => {
        const { ranges, currentTime } = await this.videoMetrics();
        return ranges.length ? ranges[ranges.length - 1][1] - currentTime : 0;
      })
      .toBeGreaterThanOrEqual(seconds);
  }

  async expectBytesStillArriving(): Promise<void> {
    await expect.poll(async () => (await this.statsOutput()).last?.['state']).toBe('paused');
    const before = Number((await this.statsOutput()).last!['bytesReceived']);
    await expect
      .poll(async () => Number((await this.statsOutput()).last!['bytesReceived']), {
        timeout: 5000,
      })
      .toBeGreaterThan(before);
  }

  async rejectNextPlay(): Promise<void> {
    await this.page.evaluate(() => {
      const play = HTMLMediaElement.prototype.play;
      HTMLMediaElement.prototype.play = function () {
        HTMLMediaElement.prototype.play = play;
        return Promise.reject(new DOMException('Fixture block', 'NotAllowedError'));
      };
    });
  }

  async expectMute(name: string, pressed: boolean): Promise<void> {
    const control = this.control('mute');
    await expect(control).toHaveRole('button');
    await expect(control).toHaveAccessibleName(name);
    await expect(control).toHaveAttribute('aria-pressed', String(pressed));
    await expect(control.locator('svg')).toHaveAttribute('data-icon', pressed ? 'muted' : 'volume');
  }

  async clickMute(): Promise<void> {
    await this.clickControl('mute');
  }

  async expectVideoAudio(audio: { muted: boolean; volume: number }): Promise<void> {
    await expect
      .poll(async () => {
        const { muted, volume } = await this.videoMetrics();
        return { muted, volume: Math.round(volume * 100) / 100 };
      })
      .toEqual(audio);
  }

  async expectVolumeSlider(): Promise<void> {
    const slider = this.control('volume');
    await expect(slider).toHaveRole('slider');
    await expect(slider).toHaveAccessibleName('Volume');
    for (const [name, value] of [
      ['type', 'range'],
      ['min', '0'],
      ['max', '100'],
      ['step', '5'],
    ])
      await expect(slider).toHaveAttribute(name, value);
  }

  async focusVolume(): Promise<void> {
    await this.control('volume').focus();
  }

  async pressKey(key: string): Promise<void> {
    await this.page.keyboard.press(key);
  }

  /** The slider shows `value`; a non-zero value is also the video volume. */
  async expectVolume(value: number): Promise<void> {
    const slider = this.control('volume');
    await expect(slider).toHaveValue(String(value));
    await expect(slider).toHaveAttribute('aria-valuetext', `${value}%`);
    if (value)
      await expect
        .poll(async () => Math.round((await this.videoMetrics()).volume * 100))
        .toBe(value);
  }

  async setHostVolume(volume: number): Promise<void> {
    await this.page.getByRole('button', { name: `Set volume ${volume}`, exact: true }).click();
  }

  async setHostMuted(): Promise<void> {
    await this.page.getByRole('button', { name: 'Set muted', exact: true }).click();
  }

  async blockAudiblePlay(): Promise<void> {
    await this.page.addInitScript(() => {
      const play = HTMLMediaElement.prototype.play;
      HTMLMediaElement.prototype.play = function () {
        return this.muted
          ? play.call(this)
          : Promise.reject(new DOMException('Fixture block', 'NotAllowedError'));
      };
    });
  }

  async blockAllPlay(): Promise<void> {
    await this.page.addInitScript(() => {
      HTMLMediaElement.prototype.play = () =>
        Promise.reject(new DOMException('Fixture block', 'NotAllowedError'));
    });
  }

  async expectUnmuteChip(visible: boolean): Promise<void> {
    await expect(this.control('unmute-chip')).toHaveCount(visible ? 1 : 0);
  }

  async clickUnmuteChip(): Promise<void> {
    await this.control('unmute-chip').click();
  }

  async dismissUnmuteChip(): Promise<void> {
    await this.host().getByRole('button', { name: 'Dismiss', exact: true }).click();
  }

  /** Replaces the browser's fullscreen API, which headless Chromium does not honour reliably. */
  async stubFullscreen(): Promise<void> {
    await this.page.addInitScript(() => {
      let element: Element | null = null;
      const stub = {
        requestedOn: '',
        exitExternally() {
          element = null;
          document.dispatchEvent(new Event('fullscreenchange'));
        },
      };
      (window as unknown as { __fullscreenStub: typeof stub }).__fullscreenStub = stub;
      Object.defineProperty(Document.prototype, 'fullscreenElement', { get: () => element });
      Object.defineProperty(Document.prototype, 'fullscreenEnabled', { get: () => true });
      Element.prototype.requestFullscreen = function () {
        element = this;
        stub.requestedOn = this.tagName.toLowerCase();
        document.dispatchEvent(new Event('fullscreenchange'));
        return Promise.resolve();
      };
      Document.prototype.exitFullscreen = () => {
        stub.exitExternally();
        return Promise.resolve();
      };
    });
  }

  async disableFullscreen(): Promise<void> {
    await this.page.addInitScript(() => {
      Object.defineProperty(Document.prototype, 'fullscreenEnabled', { get: () => false });
    });
  }

  async exitFullscreenExternally(): Promise<void> {
    await this.page.evaluate(() =>
      (
        window as unknown as { __fullscreenStub: { exitExternally(): void } }
      ).__fullscreenStub.exitExternally(),
    );
  }

  async expectFullscreenRequestedOnHost(): Promise<void> {
    await expect
      .poll(() =>
        this.page.evaluate(
          () =>
            (window as unknown as { __fullscreenStub: { requestedOn: string } }).__fullscreenStub
              .requestedOn,
        ),
      )
      .toBe('t-video-player');
  }

  async clickFullscreen(): Promise<void> {
    await this.clickControl('fullscreen');
  }

  async expectFullscreen(name: string, pressed: boolean): Promise<void> {
    const control = this.control('fullscreen');
    await expect(control).toHaveRole('button');
    await expect(control).toHaveAccessibleName(name);
    await expect(control).toHaveAttribute('aria-pressed', String(pressed));
    await expect(control.locator('svg')).toHaveAttribute('data-icon', pressed ? 'exit' : 'enter');
  }

  async expectNoFullscreenControl(): Promise<void> {
    await expect(this.control('fullscreen')).toHaveCount(0);
  }

  async expectTrack(track: {
    src: string;
    srclang: string;
    label: string;
    mode: string;
  }): Promise<void> {
    const tracks = this.host().locator('video > track');
    await expect(tracks).toHaveCount(1);
    await expect(tracks).toHaveAttribute('kind', 'captions');
    await expect(tracks).toHaveAttribute('src', track.src);
    await expect(tracks).toHaveAttribute('srclang', track.srclang);
    await expect(tracks).toHaveAttribute('label', track.label);
    await expect
      .poll(() => tracks.evaluate((element: HTMLTrackElement) => element.track.mode))
      .toBe(track.mode);
  }

  async expectCaptions(pressed: boolean): Promise<void> {
    const control = this.control('captions');
    await expect(control).toHaveRole('button');
    await expect(control).toHaveAccessibleName('Captions');
    await expect(control).toHaveAttribute('aria-pressed', String(pressed));
    await expect(control.locator('svg')).toHaveAttribute(
      'data-icon',
      pressed ? 'captions-on' : 'captions-off',
    );
  }

  async expectNoCaptions(): Promise<void> {
    await expect(this.control('captions')).toHaveCount(0);
    await expect(this.host().locator('video > track')).toHaveCount(0);
  }

  async clickCaptions(): Promise<void> {
    await this.clickControl('captions');
  }

  async changeCaptionSource(): Promise<void> {
    await this.page.getByRole('button', { name: 'Change caption source', exact: true }).click();
  }

  async clearCaptions(): Promise<void> {
    await this.page.getByRole('button', { name: 'Clear captions', exact: true }).click();
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
