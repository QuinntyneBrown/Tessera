import { expect as baseExpect, Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// Real media decoding is slow on a loaded machine; every assertion here waits up to 15 s.
const expect = baseExpect.configure({ timeout: 15000 });

/** Owns the selectors and interactions of the video player acceptance screen. */
export class VideoPlayerPage {
  private readonly errors: string[] = [];
  private readonly warnings: string[] = [];
  private readonly consoleTexts: string[] = [];

  constructor(readonly page: Page) {
    page.setDefaultTimeout(20000);
    page.on('pageerror', (error) => this.errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') this.errors.push(message.text());
      if (message.type() === 'warning') this.warnings.push(message.text());
      this.consoleTexts.push(message.text());
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

  /** Stops the page clock where it is; timers then run only through elapse(). */
  async freezeTime(): Promise<void> {
    for (const margin of [5, 20, 100, 500]) {
      const now = await this.page.evaluate(() => Date.now());
      try {
        return await this.page.clock.pauseAt(now + margin);
      } catch {
        // The page clock moved past the target before the call arrived; aim further ahead.
      }
    }
    throw new Error('Could not freeze the page clock');
  }

  async elapse(milliseconds: number): Promise<void> {
    await this.page.clock.runFor(milliseconds);
  }

  /** Lets a frozen page render once, as the next animation frame would. */
  async nextFrame(): Promise<void> {
    await this.page.clock.runFor(16);
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

  async stallSource(): Promise<void> {
    await this.page.evaluate(() =>
      (window as unknown as { __videoFixture: { stall(): void } }).__videoFixture.stall(),
    );
  }

  async resumeSource(): Promise<void> {
    await this.page.evaluate(() =>
      (window as unknown as { __videoFixture: { resume(): void } }).__videoFixture.resume(),
    );
  }

  async expectSpinner(visible: boolean): Promise<void> {
    await expect(this.host().locator('.t-video-player__spinner')).toHaveCount(visible ? 1 : 0);
  }

  async expectVideoVisible(): Promise<void> {
    await expect(this.host().locator('video')).toBeVisible();
  }

  async expectNotAnnounced(message: string): Promise<void> {
    expect(await this.announcements()).not.toContain(message);
  }

  async expectEndedPanel(duration: string): Promise<void> {
    const panel = this.host().locator('.t-video-player__ended');
    await expect(panel).toBeVisible();
    await expect(panel.getByRole('heading')).toHaveText('Stream ended');
    await expect(panel).toContainText(duration);
  }

  async expectControlsDisabledExceptFullscreen(): Promise<void> {
    for (const name of ['play-pause', 'mute', 'volume', 'live', 'captions'])
      await expect(this.control(name)).toHaveAttribute('aria-disabled', 'true');
    await expect(this.control('fullscreen')).not.toHaveAttribute('aria-disabled', /.*/);
  }

  /** Stalls the source and resolves once the video waits at the end of its buffered media. */
  async stallUntilVideoWaits(): Promise<void> {
    await this.host()
      .locator('video')
      .evaluate(
        (video) =>
          new Promise<void>((resolve) => {
            const onWaiting = () => {
              const end = video.buffered.length ? video.buffered.end(video.buffered.length - 1) : 0;
              if (end - video.currentTime > 0.5) return;
              video.removeEventListener('waiting', onWaiting);
              resolve();
            };
            video.addEventListener('waiting', onWaiting);
            (window as unknown as { __videoFixture: { stall(): void } }).__videoFixture.stall();
          }),
      );
  }

  /**
   * The history contains `states` in order, ends with the last of them, and never repeats a
   * state twice in a row. Real playback may stutter into buffering and back in between.
   */
  async expectStateHistoryInOrder(states: string[]): Promise<void> {
    await expect
      .poll(async () => {
        const history: string[] = JSON.parse(
          (await this.page
            .getByRole('status', { name: 'State changes', exact: true })
            .textContent()) || '[]',
        );
        let next = 0;
        for (const state of history) if (state === states[next]) next++;
        return (
          next === states.length &&
          history.at(-1) === states.at(-1) &&
          history.every((state, index) => state !== history[index - 1])
        );
      })
      .toBe(true);
  }

  async dropConnection(): Promise<void> {
    await this.page.evaluate(() =>
      (window as unknown as { __videoFixture: { drop(): void } }).__videoFixture.drop(),
    );
  }

  async restoreConnection(): Promise<void> {
    await this.page.evaluate(() =>
      (window as unknown as { __videoFixture: { restore(): void } }).__videoFixture.restore(),
    );
  }

  async expectStageDimmed(): Promise<void> {
    await expect(this.host().locator('video')).toBeVisible();
    await expect(this.host().locator('video')).toHaveCSS('filter', /brightness/);
  }

  async clickRetry(): Promise<void> {
    await this.host()
      .getByRole('alert')
      .getByRole('button', { name: 'Retry', exact: true })
      .click();
  }

  async expectTokenRequests(count: number): Promise<void> {
    await expect
      .poll(() =>
        this.page.evaluate(
          () =>
            (window as unknown as { __videoFixture: { tokenRequests: number } }).__videoFixture
              .tokenRequests,
        ),
      )
      .toBe(count);
  }

  async unmountPlayer(): Promise<void> {
    await this.page.getByRole('button', { name: 'Unmount player', exact: true }).click();
  }

  async expectPlayerRemoved(): Promise<void> {
    await expect(this.host()).toHaveCount(0);
  }

  async failSource(): Promise<void> {
    await this.page.evaluate(() =>
      (window as unknown as { __videoFixture: { fail(): void } }).__videoFixture.fail(),
    );
  }

  async expectRawTextOnlyInCause(text: string): Promise<void> {
    await expect(this.host()).not.toContainText(text);
    await expect(
      this.page.getByRole('status', { name: 'Error causes', exact: true }),
    ).toContainText(text);
  }

  async focusControl(name: string): Promise<void> {
    await this.control(name).focus();
  }

  async focusOutside(): Promise<void> {
    await this.page.getByRole('button', { name: 'Set muted', exact: true }).focus();
  }

  async expectFocusOutside(): Promise<void> {
    await expect(this.page.getByRole('button', { name: 'Set muted', exact: true })).toBeFocused();
  }

  async expectFocusedErrorHeading(): Promise<void> {
    await expect(this.host().getByRole('alert').getByRole('heading')).toBeFocused();
  }

  async expectFocusedControl(name: string): Promise<void> {
    await expect(this.control(name)).toBeFocused();
  }

  async expectNoError(): Promise<void> {
    await expect(this.host().getByRole('alert')).toHaveCount(0);
  }

  async recordKeyDefaults(): Promise<void> {
    await this.page.addInitScript(() => {
      window.addEventListener('keydown', (event) => {
        (window as unknown as { __lastKeyPrevented: boolean }).__lastKeyPrevented =
          event.defaultPrevented;
      });
    });
  }

  async expectLastKeyPrevented(prevented: boolean): Promise<void> {
    await expect
      .poll(() =>
        this.page.evaluate(
          () => (window as unknown as { __lastKeyPrevented: boolean }).__lastKeyPrevented,
        ),
      )
      .toBe(prevented);
  }

  async expectTabOrder(controls: string[]): Promise<void> {
    await this.focusControl(controls[0]);
    const order = [await this.focusedControl()];
    for (let index = 1; index < controls.length; index++) {
      await this.page.keyboard.press('Tab');
      order.push(await this.focusedControl());
    }
    expect(order).toEqual(controls);
  }

  private focusedControl(): Promise<string | null> {
    return this.page.evaluate(() => document.activeElement?.getAttribute('data-control') ?? null);
  }

  async expectStageNotFocusable(): Promise<void> {
    const stage = this.host().locator('.t-video-player__stage');
    await expect(stage).not.toHaveAttribute('tabindex', /.*/);
    await this.focusControl('play-pause');
    await this.page.keyboard.press('Shift+Tab');
    expect(
      await this.page.evaluate(() => !!document.activeElement?.closest('.t-video-player__stage')),
    ).toBe(false);
  }

  /** Removes the captions input from script so that focus stays where it is. */
  async removeCaptionsKeepingFocus(): Promise<void> {
    await this.page.evaluate(() =>
      (
        window as unknown as { __videoFixtureHost: { clearCaptions(): void } }
      ).__videoFixtureHost.clearCaptions(),
    );
    await expect(this.control('captions')).toHaveCount(0);
  }

  async expectFocusedRegion(): Promise<void> {
    await expect(this.host().getByRole('region')).toBeFocused();
  }

  async expectControlCatalogue(): Promise<void> {
    const group = this.host().getByRole('group', { name: 'Player controls', exact: true });
    await expect(group).toBeVisible();
    const buttons = group.locator('button');
    for (const button of await buttons.all()) {
      await expect(button).toHaveAttribute('type', 'button');
      await expect(button).toHaveAttribute('aria-label', /.+/);
      await expect(button).not.toHaveAttribute('disabled', /.*/);
    }
    for (const toggle of ['mute', 'captions', 'fullscreen'])
      await expect(this.control(toggle)).toHaveAttribute('aria-pressed', /^(true|false)$/);
    await expect(group.getByRole('slider')).toHaveCount(1);
    await this.expectVolumeSlider();
    await this.expectLiveBadge('Live', true);
    await this.focusControl('live');
    await expect(this.control('live')).toBeFocused();
  }

  async expectPlayerCount(count: number): Promise<void> {
    await expect(this.host()).toHaveCount(count);
  }

  /** Each player has exactly one polite region inside its host, holding its own messages. */
  async expectOwnLiveRegions(messages: string[]): Promise<void> {
    const hosts = await this.host().all();
    expect(hosts).toHaveLength(messages.length);
    for (const [index, host] of hosts.entries()) {
      await expect(host.locator('[aria-live="polite"]')).toHaveCount(1);
      await expect(host.locator('[aria-live="polite"]')).toHaveText(messages[index]);
    }
  }

  async expectTransportCount(count: number): Promise<void> {
    await expect
      .poll(() =>
        this.page.evaluate(
          () =>
            (window as unknown as { __videoFixture: { transports: unknown[] } }).__videoFixture
              .transports.length,
        ),
      )
      .toBe(count);
  }

  private stage() {
    return this.host().locator('.t-video-player__stage');
  }

  /** Moves the pointer onto the middle of the stage and leaves it there. */
  async restPointerOnStage(): Promise<void> {
    const box = (await this.stage().boundingBox())!;
    await this.page.mouse.move(box.x + box.width / 2, box.y + box.height / 3);
  }

  async movePointerOverStage(): Promise<void> {
    const box = (await this.stage().boundingBox())!;
    await this.page.mouse.move(box.x + box.width / 2 + 20, box.y + box.height / 3 + 10, {
      steps: 2,
    });
  }

  async hoverControlBar(): Promise<void> {
    await this.control('live').hover();
  }

  async focusRegion(): Promise<void> {
    await this.host().getByRole('region').focus();
  }

  async expectControlsHidden(hidden: boolean): Promise<void> {
    const bar = this.host().getByRole('group', { name: 'Player controls', exact: true });
    await expect(bar).toBeAttached();
    await expect(bar).not.toHaveAttribute('aria-hidden', /.*/);
    if (hidden) await expect(bar).toHaveClass(/t-video-player__bar--hidden/);
    else await expect(bar).not.toHaveClass(/t-video-player__bar--hidden/);
  }

  async expectControlsTransition(duration: string): Promise<void> {
    await expect(this.host().getByRole('group', { name: 'Player controls' })).toHaveCSS(
      'transition-duration',
      duration,
    );
  }

  async expectStageCursor(cursor: string): Promise<void> {
    await expect(this.stage()).toHaveCSS('cursor', cursor);
  }

  async tapStage(): Promise<void> {
    const box = (await this.stage().boundingBox())!;
    await this.page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 3);
  }

  async tapControl(name: string): Promise<void> {
    await this.control(name).tap();
  }

  async expectContextMenuPrevented(target: 'stage' | 'page', prevented: boolean): Promise<void> {
    const element =
      target === 'stage' ? this.stage() : this.page.getByRole('heading', { level: 1 });
    expect(
      await element.evaluate((node) => {
        const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
        node.dispatchEvent(event);
        return event.defaultPrevented;
      }),
    ).toBe(prevented);
  }

  async useViewport(width: number, height = 900): Promise<void> {
    await this.page.setViewportSize({ width, height });
  }

  async enlargeText(): Promise<void> {
    await this.page.addStyleTag({ content: 'html {font-size: 200% !important}' });
  }

  async applyTextSpacing(): Promise<void> {
    await this.page.addStyleTag({
      content:
        '* {line-height: 1.5 !important; letter-spacing: .12em !important; word-spacing: .16em !important} p {margin-bottom: 2em !important}',
    });
  }

  async expectNoHorizontalScroll(): Promise<void> {
    await expect
      .poll(() => this.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      .toBe(true);
  }

  async expectControlsInsidePlayer(): Promise<void> {
    const host = (await this.host().boundingBox())!;
    for (const control of await this.host().locator('[data-control]').all()) {
      if (!(await control.isVisible())) continue;
      const box = (await control.boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(host.x - 1);
      expect(box.x + box.width).toBeLessThanOrEqual(host.x + host.width + 1);
    }
  }

  async expectTargetSizes(): Promise<void> {
    for (const button of await this.host().locator('button').all()) {
      if (!(await button.isVisible())) continue;
      const box = (await button.boundingBox())!;
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.height).toBeGreaterThanOrEqual(44);
    }
    // The narrow layout hides the slider; its thumb is measured wherever it is shown.
    if (!(await this.control('volume').isVisible())) return;
    const thumb = await this.control('volume').evaluate((slider) => {
      const style = getComputedStyle(slider, '::-webkit-slider-thumb');
      return { width: parseFloat(style.width), height: parseFloat(style.height) };
    });
    expect(thumb.width).toBeGreaterThanOrEqual(24);
    expect(thumb.height).toBeGreaterThanOrEqual(24);
  }

  /** Each text element fits its box, and no two bar items overlap. */
  private async expectWhole(selectors: string[]): Promise<void> {
    const boxes = await this.host().evaluate((host, selectors) => {
      return selectors
        .map((selector) => host.querySelector<HTMLElement>(selector))
        .filter((element): element is HTMLElement => !!element && element.checkVisibility())
        .map((element) => ({
          clipped:
            element.scrollWidth > element.clientWidth + 1 ||
            element.scrollHeight > element.clientHeight + 1,
          rect: element.getBoundingClientRect().toJSON() as DOMRect,
        }));
    }, selectors);
    expect(boxes.length).toBeGreaterThan(0);
    for (const box of boxes) expect(box.clipped).toBe(false);
    for (const [index, a] of boxes.entries())
      for (const b of boxes.slice(index + 1))
        expect(
          a.rect.right <= b.rect.left + 1 ||
            b.rect.right <= a.rect.left + 1 ||
            a.rect.bottom <= b.rect.top + 1 ||
            b.rect.bottom <= a.rect.top + 1,
        ).toBe(true);
  }

  async expectBarTextWhole(): Promise<void> {
    await this.expectWhole([
      '.t-video-player__elapsed',
      '[data-control="live"]',
      '[data-control="play-pause"]',
      '[data-control="mute"]',
    ]);
  }

  async expectErrorTextWhole(): Promise<void> {
    await this.expectWhole(['.t-video-player__error-heading', '.t-video-player__retry']);
  }

  async expectNarrowLayout(narrow: boolean): Promise<void> {
    const stage = this.host().locator('.t-video-player__stage');
    const bar = this.host().getByRole('group', { name: 'Player controls', exact: true });
    await expect
      .poll(async () => {
        const stageBox = (await stage.boundingBox())!;
        const barBox = (await bar.boundingBox())!;
        return barBox.y >= stageBox.y + stageBox.height - 1;
      })
      .toBe(narrow);
    if (narrow) await expect(this.control('volume')).toBeHidden();
    else await expect(this.control('volume')).toBeVisible();
    await expect(this.host().locator('.t-video-player__elapsed')).toBeVisible();
  }

  async resizeContainer(width: number): Promise<void> {
    await this.page.locator('.fixture-container').evaluate((element, width) => {
      (element as HTMLElement).style.width = `${width}px`;
    }, width);
  }

  async blurPlayer(): Promise<void> {
    await this.page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  }

  /** Resolves CSS colours (including system colours and custom properties) to rgb() values. */
  private async contrastPairs(pairs: [string, string, number][]): Promise<void> {
    const ratios = await this.host().evaluate((host, pairs) => {
      const probe = document.createElement('i');
      host.appendChild(probe);
      const rgb = (color: string) => {
        probe.style.color = color;
        return getComputedStyle(probe)
          .color.match(/[\d.]+/g)!
          .slice(0, 3)
          .map(Number);
      };
      const luminance = (color: string) => {
        const [r, g, b] = rgb(color).map((value) => {
          const s = value / 255;
          return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
        });
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
      };
      const result = pairs.map(([a, b, minimum]) => {
        const [x, y] = [luminance(a), luminance(b)];
        return { a, b, minimum, ratio: (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05) };
      });
      probe.remove();
      return result;
    }, pairs);
    for (const { a, b, minimum, ratio } of ratios)
      expect(ratio, `${a} against ${b}`).toBeGreaterThanOrEqual(minimum);
  }

  private style(selector: string, property: string): Promise<string> {
    return this.host().evaluate(
      (host, [selector, property]) =>
        getComputedStyle(host.querySelector(selector)!).getPropertyValue(property),
      [selector, property],
    );
  }

  async expectBarContrast(): Promise<void> {
    // Tabbing onto Mute gives it keyboard focus, so its focus ring is drawn.
    await this.focusControl('play-pause');
    await this.page.keyboard.press('Tab');
    const scrim = await this.style('.t-video-player__bar', 'background-color');
    await this.contrastPairs([
      [await this.style('[data-control="play-pause"]', 'color'), scrim, 4.5],
      [await this.style('.t-video-player__elapsed', 'color'), scrim, 4.5],
      [await this.style('[data-control="live"]', 'color'), scrim, 4.5],
      [await this.style('.t-video-player__live-dot', 'background-color'), scrim, 3],
      [await this.style('[data-control="mute"]', 'outline-color'), scrim, 3],
    ]);
    expect(await this.style('[data-control="mute"]', 'outline-style')).toBe('solid');
  }

  async expectCaptionContrast(): Promise<void> {
    await this.contrastPairs([
      [
        await this.style('.t-video-player__region', '--_vp-caption-fg'),
        await this.style('.t-video-player__region', '--_vp-caption-bg'),
        4.5,
      ],
    ]);
    const cue = await this.page.evaluate(() =>
      Array.from(document.styleSheets)
        .flatMap((sheet) => Array.from(sheet.cssRules))
        .some((rule) => rule.cssText.includes('::cue') && rule.cssText.includes('caption')),
    );
    expect(cue).toBe(true);
  }

  async expectErrorContrast(): Promise<void> {
    const surface = await this.style('.t-video-player__error', 'background-color');
    await this.contrastPairs([
      [await this.style('.t-video-player__error-heading', 'color'), surface, 4.5],
      [
        await this.style('.t-video-player__retry', 'color'),
        await this.style('.t-video-player__retry', 'background-color'),
        4.5,
      ],
    ]);
  }

  async expectNoDecorativeMotion(): Promise<void> {
    expect(await this.style('.t-video-player__live-dot', 'animation-name')).toBe('none');
    expect(await this.style('.t-video-player__bar', 'transition-duration')).toBe('0s');
    if (await this.host().locator('.t-video-player__spinner').count())
      expect(await this.style('.t-video-player__spinner', 'animation-name')).toBe('none');
  }

  async expectLiveDotAnimated(animated: boolean): Promise<void> {
    const name = await this.style('.t-video-player__live-dot', 'animation-name');
    expect(name !== 'none').toBe(animated);
  }

  async expectForcedColors(): Promise<void> {
    const system = await this.host().evaluate((host) => {
      const probe = document.createElement('i');
      host.appendChild(probe);
      const resolve = (color: string) => {
        probe.style.color = color;
        return getComputedStyle(probe).color;
      };
      const result = { canvas: resolve('Canvas'), buttonText: resolve('ButtonText') };
      probe.remove();
      return result;
    });
    expect(await this.style('.t-video-player__bar', 'background-color')).toBe(system.canvas);
    expect(await this.style('[data-control="play-pause"]', 'color')).toBe(system.buttonText);
    expect(await this.style('[data-control="play-pause"] svg', 'fill')).toBe(system.buttonText);
    expect(await this.style('.t-video-player__live-dot', 'forced-color-adjust')).toBe('none');
    for (const selector of [
      '.t-video-player__bar',
      '[data-control="play-pause"]',
      '[data-control="live"]',
    ])
      expect(await this.style(selector, 'forced-color-adjust')).toBe('auto');
  }

  async expectThemeColors(colors: {
    scrim: string;
    controlForeground: string;
    placeholder: string;
  }): Promise<void> {
    await expect(this.host().locator('.t-video-player__bar')).toHaveCSS(
      'background-color',
      colors.scrim,
    );
    await expect(this.control('play-pause')).toHaveCSS('color', colors.controlForeground);
    await expect(this.host().locator('.t-video-player__placeholder')).toHaveCSS(
      'background-color',
      colors.placeholder,
    );
  }

  async expectFocusRingColor(color: string): Promise<void> {
    await this.focusControl('mute');
    await expect(this.control('mute')).toHaveCSS('outline-color', color);
  }

  async expectAccentColor(color: string): Promise<void> {
    await expect(this.host().locator('.t-video-player__central-play svg')).toHaveCSS(
      'background-color',
      color,
    );
  }

  async scrimColor(): Promise<string> {
    return this.style('.t-video-player__bar', 'background-color');
  }

  async expectScrimColorNot(color: string): Promise<void> {
    await expect(this.host().locator('.t-video-player__bar')).not.toHaveCSS(
      'background-color',
      color,
    );
  }

  /** Counts requests and sockets to the hub's host; SignalR would negotiate there first. */
  countHubTraffic(): () => number {
    let count = 0;
    const toHub = (url: string) => new URL(url).hostname === 'hub.example';
    this.page.on('request', (request) => toHub(request.url()) && count++);
    this.page.on('websocket', (socket) => toHub(socket.url()) && count++);
    return () => count;
  }

  async expectWarningCount(fragment: string, count: number): Promise<void> {
    await this.page.waitForTimeout(250);
    expect(this.warnings.filter((warning) => warning.includes(fragment))).toHaveLength(count);
  }

  async expectNoWarning(fragment: string): Promise<void> {
    expect(this.warnings.join(' ')).not.toContain(fragment);
  }

  async expectConfiguredHubUrl(hubUrl: string): Promise<void> {
    await expect
      .poll(() =>
        this.page.evaluate(
          () =>
            (window as unknown as { __videoFixture: { hubUrls: string[] } }).__videoFixture.hubUrls,
        ),
      )
      .toEqual([hubUrl]);
  }

  async expectNames(names: {
    region: string;
    controls: string;
    playPause: string;
    mute: string;
    volume: string;
    live: string;
  }): Promise<void> {
    await this.expectRegionName(names.region);
    await expect(
      this.host().getByRole('group', { name: names.controls, exact: true }),
    ).toBeVisible();
    await expect(this.control('play-pause')).toHaveAccessibleName(names.playPause);
    await expect(this.control('mute')).toHaveAccessibleName(names.mute);
    await expect(this.control('volume')).toHaveAccessibleName(names.volume);
    await expect(this.control('live')).toHaveAccessibleName(names.live);
  }

  async expectLiveBadgeText(text: string): Promise<void> {
    await expect(this.control('live')).toHaveText(text);
  }

  async expectPlaceholderTitle(title: string): Promise<void> {
    await expect(
      this.host().locator('.t-video-player__placeholder .t-video-player__title'),
    ).toHaveText(title);
  }

  async expectEndedTitle(title: string): Promise<void> {
    await expect(this.host().locator('.t-video-player__ended .t-video-player__title')).toHaveText(
      title,
    );
  }

  async expectNoInjectedMarkup(): Promise<void> {
    await expect(this.host().locator('img')).toHaveCount(0);
    expect(
      await this.page.evaluate(() => (window as unknown as { __xss?: unknown }).__xss),
    ).toBeUndefined();
  }

  async expectTokenConfined(token: string): Promise<void> {
    expect(await this.host().evaluate((host) => host.outerHTML)).not.toContain(token);
    expect(this.consoleTexts.join(' ')).not.toContain(token);
    for (const name of ['Errors', 'Error causes', 'Stats'])
      await expect(this.page.getByRole('status', { name, exact: true })).not.toContainText(token);
  }

  async expectNotInPlayer(text: string): Promise<void> {
    expect(await this.host().evaluate((host) => host.outerHTML)).not.toContain(text);
  }

  async changeStream(): Promise<void> {
    await this.page.getByRole('button', { name: 'Change stream', exact: true }).click();
  }

  async clearStream(): Promise<void> {
    await this.page.getByRole('button', { name: 'Clear stream', exact: true }).click();
  }

  async mountPlayer(): Promise<void> {
    await this.page.getByRole('button', { name: 'Mount player', exact: true }).click();
    await expect(this.host()).toHaveCount(1);
  }

  async resolvePendingDescribe(): Promise<void> {
    await this.page.evaluate(() =>
      (
        window as unknown as { __videoFixture: { resolveDescribe(): void } }
      ).__videoFixture.resolveDescribe(),
    );
    await this.page.waitForTimeout(250);
  }

  private fixtureNumber(name: string): Promise<number> {
    return this.page.evaluate(
      (name) =>
        (window as unknown as { __videoFixture: Record<string, number> }).__videoFixture[name],
      name,
    );
  }

  async expectActiveSubscriptions(count: number): Promise<void> {
    await expect.poll(() => this.fixtureNumber('activeSubscriptions')).toBe(count);
  }

  async expectOpenConnections(count: number): Promise<void> {
    await expect.poll(() => this.fixtureNumber('openConnections')).toBe(count);
  }

  async expectLiveMediaSourceUrls(count: number): Promise<void> {
    await expect
      .poll(async () => {
        const record = await this.page.evaluate(
          () => (window as unknown as { __mse: { created: number; revoked: number } }).__mse,
        );
        return record.created - record.revoked;
      })
      .toBe(count);
  }

  /** Listeners on document and window, read through the Chrome DevTools Protocol. */
  async documentListenerCount(): Promise<number> {
    const session = await this.page.context().newCDPSession(this.page);
    let total = 0;
    for (const expression of ['document', 'window']) {
      const { result } = await session.send('Runtime.evaluate', { expression });
      if (result.objectId)
        total += (
          await session.send('DOMDebugger.getEventListeners', { objectId: result.objectId })
        ).listeners.length;
    }
    await session.detach();
    return total;
  }

  async expectDocumentListenerCount(count: number): Promise<void> {
    await expect.poll(() => this.documentListenerCount()).toBe(count);
  }

  async expectZoneless(): Promise<void> {
    expect(await this.page.evaluate(() => 'Zone' in window)).toBe(false);
  }

  async expectTransportLog(entries: string[]): Promise<void> {
    await expect
      .poll(() =>
        this.page.evaluate(
          () => (window as unknown as { __videoFixture: { log: string[] } }).__videoFixture.log,
        ),
      )
      .toEqual(entries);
  }

  async expectStateOneOf(states: string[]): Promise<void> {
    await expect(this.host()).toHaveAttribute('data-state', new RegExp(`^(${states.join('|')})$`));
  }

  expectWithinBudget(values: number[], limit: number, required: number): void {
    const within = values.filter((value) => value <= limit).length;
    expect(
      within,
      `${within}/${values.length} within ${limit}; max ${Math.max(...values).toFixed(1)}`,
    ).toBeGreaterThanOrEqual(required);
  }

  /** Mounts the player `runs` times under CPU throttling and times each first frame. */
  async measureFirstFrames(runs: number, cpuSlowdown: number): Promise<number[]> {
    const session = await this.page.context().newCDPSession(this.page);
    await session.send('Emulation.setCPUThrottlingRate', { rate: cpuSlowdown });
    const durations: number[] = [];
    try {
      for (let run = 0; run < runs; run++) {
        const start = await this.page.evaluate(() => performance.now());
        await this.page.getByRole('button', { name: 'Mount player', exact: true }).click();
        durations.push(
          await this.page.evaluate(
            (start) =>
              new Promise<number>((resolve) => {
                const frame = () => {
                  const video = document.querySelector(
                    't-video-player video',
                  ) as HTMLVideoElement | null;
                  if (video && video.readyState >= 2 && video.currentTime > 0)
                    resolve(performance.now() - start);
                  else if (performance.now() - start > 20000) resolve(Infinity);
                  else requestAnimationFrame(frame);
                };
                frame();
              }),
            start,
          ),
        );
        await this.unmountPlayer();
        await this.expectPlayerRemoved();
      }
    } finally {
      await session.send('Emulation.setCPUThrottlingRate', { rate: 1 });
      await session.detach();
    }
    return durations;
  }

  async sampleBufferAndHeap(
    samples: number,
    intervalMs: number,
  ): Promise<{ behind: number; heap: number | null }[]> {
    const result: { behind: number; heap: number | null }[] = [];
    for (let index = 0; index < samples; index++) {
      await this.page.waitForTimeout(intervalMs);
      result.push(
        await this.host()
          .locator('video')
          .evaluate((video: HTMLVideoElement) => ({
            behind: video.buffered.length ? video.currentTime - video.buffered.start(0) : 0,
            heap:
              (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory
                ?.usedJSHeapSize ?? null,
          })),
      );
    }
    return result;
  }

  expectBoundedBuffer(samples: { behind: number }[], limit: number): void {
    for (const sample of samples) expect(sample.behind).toBeLessThanOrEqual(limit);
  }

  expectHeapNotMonotonic(samples: { heap: number | null }[]): void {
    const heaps = samples.map((sample) => sample.heap);
    if (heaps.some((heap) => heap === null)) return;
    const growing = heaps.every((heap, index) => index === 0 || heap! > heaps[index - 1]!);
    expect(growing, `heap ${heaps.join(', ')}`).toBe(false);
  }

  async observeLongTasks(): Promise<void> {
    await this.page.addInitScript(() => {
      const tasks: { start: number; duration: number }[] = [];
      (window as unknown as { __longTasks: typeof tasks }).__longTasks = tasks;
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries())
          tasks.push({ start: entry.startTime, duration: entry.duration });
      }).observe({ type: 'longtask', buffered: true });
      const appends: number[] = [];
      (window as unknown as { __appends: number[] }).__appends = appends;
      const append = SourceBuffer.prototype.appendBuffer;
      SourceBuffer.prototype.appendBuffer = function (data: BufferSource) {
        appends.push(performance.now());
        return append.call(this, data);
      };
    });
  }

  async measureLongTasksOverAppends(
    appends: number,
  ): Promise<{ appends: number[]; tasks: { start: number; duration: number }[] }> {
    const start = await this.page.evaluate(
      () => (window as unknown as { __appends: number[] }).__appends.length,
    );
    await expect
      .poll(
        () =>
          this.page.evaluate(() => (window as unknown as { __appends: number[] }).__appends.length),
        { timeout: 120000 },
      )
      .toBeGreaterThanOrEqual(start + appends);
    return this.page.evaluate((start) => {
      const state = window as unknown as {
        __appends: number[];
        __longTasks: { start: number; duration: number }[];
      };
      return { appends: state.__appends.slice(start, start + 100), tasks: state.__longTasks };
    }, start);
  }

  /** An append counts against the budget when a long task overlaps the second that follows it. */
  expectAppendsWithoutLongTasks(
    result: { appends: number[]; tasks: { start: number; duration: number }[] },
    required: number,
  ): void {
    const clean = result.appends.filter(
      (time) =>
        !result.tasks.some(
          (task) =>
            task.duration > 50 && task.start + task.duration >= time && task.start <= time + 50,
        ),
    ).length;
    expect(
      clean,
      `${clean}/${result.appends.length} appends without a long task`,
    ).toBeGreaterThanOrEqual(required);
  }

  /** Counts timer and frame callbacks created from video player code, by the creating stack. */
  async countComponentTimers(): Promise<void> {
    await this.page.addInitScript(() => {
      // Most specific first; Angular's own change-detection scheduling is not component-owned.
      const owners = [
        'VideoPlayerAnnouncer',
        'ControlsVisibility',
        'ReconnectPolicy',
        'MediaSourcePipeline',
        'VideoStreamSession',
        'VideoPlayer',
      ];
      const fired: Record<string, number> = {};
      (window as unknown as { __componentTimers: Record<string, number> }).__componentTimers =
        fired;
      const owner = () => {
        const stack = new Error().stack ?? '';
        if (stack.includes('scheduleCallback') || stack.includes('ChangeDetectionScheduler'))
          return;
        return owners.find((name) => stack.includes(name));
      };
      const wrap = <T extends (...args: never[]) => number>(original: T, kind: string): T =>
        ((callback: (...args: unknown[]) => void, ...rest: unknown[]) => {
          const name = owner();
          return (original as unknown as (...args: unknown[]) => number)(
            name
              ? (...args: unknown[]) => {
                  const key = `${kind}:${name}`;
                  fired[key] = (fired[key] ?? 0) + 1;
                  callback(...args);
                }
              : callback,
            ...rest,
          );
        }) as unknown as T;
      window.setTimeout = wrap(window.setTimeout, 'timeout');
      window.setInterval = wrap(window.setInterval, 'interval');
      window.requestAnimationFrame = wrap(window.requestAnimationFrame, 'frame');
    });
  }

  async componentTimersFiredOver(milliseconds: number): Promise<Record<string, number>> {
    const before = await this.page.evaluate(() => ({
      ...(window as unknown as { __componentTimers: Record<string, number> }).__componentTimers,
    }));
    await this.page.waitForTimeout(milliseconds);
    const after = await this.page.evaluate(
      () => (window as unknown as { __componentTimers: Record<string, number> }).__componentTimers,
    );
    return Object.fromEntries(
      Object.entries(after)
        .map(([key, count]) => [key, count - (before[key] ?? 0)] as const)
        .filter(([, count]) => count > 0),
    );
  }

  expectOnlyStatisticsTick(fired: Record<string, number>, seconds: number): void {
    expect(Object.keys(fired)).toEqual(['interval:VideoStreamSession']);
    expect(fired['interval:VideoStreamSession']).toBeGreaterThanOrEqual(seconds - 1);
    expect(fired['interval:VideoStreamSession']).toBeLessThanOrEqual(seconds + 1);
  }

  /** Waits for the bar to hide, moves the pointer, and counts frames until it is shown. */
  async measureRevealFrames(runs: number): Promise<number[]> {
    const frames: number[] = [];
    for (let run = 0; run < runs; run++) {
      await this.restPointerOnStage();
      await this.expectControlsHidden(true);
      frames.push(
        await this.host().evaluate(
          (host) =>
            new Promise<number>((resolve) => {
              const bar = host.querySelector('.t-video-player__bar')!;
              host
                .querySelector('.t-video-player__stage')!
                .dispatchEvent(
                  new PointerEvent('pointermove', { bubbles: true, pointerType: 'mouse' }),
                );
              let count = 0;
              const frame = () => {
                if (!bar.classList.contains('t-video-player__bar--hidden')) resolve(count);
                else if (++count > 30) resolve(count);
                else requestAnimationFrame(frame);
              };
              requestAnimationFrame(frame);
            }),
        ),
      );
    }
    return frames;
  }

  async verifyHarnessContract(report: Record<string, unknown>): Promise<void> {
    await this.page.getByRole('button', { name: 'Run harness contract', exact: true }).click();
    await expect
      .poll(
        async () =>
          JSON.parse(
            (await this.page
              .getByRole('status', { name: 'Harness contract', exact: true })
              .textContent()) || 'null',
          ),
        { timeout: 60000 },
      )
      .toEqual(report);
  }

  async openExamples(): Promise<void> {
    await this.page.goto('/?screen=video-player-examples');
  }

  async verifyExamples(): Promise<void> {
    await expect(
      this.page.getByRole('heading', { name: 'Video player examples', exact: true }),
    ).toBeVisible();
    await expect(this.host()).toHaveCount(5);
    const section = (heading: string) =>
      this.page
        .locator('section')
        .filter({ has: this.page.getByRole('heading', { name: heading, exact: true }) });
    await expect(section('Hub connection').locator('t-video-player')).toHaveAttribute(
      'data-state',
      'idle',
    );
    await expect(
      section('Hub connection').getByRole('button', { name: 'Connect to the hub', exact: true }),
    ).toBeVisible();
    await expect(section('Custom transport').locator('t-video-player')).toHaveAttribute(
      'data-state',
      'live',
    );
    await expect(section('Captions').locator('video > track')).toHaveAttribute('kind', 'captions');
    await expect(
      section('Localised strings').getByRole('region', {
        name: 'Reproductor de vídeo: Lecture hall A',
        exact: true,
      }),
    ).toBeVisible();
    await expect(section('Themed player').locator('t-video-player')).toHaveAttribute(
      'data-state',
      'paused',
    );
    await expect(section('Themed player').locator('.t-video-player__central-play svg')).toHaveCSS(
      'background-color',
      'rgb(122, 62, 157)',
    );
  }

  async requestDemoToken(url: string): Promise<string> {
    const response = await this.page.request.get(url);
    expect(response.ok()).toBe(true);
    return (await response.json()).token;
  }

  async expectFirstChunkKind(kind: number): Promise<void> {
    await expect
      .poll(() =>
        this.page.evaluate(
          () =>
            (window as unknown as { __videoFixture: { firstKind?: number } }).__videoFixture
              .firstKind,
        ),
      )
      .toBe(kind);
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
