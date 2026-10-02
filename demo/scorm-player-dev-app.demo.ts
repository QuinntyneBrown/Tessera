import { expect, FrameLocator, Locator, Page, test } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Narrator } from './narration';

const STAGING = join(__dirname, '.run', 'staging');
const SLUG = 'scorm-player-dev-app';

/** The dev app's example host: the SCORM player, its outline, and the events the host received. */
class DevAppPage {
  constructor(private readonly page: Page) {}

  async open(): Promise<void> {
    await this.page.goto('http://localhost:4200/');
  }

  get title(): Locator {
    return this.page.getByRole('heading', { level: 1, name: 'Three lessons' });
  }

  get outline(): Locator {
    return this.page.getByRole('navigation', { name: 'Course outline' });
  }

  lesson(name: string): Locator {
    return this.outline.getByRole('button', { name });
  }

  get previous(): Locator {
    return this.page.getByRole('button', { name: 'Previous' });
  }

  get next(): Locator {
    return this.page.getByRole('button', { name: 'Next' });
  }

  get exit(): Locator {
    return this.page.getByRole('button', { name: 'Exit course' });
  }

  eventCount(kind: string): Locator {
    return this.page.getByRole('listitem').filter({ hasText: new RegExp(`^${kind}$`) });
  }

  get activity(): FrameLocator {
    return this.page.frameLocator('iframe[title^="Course content"]').frameLocator('iframe');
  }

  /** Has the lesson's script call the SCORM API and returns what each call returned. */
  async runApiCalls(calls: string[][]): Promise<string[]> {
    await this.activity.getByLabel('API calls (JSON)').fill(JSON.stringify(calls));
    await this.activity.getByRole('button', { name: 'Run calls' }).click();
    const results = this.activity.getByRole('list', { name: 'API results' }).getByRole('listitem');
    await expect(results).toHaveCount(calls.length);
    return (await results.allTextContents()).map((text) => JSON.parse(text));
  }
}

test('SCORM player dev app: load, run, navigate, resume within the session, exit', async ({
  page,
}) => {
  const narrator = new Narrator(page);
  const app = new DevAppPage(page);

  await narrator.card(
    'Tessera SCORM player',
    'Playing a SCORM 1.2 course inside a host application',
    4000,
  );

  await narrator.chapter(
    '1. Load the course',
    'The host supplies a course, an attempt and its storage',
  );
  await app.open();
  await expect(app.title).toBeVisible();
  await expect(page.getByText('SCORM 1.2', { exact: true })).toBeVisible();
  await expect(app.outline.getByRole('listitem')).toHaveText([
    'Lesson one',
    'Lesson two',
    'Lesson three',
  ]);
  await expect(app.lesson('Lesson one')).toHaveAttribute('aria-current', 'step');
  await narrator.caption(
    'The player read the manifest, identified SCORM 1.2 and listed the lessons.',
    5500,
  );
  await narrator.caption(
    'Lesson one runs in an isolated frame on a separate origin from the host.',
    5500,
  );
  await narrator.clearCaption();

  await narrator.chapter('2. A lesson reports progress', 'The lesson calls the SCORM 1.2 API');
  await narrator.caption(
    'This lesson is a probe page: it runs the API calls we type, as a real lesson would.',
    6000,
  );
  const results = await app.runApiCalls([
    ['LMSInitialize', ''],
    ['LMSSetValue', 'cmi.core.score.raw', '85'],
    ['LMSSetValue', 'cmi.core.lesson_status', 'completed'],
    ['LMSCommit', ''],
  ]);
  expect(results).toEqual(['true', 'true', 'true', 'true']);
  await narrator.caption(
    'Each call returned "true": initialize, score 85, status completed, commit.',
    5500,
  );
  const outcome = page.getByRole('region', { name: 'Course outcome' });
  await expect(outcome).toContainText('Status: completed');
  await expect(outcome).toContainText('Score: 85');
  await expect(page.getByRole('status').filter({ hasText: 'Progress saved' })).toBeVisible();
  await expect(app.eventCount('save')).toHaveCount(1);
  await expect(app.eventCount('outcome')).toHaveCount(1);
  narrator.mark('poster');
  await narrator.caption(
    'The host acknowledged the save, so the player shows "Progress saved" and the new status and score.',
    6500,
  );
  await page.getByText('Events the host received').scrollIntoViewIfNeeded();
  await narrator.caption('The host received exactly one save event and one outcome event.', 5500);
  await narrator.clearCaption();
  await page.evaluate(() => window.scrollTo(0, 0));

  await narrator.chapter('3. Move between lessons', 'Opening a lesson ends the previous session');
  await app.next.click();
  await expect(app.lesson('Lesson two')).toHaveAttribute('aria-current', 'step');
  await expect(page.getByRole('heading', { level: 2, name: 'Lesson two' })).toBeFocused();
  await narrator.caption('Next opened Lesson two and moved keyboard focus to its heading.', 5500);
  await app.lesson('Lesson three').click();
  await expect(app.lesson('Lesson three')).toHaveAttribute('aria-current', 'step');
  await narrator.caption(
    'Choosing from the outline works too. Each lesson gets its own session.',
    5500,
  );
  await expect(app.next).toHaveAttribute('aria-disabled', 'true');
  await expect(page.getByText('This is the last activity.')).toBeVisible();
  await narrator.caption('On the last lesson, Next is unavailable and says why, in text.', 6000);
  await app.previous.click();
  await expect(app.lesson('Lesson two')).toHaveAttribute('aria-current', 'step');
  await narrator.clearCaption();

  await narrator.chapter('4. Come back to a lesson', 'Its saved values return');
  await app.lesson('Lesson one').click();
  await expect(app.lesson('Lesson one')).toHaveAttribute('aria-current', 'step');
  const restored = await app.runApiCalls([
    ['LMSInitialize', ''],
    ['LMSGetValue', 'cmi.core.lesson_status'],
    ['LMSGetValue', 'cmi.core.score.raw'],
  ]);
  expect(restored).toEqual(['true', 'completed', '85']);
  await narrator.caption(
    'Back in Lesson one, the lesson reads its status and score back: completed, 85.',
    6500,
  );
  await narrator.clearCaption();

  await narrator.chapter('5. Leave the course', 'All progress is saved, so leaving is immediate');
  await app.exit.click();
  await expect(app.eventCount('exit')).toHaveCount(1);
  await page.getByText('Events the host received').scrollIntoViewIfNeeded();
  await narrator.caption(
    'The host received an exit event. If a save had failed, the player would warn first.',
    6500,
    'bottom',
  );
  await narrator.clearCaption();

  await narrator.card(
    'That is the SCORM 1.2 walking skeleton',
    'SCORM 2004 courses are recognised and refused for now',
    4000,
  );

  const video = page.video()!;
  mkdirSync(STAGING, { recursive: true });
  writeFileSync(
    join(STAGING, `${SLUG}.chapters.json`),
    JSON.stringify({ chapters: narrator.chapters, markers: narrator.markers }, null, 2),
  );
  await page.close();
  await video.saveAs(join(STAGING, `${SLUG}.webm`));
});
