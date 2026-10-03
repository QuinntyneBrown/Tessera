import { expect, Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/** Owns the selectors and interactions of the production combobox test screen. */
export class ComboboxDemoPage {
  constructor(readonly page: Page) {}

  async open(scenario: Record<string, string | number | boolean> = {}): Promise<void> {
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
}
