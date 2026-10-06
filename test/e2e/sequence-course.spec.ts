import { test } from '@playwright/test';
import { PlayerPage } from './pages/player-page';

// L2-001 AC1, L2-006
test('shows a SCORM 2004 course outline with its modules and starts at the first lesson', async ({
  page,
}) => {
  const player = new PlayerPage(page);

  await player.open({ course: 'seq-flow-2004' });

  await player.expectOutline([['Module one', ['Lesson one', 'Lesson two']], 'Lesson three']);
  await player.expectCurrentActivity('Lesson one');
  await player.expectNoAccessibilityViolations();
});

// L2-006 AC1, L2-005 AC3, L2-017 AC3
test('blocks choosing a later lesson when the course requires flow, and lets Next follow the rules', async ({
  page,
}) => {
  const player = new PlayerPage(page);
  await player.open({ course: 'seq-flow-2004' });

  await player.expectActivityUnavailable('Lesson three', 'Take this course in order using Next.');
  await player.chooseActivity('Lesson three');
  await player.expectCurrentActivity('Lesson one');
  await player.expectNoAccessibilityViolations();

  await player.next();
  await player.expectCurrentActivity('Lesson two');
  await player.next();
  await player.expectCurrentActivity('Lesson three');
  await player.expectNextBlocked('This is the last activity.');
  await player.previous();
  await player.expectCurrentActivity('Lesson two');
});

// L2-006 AC2, L2-017 AC2
test('processes navigation requests that a SCO makes when its session ends', async ({ page }) => {
  const player = new PlayerPage(page);
  await player.open({ course: 'seq-flow-2004' });

  await player.runScoCallsThatLeave([
    ['Initialize', ''],
    ['SetValue', 'adl.nav.request', 'continue'],
    ['Terminate', ''],
  ]);
  await player.expectCurrentActivity('Lesson two');
  // Focus was in the retired activity, so it moves to the new activity's heading, which names it.
  await player.expectActivityHeadingFocused('Lesson two');

  await player.runScoCalls([
    ['Initialize', ''],
    ['SetValue', 'adl.nav.request', '{target=lesson3}choice'],
    ['Terminate', ''],
  ]);
  await player.expectNavigationAnnounced('Take this course in order using Next.');
  await player.expectCurrentActivity('Lesson two');

  await player.previous();
  await player.next();
  await player.runScoCallsThatLeave([
    ['Initialize', ''],
    ['SetValue', 'adl.nav.request', 'exitAll'],
    ['Terminate', ''],
  ]);
  await player.expectNavigationAnnounced('The course has ended.');
  await player.expectNoActivityContent();
  await player.expectNoAccessibilityViolations();
});

// L2-006 AC3 (attempt limit), L2-005 AC3
test('makes an activity unavailable once its attempt limit is used', async ({ page }) => {
  const player = new PlayerPage(page);
  await player.open({ course: 'seq-limit-2004' });
  await player.expectCurrentActivity('Final quiz');

  await player.next();

  await player.expectCurrentActivity('Summary');
  const reason = 'You have used every attempt at this activity.';
  await player.expectActivityUnavailable('Final quiz', reason);
  await player.expectPreviousBlocked(reason);
  await player.chooseActivity('Final quiz');
  await player.expectCurrentActivity('Summary');
  await player.expectNoAccessibilityViolations();
});

// L2-006 AC3 (objective prerequisite)
test('keeps an activity locked until the objective it depends on is satisfied', async ({
  page,
}) => {
  const player = new PlayerPage(page);
  await player.open({ course: 'seq-prereq-2004' });
  const reason = 'This activity is locked until its prerequisites are met.';
  await player.expectActivityUnavailable('Quiz', reason);
  await player.expectNextBlocked(reason);

  await player.runScoCalls([
    ['Initialize', ''],
    ['SetValue', 'cmi.success_status', 'passed'],
    ['Commit', ''],
  ]);

  await player.expectActivityAvailable('Quiz');
  await player.next();
  await player.expectCurrentActivity('Quiz');
});

// L2-006 AC3 (rollup), L2-012 AC2, AC3
test('rolls lesson results up into the course outcome without inventing one', async ({ page }) => {
  const player = new PlayerPage(page);
  await player.open({ course: 'seq-rollup-2004' });

  await player.runScoCalls([
    ['Initialize', ''],
    ['SetValue', 'cmi.completion_status', 'completed'],
    ['SetValue', 'cmi.success_status', 'passed'],
    ['Commit', ''],
  ]);
  await player.expectOutcomeShown({ completion: 'Not yet known', success: 'Not yet known' });
  await player.expectNoProgressPercentage();

  await player.next();
  await player.expectCurrentActivity('Lesson two');
  await player.runScoCalls([
    ['Initialize', ''],
    ['SetValue', 'cmi.completion_status', 'completed'],
    ['SetValue', 'cmi.success_status', 'failed'],
    ['Commit', ''],
  ]);

  await player.expectOutcomeShown({ completion: 'completed', success: 'failed' });
  await player.expectLastHostOutcome({
    status: 'unknown',
    completion: 'completed',
    success: 'failed',
    score: 'unknown',
    progress: 'unknown',
  });
});
