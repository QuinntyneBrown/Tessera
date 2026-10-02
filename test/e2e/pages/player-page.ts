import AxeBuilder from '@axe-core/playwright';
import { expect, Locator, Page } from '@playwright/test';

export interface HostScenario {
  omit?: 'attempt' | 'host';
}

/** The player screen: owns every selector and interaction. */
export class PlayerPage {
  private courseRequests = 0;

  constructor(private readonly page: Page) {
    page.on('request', (request) => {
      if (new URL(request.url()).pathname.startsWith('/courses/')) {
        this.courseRequests++;
      }
    });
  }

  async open(scenario: HostScenario = {}): Promise<void> {
    const query = new URLSearchParams(scenario as Record<string, string>);
    await this.page.goto(`/?${query}`);
  }

  private get alert(): Locator {
    return this.page.getByRole('alert');
  }

  private get hostEvents(): Locator {
    return this.page.getByRole('list', { name: 'Host events' }).getByRole('listitem');
  }

  async expectErrorMessage(text: RegExp): Promise<void> {
    await expect(this.alert).toContainText(text);
  }

  async expectHostReceivedErrorCategory(category: string): Promise<void> {
    await expect(this.hostEvents).toHaveCount(1);
    const event = JSON.parse((await this.hostEvents.first().textContent()) ?? '{}');
    expect(event.kind).toBe('error');
    expect(event.error.category).toBe(category);
  }

  async expectNoAccessibilityViolations(): Promise<void> {
    const results = await new AxeBuilder({ page: this.page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(results.violations).toEqual([]);
  }

  expectNoCourseContentRequested(): void {
    expect(this.courseRequests).toBe(0);
  }
}
