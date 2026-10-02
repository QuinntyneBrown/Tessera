import AxeBuilder from '@axe-core/playwright';
import { expect, Locator, Page } from '@playwright/test';

export interface HostScenario {
  omit?: 'attempt' | 'host';
  /** The host holds every save until the test acknowledges or fails it. */
  save?: 'manual';
  course?: string;
  /** The host serves course content from the LMS origin instead of an isolated one. */
  isolation?: 'none' | 'unavailable';
  /** Makes the first request for the course manifest fail. */
  failFirstManifestRequest?: boolean;
  /** Makes the first request for the activity's launch page return HTTP 503. */
  failFirstActivityRequest?: boolean;
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
    const { failFirstManifestRequest, failFirstActivityRequest, ...query } = scenario;
    if (failFirstActivityRequest) {
      let failed = false;
      await this.page.route('**/courses/**/sco.html', (route) => {
        if (failed) return route.fallback();
        failed = true;
        return route.fulfill({ status: 503 });
      });
    }
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
    await this.page.getByRole('button', { name: 'Retry', exact: true }).click();
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

  async expectAssetShownWithoutRuntime(): Promise<void> {
    await expect(this.activityFrame.getByText('No SCORM runtime is present')).toBeVisible();
  }

  /** Has the probe SCO run each [method, ...arguments] against its SCORM API; returns the results in order. */
  async runScoCalls(calls: string[][]): Promise<string[]> {
    const sco = this.activityFrame;
    await sco.getByLabel('API calls (JSON)').fill(JSON.stringify(calls));
    await sco.getByRole('button', { name: 'Run calls' }).click();
    const results = sco.getByRole('list', { name: 'API results' }).getByRole('listitem');
    await expect(results).toHaveCount(calls.length);
    return (await results.allTextContents()).map((text) => JSON.parse(text));
  }

  private get hostSaves(): Locator {
    return this.page.getByRole('list', { name: 'Host saves' }).getByRole('listitem');
  }

  /** Waits for the host to have received a save whose (only) SCO holds these values. */
  async expectHostSaved(values: Record<string, string>): Promise<void> {
    await expect(async () => {
      const saves = (await this.hostSaves.allTextContents()).map((text) => JSON.parse(text));
      const last = saves.at(-1);
      expect(last, 'a save reached the host').toBeDefined();
      expect(Object.values(last.snapshot.scoStates)[0]).toMatchObject({ values });
    }).toPass();
  }

  /** Like expectHostSaved, but the SCO's saved values must be exactly these. */
  async expectHostSavedOnly(values: Record<string, string>): Promise<void> {
    await expect(async () => {
      const saves = (await this.hostSaves.allTextContents()).map((text) => JSON.parse(text));
      expect(saves.length, 'a save reached the host').toBeGreaterThan(0);
      expect(Object.values(saves.at(-1).snapshot.scoStates)[0]).toEqual({ values });
    }).toPass();
  }

  /** Gives the player time to (wrongly) send a second save, then checks the host still has only one. */
  async expectNoSecondSaveWhileOneIsInFlight(): Promise<void> {
    await this.page.waitForTimeout(500);
    await expect(this.hostSaves).toHaveCount(1);
  }

  async expectHostSaveCount(count: number): Promise<void> {
    await expect(this.hostSaves).toHaveCount(count);
  }

  async expectSaveStatus(text: string): Promise<void> {
    await expect(this.page.getByRole('status')).toContainText(text);
  }

  async acknowledgePendingSave(): Promise<void> {
    await this.page.getByRole('button', { name: 'Acknowledge pending save', exact: true }).click();
  }

  async acknowledgePendingSaveAsStale(): Promise<void> {
    await this.page.getByRole('button', { name: 'Acknowledge pending save as stale' }).click();
  }

  async failPendingSave(): Promise<void> {
    await this.page.getByRole('button', { name: 'Fail pending save' }).click();
  }

  async expectNoErrorMessage(): Promise<void> {
    await expect(this.alert).toHaveCount(0);
  }

  async exit(): Promise<void> {
    await this.page.getByRole('button', { name: 'Exit course' }).click();
  }

  async retrySaveFromExitWarning(): Promise<void> {
    await this.page.getByRole('button', { name: 'Retry save' }).click();
  }

  async exitWithoutSaving(): Promise<void> {
    await this.page.getByRole('button', { name: 'Exit without saving' }).click();
  }

  /** The unsaved-exit warning is shown inline, with focus on its heading. */
  async expectExitWarningFocused(): Promise<void> {
    await expect(
      this.page.getByRole('heading', { name: 'Your progress is not saved' }),
    ).toBeFocused();
  }

  async expectNoExitWarning(): Promise<void> {
    await expect(
      this.page.getByRole('heading', { name: 'Your progress is not saved' }),
    ).toHaveCount(0);
  }

  async expectActivityHeadingFocused(name: string): Promise<void> {
    await expect(this.page.getByRole('heading', { level: 2, name })).toBeFocused();
  }

  /** Waits for the host's exit event: `saved` says whether all progress had been saved. */
  async expectHostReceivedExit(saved: boolean): Promise<void> {
    await expect(async () => {
      const events = (await this.hostEvents.allTextContents()).map((text) => JSON.parse(text));
      expect(events.filter((event) => event.kind === 'exit')).toEqual([{ kind: 'exit', saved }]);
    }).toPass();
  }

  async expectNoHostExit(): Promise<void> {
    const events = (await this.hostEvents.allTextContents()).map((text) => JSON.parse(text));
    expect(events.filter((event) => event.kind === 'exit')).toEqual([]);
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
