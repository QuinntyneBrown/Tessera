import { ComponentHarness, TestElement } from '@angular/cdk/testing';

/** State of a rendered result, in navigation order. */
export interface ComboboxOptionState {
  label: string;
  selected: boolean;
  disabled: boolean;
}

/** Consumer test API. Search timing follows the consumer's harness environment. */
export class ComboboxHarness extends ComponentHarness {
  static hostSelector = 't-combobox';
  private readonly input = this.locatorFor('[role="combobox"]');
  private readonly chipLabels = this.locatorForAll('.t-combobox-chip-label');
  private readonly chipButtons = this.locatorForAll('.t-combobox-chip button');

  async isOpen(): Promise<boolean> {
    return (await this.input()).getAttribute('aria-expanded').then((value) => value === 'true');
  }
  async open(): Promise<void> {
    if (!(await this.isOpen())) await (await this.input()).click();
  }
  async search(text: string): Promise<void> {
    const input = await this.input();
    await input.focus();
    await input.clear();
    if (text) await input.sendKeys(...text.split(''));
  }
  private async options(): Promise<TestElement[]> {
    const id = await (await this.input()).getAttribute('aria-controls');
    return id ? this.documentRootLocatorFactory().locatorForAll(`#${id} [role="option"]`)() : [];
  }
  async getOptions(): Promise<ComboboxOptionState[]> {
    return Promise.all(
      (await this.options()).map(async (option) => ({
        label: (await option.text()).trim(),
        selected: (await option.getAttribute('aria-selected')) === 'true',
        disabled: (await option.getAttribute('aria-disabled')) === 'true',
      })),
    );
  }
  async toggleOption(labelOrIndex: string | number): Promise<void> {
    await this.open();
    const options = await this.options();
    const labels = await Promise.all(options.map((option) => option.text()));
    const index =
      typeof labelOrIndex === 'number'
        ? labelOrIndex
        : labels.findIndex((label) => label.trim() === labelOrIndex);
    if (!Number.isInteger(index) || !options[index])
      throw new Error(`ComboboxHarness: option ${JSON.stringify(labelOrIndex)} was not found.`);
    await options[index].click();
  }
  async getChips(): Promise<string[]> {
    return Promise.all((await this.chipLabels()).map(async (label) => (await label.text()).trim()));
  }
  async removeChip(labelOrIndex: string | number): Promise<void> {
    const labels = await this.getChips();
    const index = typeof labelOrIndex === 'number' ? labelOrIndex : labels.indexOf(labelOrIndex);
    const buttons = await this.chipButtons();
    if (!Number.isInteger(index) || !buttons[index])
      throw new Error(`ComboboxHarness: chip ${JSON.stringify(labelOrIndex)} was not found.`);
    await buttons[index].click();
  }
}
