import AxeBuilder from '@axe-core/playwright';
import { expect, Locator, Page } from '@playwright/test';

export interface HostScenario {
  omit?: 'attempt' | 'host';
  /** The host takes the course from a ZIP the test chooses rather than an extracted manifest URL. */
  source?: 'zip';
  /** Package limits the host configures. */
  limits?: 'small-archive' | 'few-entries' | 'small-expanded';
  /** The attempt key the host issues; each attempt has its own saved state. */
  attempt?: string;
  /** What the host's stored state for the attempt looks like; none means a new attempt. */
  snapshot?: 'saved' | 'foreign' | 'unreadable' | 'flaky';
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

export type OutlineItem = string | [string, OutlineItem[]];

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
    const courseOrigin = process.env['TESSERA_COURSE_ORIGIN'];
    await this.page.goto(
      `/?${new URLSearchParams({
        ...query,
        ...(courseOrigin ? { courseOrigin } : {}),
      } as Record<string, string>)}`,
    );
  }

  /** Opens the host with a built ZIP package (see tools/build-packages.mjs) chosen as the course. */
  async openWithPackage(name: string, scenario: HostScenario = {}): Promise<void> {
    await this.open({ ...scenario, source: 'zip' });
    await this.page.getByLabel('Course package').setInputFiles(`dist/packages/${name}.zip`);
  }

  async expectLoadingShown(): Promise<void> {
    await expect(this.page.getByRole('status').filter({ hasText: 'Loading course' })).toBeVisible();
  }

  /** Cancels the load and requires the player to react within the L2-019 budget of 200 ms. */
  async cancelLoad(): Promise<void> {
    await this.page.getByRole('button', { name: 'Cancel' }).click();
    await expect(
      this.page.getByRole('status').filter({ hasText: 'Loading was cancelled' }),
    ).toBeVisible({
      timeout: 200,
    });
  }

  async expectNoCourseShown(): Promise<void> {
    await expect(this.page.getByRole('heading', { level: 1 })).toHaveCount(0);
    await expect(this.page.locator('iframe')).toHaveCount(0);
  }

  /** Chooses another package for the same player, as an LMS does when the learner picks a course. */
  async chooseAnotherPackage(name: string): Promise<void> {
    await this.page.getByLabel('Course package').setInputFiles(`dist/packages/${name}.zip`);
  }

  async useViewport(width: number, height = 900): Promise<void> {
    await this.page.setViewportSize({ width, height });
  }

  private get outlineToggle(): Locator {
    return this.page.getByRole('button', { name: 'Course outline' });
  }

  async expectOutlineToggle(state: { expanded: boolean }): Promise<void> {
    await expect(this.outlineToggle).toBeVisible();
    await expect(this.outlineToggle).toHaveAttribute('aria-expanded', String(state.expanded));
    const controlled = await this.outlineToggle.getAttribute('aria-controls');
    await expect(this.page.locator(`#${controlled}`)).toBeAttached();
  }

  async expectNoOutlineToggle(): Promise<void> {
    await expect(this.outlineToggle).toBeHidden();
  }

  async expectOutlineVisible(visible: boolean): Promise<void> {
    await expect(this.outline.getByRole('button', { name: 'Lesson one' })).toBeVisible({ visible });
  }

  async pressKey(key: string): Promise<void> {
    await this.page.keyboard.press(key);
  }

  async expectOutlineToggleFocused(): Promise<void> {
    await expect(this.outlineToggle).toBeFocused();
  }

  async focusOutlineToggle(): Promise<void> {
    await this.outlineToggle.focus();
  }

  /** WCAG 1.4.10: the page never needs to scroll sideways. */
  async expectNoHorizontalScroll(): Promise<void> {
    const overflow = await this.page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, 'horizontal overflow in CSS px').toBeLessThanOrEqual(0);
  }

  /** Every control the learner needs is reachable: the outline (directly or via its toggle), navigation, exit. */
  async expectControlsUsable(): Promise<void> {
    const toggle = this.outlineToggle;
    if (await toggle.isVisible()) {
      await toggle.click();
    }
    await expect(this.outline.getByRole('button', { name: 'Lesson one' })).toBeVisible();
    await expect(this.nextButton).toBeVisible();
    await expect(this.previousButton).toBeVisible();
    await expect(this.page.getByRole('button', { name: 'Exit course' })).toBeVisible();
    const viewport = this.page.viewportSize()!;
    const frame = await this.page.locator('iframe[title^="Course content"]').boundingBox();
    expect(frame!.x + frame!.width).toBeLessThanOrEqual(viewport.width);
  }

  /** The outline and the activity sit one above the other, as at 320 CSS px. */
  async expectSingleColumn(): Promise<void> {
    const [sidebar, player] = await this.page.locator('.layout > *').all();
    const [a, b] = [await sidebar.boundingBox(), await player.boundingBox()];
    expect(a!.x).toBe(b!.x);
    expect(b!.y).toBeGreaterThanOrEqual(a!.y + a!.height);
  }

  /** WCAG 1.4.4: player text at 200% of its normal size, without page zoom. */
  async enlargeTextTo200Percent(): Promise<void> {
    await this.page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
  }

  /** WCAG 1.4.12: the text-spacing overrides a user style sheet may apply. */
  async applyTextSpacingOverrides(): Promise<void> {
    await this.page.addStyleTag({
      content: `
        * { line-height: 1.5 !important; letter-spacing: 0.12em !important; word-spacing: 0.16em !important; }
        p { margin-bottom: 2em !important; }`,
    });
  }

  /** No player text is clipped, truncated or overlapped by another control. */
  async expectNoClippedOrOverlappingText(): Promise<void> {
    const problems = await this.page.evaluate(() => {
      const root = document.querySelector('tsr-scorm-player')!;
      const found: string[] = [];
      const controls: { name: string; rect: DOMRect }[] = [];
      for (const element of Array.from(root.querySelectorAll<HTMLElement>('*'))) {
        if (element.closest('iframe') || element.offsetParent === null) continue;
        const style = getComputedStyle(element);
        const clips = style.overflowX !== 'visible' || style.overflowY !== 'visible';
        if (
          clips &&
          (element.scrollWidth > element.clientWidth + 1 ||
            element.scrollHeight > element.clientHeight + 1)
        ) {
          found.push(`clipped: <${element.localName}> ${element.textContent?.trim().slice(0, 30)}`);
        }
        if (element.matches('button, a[href]')) {
          controls.push({
            name: element.textContent!.trim(),
            rect: element.getBoundingClientRect(),
          });
        }
      }
      for (const [i, a] of controls.entries()) {
        for (const b of controls.slice(i + 1)) {
          const overlap =
            a.rect.left < b.rect.right - 1 &&
            b.rect.left < a.rect.right - 1 &&
            a.rect.top < b.rect.bottom - 1 &&
            b.rect.top < a.rect.bottom - 1;
          if (overlap) found.push(`overlap: ${a.name} / ${b.name}`);
        }
      }
      return found;
    });
    expect(problems).toEqual([]);
  }

  /** Tags the live activity frame so a later check can tell whether it was replaced. */
  async markActivityFrame(): Promise<void> {
    await this.page.evaluate(() => {
      (document.querySelector('iframe[title^="Course content"]') as any).__marker = 'original';
    });
  }

  async expectActivityFrameNotReplaced(): Promise<void> {
    const marker = await this.page.evaluate(
      () => (document.querySelector('iframe[title^="Course content"]') as any)?.__marker,
    );
    expect(marker, 'the activity frame is the one that was marked').toBe('original');
  }

  /** The raw text of every event the host has received. */
  async hostEventTexts(): Promise<string[]> {
    return this.hostEvents.allTextContents();
  }

  /** The error events the host has received, parsed. */
  async hostErrors(): Promise<{ category: string; code: string; correlationToken: string }[]> {
    const events = (await this.hostEvents.allTextContents()).map((text) => JSON.parse(text));
    return events.filter((event) => event.kind === 'error').map((event) => event.error);
  }

  async expectHostError(category: string): Promise<void> {
    await expect(async () => {
      expect((await this.hostErrors()).map((error) => error.category)).toContain(category);
    }).toPass();
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

  /** The outline as nested lists: a title is a launchable activity, `[title, children]` a module. */
  async expectOutline(items: OutlineItem[]): Promise<void> {
    const yaml = (entries: OutlineItem[], indent: string): string =>
      `${indent}- list:\n` +
      entries
        .map((entry) =>
          typeof entry === 'string'
            ? `${indent}  - listitem:\n${indent}    - button "${entry}"\n`
            : `${indent}  - listitem:\n${indent}    - text: ${entry[0]}\n${yaml(entry[1], `${indent}    `)}`,
        )
        .join('');
    await expect(this.outline.getByRole('list').first()).toMatchAriaSnapshot(yaml(items, ''));
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

  /** Every save reached the host under exactly this attempt context. */
  async expectHostSavesBoundTo(context: object): Promise<void> {
    const saves = (await this.hostSaves.allTextContents()).map((text) => JSON.parse(text));
    expect(saves.length, 'a save reached the host').toBeGreaterThan(0);
    for (const save of saves) {
      expect(save.context).toEqual(context);
      expect(save.snapshot.context).toEqual(context);
    }
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

  /** Each outcome field is shown as text, e.g. `{ status: 'completed' }` as "Status: completed". */
  async expectOutcomeShown(outcome: Record<string, string>): Promise<void> {
    const region = this.page.getByRole('region', { name: 'Course outcome' });
    for (const [field, value] of Object.entries(outcome)) {
      const label = field[0].toUpperCase() + field.slice(1);
      await expect(region).toContainText(`${label}: ${value}`);
    }
  }

  async expectNoProgressPercentage(): Promise<void> {
    await expect(this.page.getByRole('progressbar')).toHaveCount(0);
    await expect(this.page.getByText(/d+s?%/)).toHaveCount(0);
  }

  /** The outcome events the host has received, in order. */
  async expectHostReceivedOutcomes(outcomes: object[]): Promise<void> {
    await expect(async () => {
      const events = (await this.hostEvents.allTextContents()).map((text) => JSON.parse(text));
      expect(
        events.filter((event) => event.kind === 'outcome').map((event) => event.outcome),
      ).toEqual(outcomes);
    }).toPass();
  }

  private get outline(): Locator {
    return this.page.getByRole('navigation', { name: 'Course outline' });
  }

  /** An unavailable outline activity stays focusable, says so to assistive technology and shows why. */
  async expectActivityUnavailable(title: string, reason: string): Promise<void> {
    const button = this.outline.getByRole('button', { name: title });
    await expect(button).toHaveAttribute('aria-disabled', 'true');
    await expect(button).toHaveAccessibleDescription(reason);
    await expect(
      this.outline
        .getByRole('listitem')
        .filter({ has: this.page.getByRole('button', { name: title }) })
        .last()
        .getByText(reason, { exact: true }),
    ).toBeVisible();
  }

  async expectActivityAvailable(title: string): Promise<void> {
    await expect(this.outline.getByRole('button', { name: title })).not.toHaveAttribute(
      'aria-disabled',
      'true',
    );
  }

  async chooseActivity(title: string): Promise<void> {
    // An unavailable activity is aria-disabled but still activatable, so skip Playwright's enabled check.
    await this.outline.getByRole('button', { name: title }).click({ force: true });
  }

  async expectCurrentActivity(title: string): Promise<void> {
    await expect(this.outline.getByRole('button', { name: title })).toHaveAttribute(
      'aria-current',
      'step',
    );
    await expect(this.outline.locator('[aria-current="step"]')).toHaveCount(1);
    await expect(this.page.getByRole('heading', { level: 2, name: title })).toBeVisible();
  }

  /** Waits for a save whose snapshot holds these values for the given activity. */
  async expectHostSavedActivity(activityId: string, values: Record<string, string>): Promise<void> {
    await expect(async () => {
      const saves = (await this.hostSaves.allTextContents()).map((text) => JSON.parse(text));
      expect(saves.at(-1)?.snapshot.scoStates[activityId]).toMatchObject({ values });
    }).toPass();
  }

  private get previousButton(): Locator {
    return this.page.getByRole('button', { name: 'Previous' });
  }

  private get nextButton(): Locator {
    return this.page.getByRole('button', { name: 'Next' });
  }

  async previous(): Promise<void> {
    // aria-disabled buttons are still activatable, so skip Playwright's enabled check.
    await this.previousButton.click({ force: true });
  }

  async next(): Promise<void> {
    await this.nextButton.click({ force: true });
  }

  /** A blocked control stays focusable (aria-disabled, not disabled) and carries its reason as text. */
  private async expectBlocked(button: Locator, reason: string): Promise<void> {
    await expect(button).toHaveAttribute('aria-disabled', 'true');
    await expect(button).not.toHaveAttribute('disabled');
    await button.focus();
    await expect(button).toBeFocused();
    await expect(button).toHaveAccessibleDescription(reason);
    await expect(this.page.getByText(reason, { exact: true })).toBeVisible();
  }

  async expectPreviousBlocked(reason: string): Promise<void> {
    await this.expectBlocked(this.previousButton, reason);
  }

  async expectNextBlocked(reason: string): Promise<void> {
    await this.expectBlocked(this.nextButton, reason);
  }

  async expectPreviousAvailable(): Promise<void> {
    await expect(this.previousButton).not.toHaveAttribute('aria-disabled', 'true');
  }

  async expectNextAvailable(): Promise<void> {
    await expect(this.nextButton).not.toHaveAttribute('aria-disabled', 'true');
  }

  /** What the previous SCO's unload handler got back when it called its API after being retired. */
  async lateCallResult(): Promise<unknown> {
    const sco = this.activityFrame;
    await sco.getByRole('button', { name: 'Show late call' }).click();
    const item = sco.getByRole('list', { name: 'Late call' }).getByRole('listitem');
    return JSON.parse((await item.textContent()) ?? 'null');
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
    // Scan the player itself; the host fixture's own controls are test scaffolding.
    const results = await new AxeBuilder({ page: this.page })
      .include('tsr-scorm-player')
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
