import '@angular/compiler';
import { Component, getPlatform, provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { ScormPlayer, ScormPlayerHarness } from '@tessera/scorm-player';
import { hostFixtureFor, SaveGate } from './host-fixtures';

const course = hostFixtureFor(new URLSearchParams('course=multi-sco-12'), () => {}, new SaveGate());
const unauthorized = hostFixtureFor(
  new URLSearchParams('course=multi-sco-12&omit=attempt'),
  () => {},
  new SaveGate(),
);

@Component({
  imports: [ScormPlayer],
  template: `
    <tsr-scorm-player [source]="course.source" [attempt]="course.attempt" [host]="course.host" />
    <tsr-scorm-player
      [source]="unauthorized.source"
      [attempt]="unauthorized.attempt"
      [host]="unauthorized.host"
    />
  `,
})
class HarnessHost {
  readonly course = course;
  readonly unauthorized = unauthorized;
}

/** Waits for a condition the player reaches asynchronously, such as a loaded course. */
async function until<T>(read: () => Promise<T>, done: (value: T) => boolean): Promise<T> {
  let last: T | undefined;
  for (let tries = 0; tries < 100; tries++) {
    const value = await read();
    last = value;
    if (done(value)) return value;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`player harness contract: timed out at ${JSON.stringify(last)}`);
}

let initialized = false;

/** Runs the public ScormPlayerHarness against two real players in a consumer-style zoneless TestBed. */
export async function runPlayerHarnessContract(): Promise<unknown> {
  if (!initialized) {
    TestBed.initTestEnvironment(BrowserTestingModule, getPlatform() || platformBrowserTesting());
    initialized = true;
  }
  await TestBed.configureTestingModule({
    imports: [HarnessHost],
    providers: [provideZonelessChangeDetection()],
  }).compileComponents();
  const fixture = TestBed.createComponent(HarnessHost);
  try {
    const [player, other] =
      await TestbedHarnessEnvironment.loader(fixture).getAllHarnesses(ScormPlayerHarness);
    const title = await until(
      () => player.getCourseTitle(),
      (value) => value !== null,
    );
    const current = (expected: string) =>
      until(
        () => player.getCurrentActivity(),
        (value) => value === expected,
      );
    const activities = await player.getActivities();
    const previousReason = await player.getNavigationReason('Previous');
    await player.chooseActivity('Lesson two');
    const afterChoice = await current('Lesson two');
    await player.next();
    const afterNext = await current('Lesson three');
    const nextReason = await player.getNavigationReason('Next');
    await player.previous();
    const afterPrevious = await current('Lesson two');
    let missing = false;
    try {
      await player.chooseActivity('Missing');
    } catch (error) {
      missing = String(error).includes('Missing');
    }
    return {
      title,
      activities,
      previousReason,
      afterChoice,
      afterNext,
      nextReason,
      afterPrevious,
      outcome: await player.getOutcome(),
      missing,
      otherError: await other.getError(),
      otherTitle: await other.getCourseTitle(),
    };
  } finally {
    fixture.destroy();
    TestBed.resetTestingModule();
  }
}
