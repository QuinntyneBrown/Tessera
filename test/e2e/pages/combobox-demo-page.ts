import { expect, Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/** Owns the selectors and interactions of the production combobox test screen. */
export class ComboboxDemoPage {
  private readonly requests: string[] = [];

  constructor(readonly page: Page) {
    page.on('console', (message) => {
      const prefix = 'combobox-fixture-request:';
      if (message.text().startsWith(prefix))
        this.requests.push(message.text().slice(prefix.length));
    });
  }

  async open(scenario: Record<string, string | number | boolean> = {}): Promise<void> {
    await this.page.clock.install();
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
}
