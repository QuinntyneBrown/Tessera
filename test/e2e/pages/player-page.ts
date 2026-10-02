import AxeBuilder from '@axe-core/playwright';
import { expect, Locator, Page } from '@playwright/test';

export interface HostScenario {
  omit?: 'attempt' | 'host';
  course?: string;
  /** The host serves course content from the LMS origin instead of an isolated one. */
  isolation?: 'none' | 'unavailable';
  /** Makes the first request for the course manifest fail. */
  failFirstManifestRequest?: boolean;
}

/** The player screen: owns every selector and interaction. */
export class PlayerPage {
  private courseRequests = 0;
  private launchRequests = 0;

  constructor(private readonly page: Page) {
    page.on('request', (request) => {
      const { pathname } = new URL(request.url());
      if (pathname.startsWith('/courses/')) {
        this.courseRequests++;
        if (!pathname.endsWith('/imsmanifest.xml')) this.launchRequests++;
      }
    });
  }

  async open(scenario: HostScenario = {}): Promise<void> {
    const { failFirstManifestRequest, ...query } = scenario;
    if (failFirstManifestRequest) {
      let failed = false;
      await this.page.route('**/imsmanifest.xml', (route) => {
        if (failed) return route.fallback();
        failed = true;
        return route.abort('connectionrefused');
      });
    }
    await this.page.goto(`/?${new URLSearchParams(query as Record<string, string>)}`);
  }

  async retry(): Promise<void> {
    await this.page.getByRole('button', { name: 'Retry' }).click();
  }

  private get alert(): Locator {
    return this.page.getByRole('alert');
  }

  private get hostEvents(): Locator {
    return this.page.getByRole('list', { name: 'Host events' }).getByRole('listitem');
  }

  async expectCourseTitle(title: string): Promise<void> {
    await expect(this.page.getByRole('heading', { level: 1, name: title })).toBeVisible();
  }

  async expectEdition(edition: string): Promise<void> {
    await expect(this.page.getByText(edition, { exact: true })).toBeVisible();
  }

  async expectActivities(titles: string[]): Promise<void> {
    const outline = this.page.getByRole('navigation', { name: 'Course outline' });
    await expect(outline.getByRole('listitem')).toHaveText(titles);
  }

  private get activityFrame() {
    return this.page.frameLocator('iframe[title^="Course content"]').frameLocator('iframe');
  }

  async expectActivityDiscoveredApi(): Promise<void> {
    await expect(this.activityFrame.getByText('API found')).toBeVisible();
  }

  async expectCourseCannotReachHost(): Promise<void> {
    for (const probe of ['Host DOM', 'Host cookie', 'Host storage']) {
      await expect(this.activityFrame.getByText(`${probe}: `)).toHaveText(`${probe}: blocked`);
    }
  }

  /** Waits for the hostile course to finish forging, then checks that the host started nothing extra. */
  async expectForgedMessagesIgnored(): Promise<void> {
    await expect(this.activityFrame.first().getByText('Forged messages sent')).toBeVisible();
    await this.page.waitForTimeout(500);
    await expect(
      this.page.frameLocator('iframe[title^="Course content"]').locator('iframe'),
    ).toHaveCount(1);
  }

  async expectErrorMessage(text: RegExp): Promise<void> {
    await expect(this.alert).toContainText(text);
  }

  async expectHostReceivedErrorCategory(category: string): Promise<void> {
    await expect(this.hostEvents.first()).toBeAttached();
    const events = await this.hostEvents.allTextContents();
    const errors = events.map((text) => JSON.parse(text)).filter((event) => event.kind === 'error');
    expect(errors.map((event) => event.error.category)).toEqual([category]);
  }

  async expectRetryOffered(): Promise<void> {
    await expect(this.page.getByRole('button', { name: 'Retry' })).toBeVisible();
  }

  async expectNoAccessibilityViolations(): Promise<void> {
    const results = await new AxeBuilder({ page: this.page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(results.violations).toEqual([]);
  }

  expectNoLaunchResourceRequested(): void {
    expect(this.launchRequests).toBe(0);
  }

  expectNoCourseContentRequested(): void {
    expect(this.courseRequests).toBe(0);
  }
}
