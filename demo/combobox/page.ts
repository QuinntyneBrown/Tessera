import { expect, Page } from '@playwright/test';

/** Selectors, user actions and observable outcomes for the shared combobox examples screen. */
export class ComboboxExamplesDemoPage {
  private errors: string[] = [];
  constructor(private readonly page: Page) {
    page.on('pageerror', (error) => this.errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') this.errors.push(message.text());
    });
  }
  input(name: string) {
    return this.page.getByRole('combobox', { name: `${name} learners`, exact: true });
  }
  field(name: string) {
    return this.page.locator('t-combobox').filter({ has: this.input(name) });
  }
  async open() {
    await this.page.goto('/?screen=combobox-examples');
    await expect(
      this.page.getByRole('heading', { name: 'Combobox examples', exact: true }),
    ).toBeVisible();
    await expect(this.page.getByRole('combobox')).toHaveCount(5);
  }
  async show(name: string) {
    await this.input(name).evaluate((node) =>
      node.closest('section')!.scrollIntoView({ block: 'center', behavior: 'instant' }),
    );
  }
  async search(name: string, text: string) {
    await this.input(name).click();
    await this.input(name).fill('');
    await this.input(name).pressSequentially(text, { delay: 160 });
  }
  async results(labels: string[]) {
    await expect(this.page.getByRole('option')).toHaveText(labels);
  }
  async select(label: string) {
    await this.page.getByRole('option', { name: label, exact: true }).click();
  }
  async value(name: string, text: string) {
    await expect(this.page.getByRole('status', { name: `${name} value`, exact: true })).toHaveText(
      text,
    );
  }
  async chips(name: string, labels: string[]) {
    await expect(this.field(name).locator('.t-combobox-chip-label')).toHaveText(labels);
  }
  async focused(name: string) {
    await expect(this.input(name)).toBeFocused();
  }
  async key(key: string) {
    await this.page.keyboard.press(key);
  }
  async focusChip(name: string, label: string) {
    await expect(
      this.field(name).getByRole('button', { name: `Remove ${label}`, exact: true }),
    ).toBeFocused();
  }
  async active(name: string, label: string) {
    const id = await this.page.getByRole('option', { name: label, exact: true }).getAttribute('id');
    await expect(this.input(name)).toHaveAttribute('aria-activedescendant', id!);
  }
  async selected(label: string, selected: boolean) {
    await expect(this.page.getByRole('option', { name: label, exact: true })).toHaveAttribute(
      'aria-selected',
      String(selected),
    );
  }
  async close(name: string) {
    await this.input(name).press('Escape');
    await expect(this.input(name)).toHaveAttribute('aria-expanded', 'false');
  }
  async clear(name: string) {
    await this.field(name)
      .getByRole('button', { name: 'Clear all selections', exact: true })
      .click();
  }
  async customChip(label: string) {
    await expect(
      this.field('Custom').locator('.t-combobox-chip-label strong').filter({ hasText: label }),
    ).toBeVisible();
  }
  async empty(text: string) {
    await expect(this.page.getByText(text, { exact: true })).toBeVisible();
    await expect(this.page.getByRole('option')).toHaveCount(0);
  }
  async loadMore() {
    await this.page.getByRole('button', { name: 'Load more results', exact: true }).click();
  }
  async healthy() {
    expect(this.errors).toEqual([]);
  }
}
