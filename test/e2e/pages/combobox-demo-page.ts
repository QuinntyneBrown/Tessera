import { expect, Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/** Owns the selectors and interactions of the production combobox test screen. */
export class ComboboxDemoPage {
  private readonly requests: string[] = [];
  private readonly cancellations: string[] = [];
  private readonly errors: string[] = [];
  private readonly events: string[] = [];

  constructor(readonly page: Page) {
    page.setDefaultTimeout(5000);
    page.on('pageerror', (error) => this.errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') this.errors.push(message.text());
      const prefix = 'combobox-fixture-request:';
      if (message.text().startsWith(prefix))
        this.requests.push(message.text().slice(prefix.length));
      const cancelPrefix = 'combobox-fixture-cancelled:';
      if (message.text().startsWith(cancelPrefix))
        this.cancellations.push(message.text().slice(cancelPrefix.length));
      const eventPrefix = 'combobox-fixture-event:';
      if (message.text().startsWith(eventPrefix))
        this.events.push(message.text().slice(eventPrefix.length));
    });
  }

  async open(
    scenario: Record<string, string | number | boolean> = {},
    realTime = false,
  ): Promise<void> {
    if (!realTime) await this.page.clock.install();
    const parameters = new URLSearchParams({ screen: 'combobox' });
    for (const [key, value] of Object.entries(scenario)) parameters.set(key, String(value));
    await this.page.goto('/?' + parameters.toString());
  }

  async expectClosedNamedInput(): Promise<void> {
    const input = this.page.getByRole('combobox', { name: 'Learners', exact: true });
    await expect(input).toBeVisible();
    await expect(input).toHaveAttribute('aria-autocomplete', 'list');
    await expect(input).toHaveAttribute('aria-expanded', 'false');
    await expect(input).toHaveAttribute('autocomplete', 'off');
  }

  async expectNoAccessibilityViolations(): Promise<void> {
    expect(this.errors).toEqual([]);
    const result = await new AxeBuilder({ page: this.page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(result.violations).toEqual([]);
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

  async typeText(text: string): Promise<void> {
    await this.page.getByRole('combobox', { name: 'Learners', exact: true }).fill(text);
  }

  async expectRequests(requests: string[]): Promise<void> {
    await expect.poll(() => this.requests).toEqual(requests);
  }

  async compose(text: string, end = false): Promise<void> {
    const input = this.page.getByRole('combobox', { name: 'Learners', exact: true });
    if (!end) await input.dispatchEvent('compositionstart');
    await input.fill(text);
    if (end) await input.dispatchEvent('compositionend', { data: text });
  }

  async expectOptions(labels: string[]): Promise<void> {
    await expect(this.page.getByRole('option')).toHaveText(labels);
  }

  async expectCancellations(requests: string[]): Promise<void> {
    await expect.poll(() => this.cancellations).toEqual(requests);
  }

  async expectLoading(loading: boolean): Promise<void> {
    await expect(this.page.getByRole('listbox')).toHaveAttribute('aria-busy', String(loading));
    if (loading) await expect(this.page.getByText('Loading', { exact: true })).toBeVisible();
    else await expect(this.page.getByText('Loading', { exact: true })).toHaveCount(0);
  }

  async expectSearchError(): Promise<void> {
    await expect(this.page.getByRole('button', { name: 'Retry', exact: true })).toBeVisible();
    expect(this.errors).toEqual([]);
  }

  async retry(): Promise<void> {
    await this.page.getByRole('button', { name: 'Retry', exact: true }).click();
  }

  async expectLoadMoreDisabled(): Promise<void> {
    const action = this.page.getByRole('button', { name: 'Load more results', exact: true });
    await expect(action).toBeVisible();
    await expect(action).toBeDisabled();
  }

  async expectMessage(message: string): Promise<void> {
    await expect(this.page.getByText(message, { exact: true })).toBeVisible();
  }

  async toggleOption(label: string): Promise<void> {
    const option = this.page.getByRole('option', { name: label, exact: true });
    if ((await option.getAttribute('aria-disabled')) !== 'true') await option.click();
    else {
      // aria-disabled does not suppress browser pointer events. Exercise the component's guard.
      await option.scrollIntoViewIfNeeded();
      const box = await option.boundingBox();
      expect(box).not.toBeNull();
      await this.page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2);
    }
  }

  async expectSelected(label: string, selected: boolean): Promise<void> {
    await expect(this.page.getByRole('option', { name: label, exact: true })).toHaveAttribute(
      'aria-selected',
      String(selected),
    );
  }

  async expectOptionDisabled(label: string, disabled: boolean): Promise<void> {
    await expect(this.page.getByRole('option', { name: label, exact: true })).toHaveAttribute(
      'aria-disabled',
      String(disabled),
    );
  }

  async expectInput(text: string): Promise<void> {
    const input = this.page.getByRole('combobox', { name: 'Learners', exact: true });
    await expect(input).toHaveValue(text);
    await expect(input).toBeFocused();
  }

  async expectActiveOption(label: string | null): Promise<void> {
    const input = this.page.getByRole('combobox', { name: 'Learners', exact: true });
    if (label === null) await expect(input).not.toHaveAttribute('aria-activedescendant', /.+/);
    else {
      const option = this.page.getByRole('option', { name: label, exact: true });
      await expect(option).toHaveAttribute('id', /.+/);
      await expect(input).toHaveAttribute(
        'aria-activedescendant',
        (await option.getAttribute('id'))!,
      );
    }
    await expect(input).toBeFocused();
  }

  async expectSubmissions(count: number): Promise<void> {
    await expect(this.page.getByRole('status', { name: 'Submit count', exact: true })).toHaveText(
      String(count),
    );
  }

  async focusChip(label: string): Promise<void> {
    await this.page.getByRole('button', { name: `Remove ${label}`, exact: true }).focus();
  }

  async expectAncestorEscapes(count: number): Promise<void> {
    await expect(
      this.page.getByRole('status', { name: 'Ancestor escapes', exact: true }),
    ).toHaveText(String(count));
  }

  async setDisabled(disabled: boolean): Promise<void> {
    await this.page
      .getByRole('button', { name: disabled ? 'Disable field' : 'Enable field', exact: true })
      .click();
  }

  async expectDisabled(disabled: boolean): Promise<void> {
    const input = this.page.getByRole('combobox');
    if (disabled) await expect(input).toBeDisabled();
    else await expect(input).toBeEnabled();
    const buttons = this.page.locator('t-combobox button');
    for (const button of await buttons.all()) {
      if (disabled) await expect(button).toBeDisabled();
      else await expect(button).toBeEnabled();
    }
  }

  async expectBoundValue(value: unknown[]): Promise<void> {
    await expect(this.page.getByRole('status', { name: 'Bound value', exact: true })).toHaveText(
      JSON.stringify(value),
    );
  }

  async expectFormState(state: Record<string, unknown>): Promise<void> {
    await expect
      .poll(async () =>
        JSON.parse(
          (await this.page.getByRole('status', { name: 'Form state', exact: true }).textContent())!,
        ),
      )
      .toMatchObject(state);
  }

  async resetForm(): Promise<void> {
    await this.page.getByRole('button', { name: 'Reset form', exact: true }).click();
  }

  async changeConfiguration(): Promise<void> {
    await this.page.getByRole('button', { name: 'Change configuration', exact: true }).click();
  }

  async writeExternal(source: 'model' | 'control'): Promise<void> {
    await this.page.getByRole('button', { name: `Write ${source}`, exact: true }).click();
  }

  async replaceControl(): Promise<void> {
    await this.page.getByRole('button', { name: 'Replace control', exact: true }).click();
  }

  async disableOldControl(): Promise<void> {
    await this.page.getByRole('button', { name: 'Disable old control', exact: true }).click();
  }

  async submitForm(): Promise<void> {
    if ((await this.page.getByRole('combobox').getAttribute('aria-expanded')) === 'true')
      await this.closeList('outside');
    await this.page.getByRole('button', { name: 'Submit selection', exact: true }).click();
  }

  async expectModelValue(value: unknown[]): Promise<void> {
    await expect(this.page.getByRole('status', { name: 'Model value', exact: true })).toHaveText(
      JSON.stringify(value),
    );
  }

  async expectIntegrationError(fragment: string): Promise<void> {
    await expect.poll(() => this.errors.join(' ')).toContain(fragment);
  }

  async setMounted(mounted: boolean): Promise<void> {
    await this.page
      .getByRole('button', { name: mounted ? 'Mount field' : 'Unmount field', exact: true })
      .click();
    await expect(this.page.getByRole('combobox')).toHaveCount(mounted ? 1 : 0);
  }

  async verifyHarnessContract(): Promise<void> {
    await this.page.getByRole('button', { name: 'Run harness contract', exact: true }).click();
    await expect(
      this.page.getByRole('status', { name: 'Harness contract', exact: true }),
    ).toHaveText(
      JSON.stringify({
        closed: false,
        opened: true,
        options: [
          { label: 'Ada', selected: true, disabled: false },
          { label: 'Grace', selected: false, disabled: false },
          { label: 'Linus', selected: false, disabled: true },
        ],
        chips: ['Ada', 'Grace'],
        remaining: ['Grace'],
        afterDisabled: ['Grace'],
        missing: true,
        otherOpen: false,
      }),
    );
  }

  async openExamples(): Promise<void> {
    await this.page.goto('/?screen=combobox-examples');
  }

  async verifyPackedConsumer(): Promise<void> {
    await this.page.goto('/');
    const input = this.page.getByRole('combobox', { name: 'Packed learners', exact: true });
    await input.fill('ad');
    await this.page.getByRole('option', { name: 'Ada', exact: true }).click();
    await expect(this.page.getByRole('status', { name: 'Packed value', exact: true })).toHaveText(
      'Ada',
    );
    await expect(input).toBeFocused();
  }

  async verifyExamples(): Promise<void> {
    await expect(
      this.page.getByRole('heading', { name: 'Combobox examples', exact: true }),
    ).toBeVisible();
    await expect(this.page.getByRole('combobox')).toHaveCount(5);
    for (const name of ['Reactive', 'Template', 'Model']) {
      const input = this.page.getByRole('combobox', { name: `${name} learners`, exact: true });
      await input.fill('ad');
      await this.page.getByRole('option', { name: 'Ada', exact: true }).click();
      await expect(
        this.page.getByRole('status', { name: `${name} value`, exact: true }),
      ).toHaveText('Ada');
      await input.press('Escape');
    }
    await expect(this.page.getByRole('button', { name: 'Remove Ada', exact: true })).toHaveCount(4);
    await this.page.getByRole('combobox', { name: 'Paging learners', exact: true }).fill('a');
    await expect(this.page.getByRole('option')).toHaveCount(3);
    await this.loadMore();
    await expect(this.page.getByRole('option')).toHaveCount(6);
  }

  async expectDisposed(): Promise<void> {
    await expect(this.page.locator('.cdk-overlay-pane')).toHaveCount(0);
    await expect(this.page.locator('[aria-live]')).toHaveCount(0);
  }

  async documentListenerCount(): Promise<number> {
    const session = await this.page.context().newCDPSession(this.page);
    let total = 0;
    for (const expression of ['document', 'document.body', 'window', 'window.visualViewport']) {
      const { result } = await session.send('Runtime.evaluate', { expression });
      if (result.objectId)
        total += (
          await session.send('DOMDebugger.getEventListeners', { objectId: result.objectId })
        ).listeners.length;
    }
    await session.detach();
    return total;
  }

  async emitLaterEvents(): Promise<void> {
    await this.page.evaluate(() => {
      window.dispatchEvent(new Event('resize'));
      document.dispatchEvent(new Event('scroll'));
      document.body.click();
    });
    await this.elapse(5000);
  }

  async tapOption(label: string): Promise<void> {
    await this.page.getByRole('option', { name: label, exact: true }).tap();
  }
  async tapOutside(): Promise<void> {
    await this.page.getByRole('heading', { name: 'Assign learners', exact: true }).tap();
  }
  async tapToggle(): Promise<void> {
    await this.page.getByRole('button', { name: 'Show options', exact: true }).tap();
  }

  async focusOutside(): Promise<void> {
    await this.page.getByRole('button', { name: 'Submit selection', exact: true }).focus();
  }

  async expectRequired(required: boolean, invalid: boolean): Promise<void> {
    const input = this.page.getByRole('combobox');
    await expect(input).toHaveAttribute('aria-required', String(required));
    await expect(input).toHaveAttribute('aria-invalid', String(invalid));
  }

  async expectDescriptions(texts: string[]): Promise<void> {
    await expect
      .poll(() =>
        this.page.getByRole('combobox').evaluate((input) =>
          (input.getAttribute('aria-describedby') || '')
            .split(' ')
            .filter(Boolean)
            .map((id) => document.getElementById(id)?.textContent?.trim()),
        ),
      )
      .toEqual(texts);
  }

  async loadMore(): Promise<void> {
    await this.page.getByRole('button', { name: 'Load more results', exact: true }).click();
  }

  async scrollResultsToEnd(): Promise<void> {
    await this.page.getByRole('listbox').evaluate((list) => {
      list.scrollTop = list.scrollHeight;
      list.dispatchEvent(new Event('scroll'));
    });
  }

  async expectOptionPositions(total: number | null): Promise<void> {
    const options = this.page.getByRole('option');
    for (let index = 0; index < (await options.count()); index++) {
      if (total === null) {
        await expect(options.nth(index)).not.toHaveAttribute('aria-setsize', /.+/);
        await expect(options.nth(index)).not.toHaveAttribute('aria-posinset', /.+/);
      } else {
        await expect(options.nth(index)).toHaveAttribute('aria-setsize', String(total));
        await expect(options.nth(index)).toHaveAttribute('aria-posinset', String(index + 1));
      }
    }
  }

  async useViewport(width: number, height = 900): Promise<void> {
    await this.page.setViewportSize({ width, height });
  }

  async disablePopoverSupport(): Promise<void> {
    await this.page.addInitScript(() => {
      delete (HTMLElement.prototype as unknown as Record<string, unknown>)['showPopover'];
      delete (HTMLElement.prototype as unknown as Record<string, unknown>)['hidePopover'];
    });
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

  async expectResponsiveField(): Promise<void> {
    await expect
      .poll(() => this.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      .toBe(true);
    const list = this.page.getByRole('list', { name: 'Selected values', exact: true });
    const metrics = await list.evaluate((element) => ({
      height: element.getBoundingClientRect().height,
      scrollHeight: element.scrollHeight,
      rootSize: parseFloat(getComputedStyle(document.documentElement).fontSize),
    }));
    expect(metrics.height).toBeLessThanOrEqual(8 * metrics.rootSize + 2);
    expect(metrics.scrollHeight).toBeGreaterThan(metrics.height);
    const input = await this.page.getByRole('combobox').boundingBox();
    expect(input!.width).toBeGreaterThan(24);
    const targets = this.page.locator('t-combobox button, t-combobox [role="option"]');
    for (const target of await targets.all()) {
      const box = await target.boundingBox();
      expect(box!.width).toBeGreaterThanOrEqual(24);
      expect(box!.height).toBeGreaterThanOrEqual(24);
    }
  }

  async emulateAccessibilityMedia(): Promise<void> {
    await this.page.emulateMedia({ forcedColors: 'active', reducedMotion: 'reduce' });
  }

  async hoverChip(label: string): Promise<void> {
    await this.page
      .getByRole('list', { name: 'Selected values', exact: true })
      .getByRole('listitem')
      .filter({ has: this.page.getByRole('button', { name: `Remove ${label}`, exact: true }) })
      .hover();
  }

  async hoverTooltip(): Promise<void> {
    await this.page.getByRole('tooltip').hover();
  }

  async expectTooltip(label: string | null): Promise<void> {
    if (label === null) await expect(this.page.getByRole('tooltip')).toHaveCount(0);
    else await expect(this.page.getByRole('tooltip')).toHaveText(label);
  }

  async resizeContainer(width: number): Promise<void> {
    await this.page.locator('.fixture-container').evaluate((element, size) => {
      (element as HTMLElement).style.width = `${size}px`;
    }, width);
  }

  async scrollAncestor(): Promise<void> {
    await this.page.locator('.fixture-container').evaluate((element) => {
      element.scrollTop = 60;
    });
  }

  async expectPopupGeometry(): Promise<void> {
    await expect
      .poll(() =>
        this.page.getByRole('combobox').evaluate((input) => {
          const field = input.closest('.t-combobox-field')!.getBoundingClientRect();
          const panel = input
            .closest('t-combobox')!
            .querySelector('.t-combobox-panel')!
            .getBoundingClientRect();
          const row = input.getBoundingClientRect();
          const inputRow = input.closest('.t-combobox-input-row')!.getBoundingClientRect();
          return (
            Math.abs(panel.width - field.width) < 2 &&
            Math.abs(panel.left - field.left) < 2 &&
            Math.min(
              Math.abs(panel.top - field.bottom),
              Math.abs(panel.bottom - field.top),
              Math.abs(panel.top - inputRow.bottom),
              Math.abs(panel.bottom - inputRow.top),
            ) < 2 &&
            (panel.bottom <= row.top + 1 || panel.top >= row.bottom - 1) &&
            panel.top >= -1 &&
            panel.bottom <= innerHeight + 1 &&
            row.top >= 0 &&
            row.bottom <= innerHeight
          );
        }),
      )
      .toBe(true);
  }

  async expectInputAndSelectionRetained(): Promise<void> {
    await this.expectInput('ad');
    await this.expectSelected('Ada', true);
  }

  async expectThemedPopup(): Promise<void> {
    const surface = await this.page
      .locator('t-combobox')
      .evaluate((host) => getComputedStyle(host).backgroundColor);
    await expect(this.page.getByRole('listbox').locator('..')).toHaveCSS(
      'background-color',
      surface,
    );
  }

  async expectLiteralRendering(label: string): Promise<void> {
    await expect(this.page.locator('t-combobox img')).toHaveCount(0);
    expect(
      await this.page.evaluate(() => (window as unknown as { __xss?: unknown }).__xss),
    ).toBeUndefined();
    await this.expectDescriptions([`1 selected: ${label}`]);
    await this.expectNamedButton(`Remove ${label}`);
  }

  async verifyInstanceIds(): Promise<void> {
    await this.page.getByRole('combobox', { name: 'Other learners', exact: true }).fill('gr');
    await expect(this.page.getByRole('option')).toHaveCount(6);
    const ids = await this.page
      .locator('t-combobox [id]')
      .evaluateAll((elements) => elements.map((element) => element.id));
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every((id) => !/[\s<>"']/.test(id))).toBe(true);
    const controls = await this.page
      .getByRole('combobox')
      .evaluateAll((inputs) => inputs.map((input) => input.getAttribute('aria-controls')));
    expect(new Set(controls).size).toBe(2);
  }

  async expectContrast(): Promise<void> {
    const samples = await this.page.locator('t-combobox').evaluate((host) => {
      const panel = host.querySelector('.t-combobox-panel')!;
      const field = host.querySelector('.t-combobox-field')!;
      const chip = host.querySelector('.t-combobox-chip')!;
      const selected = host.querySelector('[aria-selected="true"] .t-combobox-checkbox')!;
      const color = (element: Element, property: string) =>
        getComputedStyle(element).getPropertyValue(property);
      const surface = color(host, 'background-color'),
        chipSurface = color(chip, 'background-color');
      return [
        { a: color(host, 'color'), b: surface, ratio: 4.5 },
        { a: color(chip, 'color'), b: chipSurface, ratio: 4.5 },
        { a: color(field, 'border-top-color'), b: surface, ratio: 3 },
        { a: color(chip, 'border-top-color'), b: chipSurface, ratio: 3 },
        { a: color(panel, 'color'), b: color(panel, 'background-color'), ratio: 4.5 },
        {
          a: color(host.querySelector('[aria-disabled="true"]')!, 'color'),
          b: color(panel, 'background-color'),
          ratio: 4.5,
        },
        { a: color(selected, 'background-color'), b: color(panel, 'background-color'), ratio: 3 },
        { a: color(selected, 'color'), b: color(selected, 'background-color'), ratio: 3 },
        {
          a: color(host.querySelector('button:focus-visible')!, 'outline-color'),
          b: chipSurface,
          ratio: 3,
        },
      ];
    });
    const luminance = (color: string) => {
      const rgb = color
        .match(/[\d.]+/g)!
        .slice(0, 3)
        .map(Number)
        .map((v) => {
          const s = v / 255;
          return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
        });
      return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
    };
    for (const sample of samples) {
      const a = luminance(sample.a),
        b = luminance(sample.b);
      expect(
        (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05),
        `${sample.a} against ${sample.b}`,
      ).toBeGreaterThanOrEqual(sample.ratio);
    }
  }

  async typeBurst(): Promise<void> {
    await this.freezeTime();
    for (let i = 1; i <= 10; i++) {
      await this.typeText('abcdefghij'.slice(0, i));
      await this.elapse(50);
    }
    await this.expectRequests([]);
    await this.elapse(250);
    await this.expectRequests(['abcdefghij:0']);
    await this.resumeTime();
  }

  private async measureKey(
    key: string,
    expected: { value?: string; index?: number; selected?: boolean },
  ): Promise<number> {
    await this.page.getByRole('combobox').evaluate((input, expected) => {
      (window as unknown as { comboboxMeasurement: Promise<number> }).comboboxMeasurement =
        new Promise((resolve) => {
          input.addEventListener(
            'keydown',
            () => {
              const start = performance.now();
              const frame = () => {
                const options = Array.from(
                  input.closest('t-combobox')!.querySelectorAll('[role="option"]'),
                );
                const matches =
                  expected.value !== undefined
                    ? (input as HTMLInputElement).value === expected.value
                    : expected.index !== undefined
                      ? input.getAttribute('aria-activedescendant') === options[expected.index]?.id
                      : options[0]?.getAttribute('aria-selected') === String(expected.selected);
                if (matches || performance.now() - start > 2000) {
                  const duration = performance.now() - start;
                  requestAnimationFrame(() => resolve(duration));
                } else requestAnimationFrame(frame);
              };
              requestAnimationFrame(frame);
            },
            { once: true, capture: true },
          );
        });
    }, expected);
    await this.pressKey(key);
    return this.page.evaluate(
      () => (window as unknown as { comboboxMeasurement: Promise<number> }).comboboxMeasurement,
    );
  }

  expectTimings(durations: number[], limit: number): void {
    expect(durations).toHaveLength(100);
    expect(
      durations.filter((duration) => duration <= limit).length,
      `${durations.filter((d) => d <= limit).length}/100 within ${limit}ms; max ${Math.max(...durations).toFixed(1)}ms`,
    ).toBeGreaterThanOrEqual(95);
  }

  async measureTyping(): Promise<number[]> {
    await this.typeText('ad');
    await this.expectRequests(['ad:0']);
    let text = 'ad';
    const durations: number[] = [];
    for (let i = 0; i < 110; i++) {
      text += 'x';
      const duration = await this.measureKey('x', { value: text });
      if (i >= 10) durations.push(duration);
    }
    return durations;
  }

  async measureRendering(): Promise<number[]> {
    const session = await this.page.context().newCDPSession(this.page);
    await session.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    const durations: number[] = [];
    try {
      for (let i = 0; i < 110; i++) {
        const query = `run${i}`;
        await this.typeText(query);
        const duration = await this.page.evaluate(
          (query) =>
            new Promise<number>((resolve) => {
              const frame = () => {
                const emission = (
                  window as unknown as { comboboxEmission?: { query: string; time: number } }
                ).comboboxEmission;
                const options = document.querySelectorAll('[role="option"]');
                if (
                  emission?.query === query &&
                  options.length === 50 &&
                  options[49].textContent?.includes(`Result ${query} 50`)
                ) {
                  const elapsed = performance.now() - emission.time;
                  requestAnimationFrame(() => resolve(elapsed));
                } else requestAnimationFrame(frame);
              };
              requestAnimationFrame(frame);
            }),
          query,
        );
        if (i >= 10) durations.push(duration);
      }
      return durations;
    } finally {
      await session.send('Emulation.setCPUThrottlingRate', { rate: 1 });
      await session.detach();
    }
  }

  async measureToggling(): Promise<number[]> {
    await this.typeText('ad');
    await expect(this.page.getByRole('option')).toHaveCount(50);
    const session = await this.page.context().newCDPSession(this.page);
    await session.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    const durations: number[] = [];
    try {
      for (let i = 0; i < 110; i++) {
        const duration = await this.measureKey('Enter', { selected: i % 2 === 0 });
        if (i >= 10) durations.push(duration);
      }
      return durations;
    } finally {
      await session.send('Emulation.setCPUThrottlingRate', { rate: 1 });
      await session.detach();
    }
  }

  async measureNavigation(): Promise<number[]> {
    await this.typeText('ad');
    await expect(this.page.getByRole('option')).toHaveCount(50);
    for (let p = 2; p <= 5; p++) {
      await this.loadMore();
      await expect(this.page.getByRole('option')).toHaveCount(p * 50);
    }
    const durations: number[] = [];
    for (let i = 1; i <= 110; i++) {
      const duration = await this.measureKey('ArrowDown', { index: i });
      if (i > 10) durations.push(duration);
    }
    return durations;
  }

  async expectVisibleStates(): Promise<void> {
    const disabled = this.page.getByRole('option', { name: 'Grace', exact: true });
    await expect(disabled).toHaveCSS('font-style', 'italic');
    const active = this.page.getByRole('option', { name: 'Ada', exact: true });
    await expect(active).toHaveCSS('outline-style', 'solid');
    const button = this.page.getByRole('button', { name: 'Remove Ada', exact: true });
    await button.focus();
    await expect(button).toHaveCSS('outline-style', 'solid');
    await expect(button).toHaveCSS('outline-width', '2px');
    const animation = await active.evaluate((element) => ({
      animation: getComputedStyle(element).animationDuration,
      transition: getComputedStyle(element).transitionDuration,
    }));
    expect(animation).toEqual({ animation: '0s', transition: '0s' });
  }

  async expectChips(labels: string[], name = 'Selected values'): Promise<void> {
    await expect(
      this.page.getByRole('list', { name, exact: true }).getByRole('listitem'),
    ).toHaveText(labels);
  }

  async expectNamedButton(name: string): Promise<void> {
    await expect(this.page.getByRole('button', { name, exact: true })).toBeVisible();
  }

  async removeChip(label: string): Promise<void> {
    await this.page.getByRole('button', { name: `Remove ${label}`, exact: true }).click();
  }

  async expectFocusedRemoval(label: string): Promise<void> {
    await expect(
      this.page.getByRole('button', { name: `Remove ${label}`, exact: true }),
    ).toBeFocused();
  }

  async clearAll(): Promise<void> {
    // The below-field action can lie behind the open results panel. Dismiss it first.
    if ((await this.page.getByRole('combobox').getAttribute('aria-expanded')) === 'true')
      await this.closeList('Escape');
    await this.page.getByRole('button', { name: 'Clear all selections', exact: true }).click();
  }

  async expectAnnouncement(text: string, priority: string = 'polite'): Promise<void> {
    const live = this.page.locator('t-combobox [aria-live]');
    await expect(live).toHaveCount(1);
    await expect(live).toHaveAttribute('aria-live', priority);
    await expect(live).toHaveText(text);
  }

  async observeAnnouncements(): Promise<void> {
    await this.page.locator('t-combobox [aria-live]').evaluate((region) => {
      const state = window as unknown as { comboboxMessages: string[] };
      state.comboboxMessages = [];
      new MutationObserver(() => {
        const text = region.textContent?.trim();
        if (text) state.comboboxMessages.push(text);
      }).observe(region, { childList: true, characterData: true, subtree: true });
    });
  }

  async expectAnnouncementHistory(messages: string[]): Promise<void> {
    await expect
      .poll(() =>
        this.page.evaluate(
          () => (window as unknown as { comboboxMessages: string[] }).comboboxMessages,
        ),
      )
      .toEqual(messages);
  }

  async focusInput(): Promise<void> {
    await this.page.getByRole('combobox', { name: 'Learners', exact: true }).focus();
  }

  async moveCursorByPointer(): Promise<void> {
    const input = this.page.getByRole('combobox', { name: 'Learners', exact: true });
    const bounds = await input.boundingBox();
    await input.click({ position: { x: bounds!.width - 10, y: bounds!.height / 2 } });
  }

  async pressKey(key: string): Promise<void> {
    await this.page.keyboard.press(key);
  }

  async openList(trigger: string = 'field'): Promise<void> {
    if (trigger === 'field')
      await this.page.getByRole('combobox', { name: 'Learners', exact: true }).click();
    else if (trigger === 'toggle')
      await this.page.getByRole('button', { name: 'Show options', exact: true }).click();
    else {
      await this.focusInput();
      await this.pressKey(trigger);
    }
  }

  async closeList(trigger: string): Promise<void> {
    if (trigger === 'outside')
      await this.page.getByRole('heading', { name: 'Assign learners', exact: true }).click();
    else if (trigger === 'toggle')
      await this.page.getByRole('button', { name: 'Hide options', exact: true }).click();
    else await this.pressKey(trigger);
  }

  async expectExpanded(open: boolean): Promise<void> {
    await expect(
      this.page.getByRole('combobox', { name: 'Learners', exact: true }),
    ).toHaveAttribute('aria-expanded', String(open));
    await expect(this.page.getByRole('listbox')).toHaveCount(open ? 1 : 0);
  }

  async expectEvents(events: string[], kind?: string): Promise<void> {
    await expect
      .poll(() =>
        this.events.filter(
          (entry) =>
            !kind ||
            (kind === 'transition'
              ? entry === 'opened' || entry === 'closed'
              : entry.startsWith(kind)),
        ),
      )
      .toEqual(events);
  }

  async expectOpenPopup(): Promise<void> {
    const input = this.page.getByRole('combobox', { name: 'Learners', exact: true });
    await expect(input).toHaveAttribute('aria-expanded', 'true');
    await expect(input).toBeFocused();
    const list = this.page.getByRole('listbox', { name: 'Learners', exact: true });
    await expect(list).toHaveAttribute('aria-multiselectable', 'true');
    const id = await list.getAttribute('id');
    await expect(input).toHaveAttribute('aria-controls', id!);
    expect(await list.evaluate((node) => !!node.closest('t-combobox'))).toBe(true);
  }
}
