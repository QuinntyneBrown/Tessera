import { expect, Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/** Owns selectors, browser DOM inspection, and interactions for the theme screen. */
export class ThemePage {
  constructor(private readonly page: Page) {}
  async open(course = 'multi-sco-12'): Promise<void> {
    const query = new URLSearchParams({
      screen: 'theme',
      course,
      ...(process.env['TESSERA_COURSE_ORIGIN']
        ? { courseOrigin: process.env['TESSERA_COURSE_ORIGIN'] }
        : {}),
    });
    await this.page.goto(`/?${query}`);
    if (course === 'multi-sco-12')
      await expect(
        this.page.getByRole('heading', { name: 'Three lessons', exact: true }),
      ).toBeVisible();
  }
  async choose(name: 'light' | 'dark' | 'custom' | 'system'): Promise<void> {
    // A host theme change must not send an outside click to the open popup.
    await this.page
      .locator('.theme-scope')
      .evaluate(
        (element, name) => element.dispatchEvent(new CustomEvent('theme-change', { detail: name })),
        name === 'system' ? 'clear' : name,
      );
  }
  async nestLight(): Promise<void> {
    await this.page.getByRole('button', { name: 'Set nested light theme' }).click();
  }
  async expectSample(color: string, nested = false): Promise<void> {
    await expect(
      this.page.getByText(nested ? 'Nested theme sample' : 'Theme sample', { exact: true }),
    ).toHaveCSS('color', color);
  }
  async expectUnrelatedStyle(): Promise<void> {
    await expect(this.page.locator('.theme-scope')).toHaveCSS('border-top-width', '7px');
  }
  async expectApiChecks(): Promise<void> {
    await expect(
      this.page
        .getByRole('status')
        .filter({ hasText: 'immutable inputs; supported tokens; unrelated styles preserved' }),
    ).toBeVisible();
  }
  async search(): Promise<void> {
    await this.page.getByRole('combobox', { name: 'Themed learners' }).fill('ad');
    await expect(this.page.getByRole('option', { name: 'Ada', exact: true })).toBeVisible();
  }
  async expectCombobox(color: string): Promise<void> {
    await expect(this.page.getByRole('combobox', { name: 'Themed learners' })).toHaveCSS(
      'color',
      color,
    );
    await expect(this.page.getByRole('option', { name: 'Ada', exact: true })).toHaveCSS(
      'color',
      color,
    );
  }
  async overrideCombobox(): Promise<void> {
    await this.page.locator('.theme-scope').dispatchEvent('legacy-theme-change');
  }
  async selectAda(): Promise<void> {
    await this.page.getByRole('option', { name: 'Ada', exact: true }).click();
  }
  async expectSelectionPreserved(): Promise<void> {
    await expect(this.page.getByRole('button', { name: 'Remove Ada', exact: true })).toBeVisible();
    await expect(this.page.getByRole('combobox', { name: 'Themed learners' })).toHaveValue('ad');
  }
  async expectFocusTheme(color: string): Promise<void> {
    await this.page.getByRole('combobox', { name: 'Themed learners' }).focus();
    await expect(this.page.locator('.t-combobox-field')).toHaveCSS('outline-color', color);
  }
  async useDetachedOverlays(): Promise<void> {
    await this.page.addInitScript(() => {
      delete (HTMLElement.prototype as unknown as Record<string, unknown>)['showPopover'];
    });
  }
  async expectPlayer(color: string, background: string): Promise<void> {
    await expect(this.page.locator('tsr-scorm-player')).toHaveCSS('color', color);
    await expect(this.page.locator('tsr-scorm-player')).toHaveCSS('background-color', background);
  }
  async nextByKeyboard(): Promise<void> {
    await this.page.getByRole('button', { name: 'Next', exact: true }).focus();
    await this.page.keyboard.press('Enter');
    await expect(this.page.getByRole('heading', { name: 'Lesson two', exact: true })).toBeVisible();
  }
  async expectPlayerFocus(color: string): Promise<void> {
    const button = this.page.getByRole('button', { name: 'Next', exact: true });
    await button.focus();
    await expect(button).toHaveCSS('outline-color', color);
    await expect(button).toBeFocused();
  }
  async expectCoursePresentationUnchanged(): Promise<void> {
    const course = this.page.frameLocator('iframe[title^="Course content"]').frameLocator('iframe');
    await expect(course.locator('body')).toHaveCSS('color', 'rgb(0, 0, 0)');
  }
  async expectPlayerError(): Promise<void> {
    await expect(this.page.getByRole('alert')).toBeVisible();
  }
  async expectErrorColor(): Promise<void> {
    await expect(this.page.getByRole('alert')).toHaveCSS('color', 'rgb(255, 180, 168)');
  }
  async holdManifest(): Promise<() => void> {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    await this.page.route('**/imsmanifest.xml', async (route) => {
      await gate;
      await route.continue();
    });
    return release;
  }
  async expectLoading(): Promise<void> {
    await expect(this.page.getByRole('status').filter({ hasText: 'Loading course' })).toBeVisible();
  }
  async expectAccessible(): Promise<void> {
    const result = await new AxeBuilder({ page: this.page })
      .include('tsr-scorm-player')
      .include('t-combobox')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(result.violations).toEqual([]);
  }
  async expectContrast(): Promise<void> {
    const samples = await this.page.locator('tsr-scorm-player, t-combobox').evaluateAll((hosts) =>
      hosts.flatMap((host) => {
        const style = getComputedStyle(host);
        const pairs = [{ foreground: style.color, background: style.backgroundColor, ratio: 4.5 }];
        for (const button of Array.from(host.querySelectorAll('button'))) {
          if (!button.getBoundingClientRect().height) continue;
          const css = getComputedStyle(button);
          pairs.push({
            foreground: css.color,
            background:
              css.backgroundColor === 'rgba(0, 0, 0, 0)'
                ? style.backgroundColor
                : css.backgroundColor,
            ratio: button.textContent?.trim() ? 4.5 : 3,
          });
          if (button.matches(':focus-visible'))
            pairs.push({
              foreground: css.outlineColor,
              background: style.backgroundColor,
              ratio: 3,
            });
        }
        return pairs;
      }),
    );
    const luminance = (color: string) => {
      const rgb = color
        .match(/[\d.]+/g)!
        .slice(0, 3)
        .map(Number)
        .map((value) => {
          const s = value / 255;
          return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
        });
      return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
    };
    for (const sample of samples) {
      const a = luminance(sample.foreground),
        b = luminance(sample.background);
      expect(
        (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05),
        `${sample.foreground} against ${sample.background}`,
      ).toBeGreaterThanOrEqual(sample.ratio);
    }
  }
  async useViewport(width: number): Promise<void> {
    await this.page.setViewportSize({ width, height: 800 });
  }
  async enlargeText(): Promise<void> {
    await this.page.addStyleTag({ content: 'html {font-size: 200% !important;}' });
  }
  async applyTextSpacing(): Promise<void> {
    await this.page.addStyleTag({
      content:
        '* {line-height:1.5 !important; letter-spacing:.12em !important; word-spacing:.16em !important;} p {margin-bottom:2em !important;}',
    });
  }
  async expectReflow(): Promise<void> {
    await expect
      .poll(() => this.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      .toBe(true);
    for (const button of await this.page
      .locator('tsr-scorm-player button:visible, t-combobox button:visible')
      .all()) {
      const box = await button.boundingBox();
      expect(box!.width).toBeGreaterThanOrEqual(24);
      expect(box!.height).toBeGreaterThanOrEqual(24);
    }
  }
  async expectForcedColors(): Promise<void> {
    const expected = await this.page.evaluate(() => {
      const sample = document.createElement('span');
      sample.style.color = 'CanvasText';
      document.body.appendChild(sample);
      const color = getComputedStyle(sample).color;
      sample.remove();
      return color;
    });
    await expect(this.page.locator('tsr-scorm-player')).toHaveCSS('color', expected);
    await expect(this.page.getByRole('combobox', { name: 'Themed learners' })).toHaveCSS(
      'color',
      expected,
    );
  }
}
