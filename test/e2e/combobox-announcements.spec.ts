// Acceptance tests. Traces to L2-036, L2-048.
import { test } from '@playwright/test';
import { ComboboxDemoPage } from './pages/combobox-demo-page';

test('an assertive failure never drops a selection waiting in the region reset gap', async ({
  page,
}) => {
  // L2-036 AC5/11: Given a pending selection and a failure, assertive failure is followed by preserved selection speech.
  const box = new ComboboxDemoPage(page);
  await box.open({ results: 'normal', debounceMs: 0, failureQuery: 'bad' });
  await box.typeText('ad');
  await box.expectAnnouncement('3 results available.');
  await box.observeAnnouncements();
  await box.freezeTime();
  await box.toggleOption('Ada');
  await box.elapse(150);
  await box.typeText('bad');
  await box.elapse(250);
  await box.resumeTime();
  await box.expectAnnouncementHistory([
    'Results could not be loaded.',
    'Ada selected. 1 selected in total.',
  ]);
  await box.expectNoAccessibilityViolations();
});

test('cancels the search part of a pending mixed announcement while preserving selection speech', async ({
  page,
}) => {
  // L2-036 AC11: Given queued search plus selection, closing discards search and retains selection in order.
  const box = new ComboboxDemoPage(page);
  await box.open({ results: 'normal' });
  await box.freezeTime();
  await box.typeText('ad');
  await box.elapse(316);
  await box.expectOptions(['Ada', 'Grace', 'Linus']);
  await box.toggleOption('Ada');
  await box.elapse(150);
  await box.closeList('Escape');
  await box.elapse(50);
  await box.resumeTime();
  await box.expectAnnouncement('Ada selected. 1 selected in total.');
  await box.expectNoAccessibilityViolations();
});

test('announces a slow request once after one second and then its results', async ({ page }) => {
  // L2-036 AC4: Given a slow request, Loading is announced once after one second.
  const box = new ComboboxDemoPage(page);
  await box.open({ results: 'normal', responseDelay: 2000 });
  await box.observeAnnouncements();
  await box.freezeTime();
  await box.typeText('ad');
  await box.elapse(1299);
  await box.expectAnnouncementHistory([]);
  await box.elapse(200);
  await box.expectAnnouncement('Loading results.');
  await box.elapse(1000);
  await box.resumeTime();
  await box.expectAnnouncementHistory(['Loading results.', '3 results available.']);
  await box.expectNoAccessibilityViolations();
});

test('owns a live region before announcing loaded results', async ({ page }) => {
  // L2-036 AC1/2/12: Given an instance, when results arrive, then announce the loaded count.
  const box = new ComboboxDemoPage(page);
  await box.open({ results: 'normal' });
  await box.expectAnnouncement('');
  await box.typeText('ad');
  await box.expectOptions(['Ada', 'Grace', 'Linus']);
  await box.expectAnnouncement('3 results available.');
  await box.expectNoAccessibilityViolations();
});

test('keeps rapid selection messages in order', async ({ page }) => {
  // L2-036 AC6/7/11: Given rapid selections, when announced, then none of their messages are lost.
  const box = new ComboboxDemoPage(page);
  await box.open({ results: 'normal' });
  await box.typeText('ad');
  await box.expectAnnouncement('3 results available.');
  await box.observeAnnouncements();
  await box.freezeTime();
  await box.toggleOption('Ada');
  await box.toggleOption('Grace');
  await box.elapse(200);
  await box.resumeTime();
  await box.expectAnnouncementHistory([
    'Ada selected. 1 selected in total. Grace selected. 2 selected in total.',
  ]);
  await box.toggleOption('Ada');
  await box.expectAnnouncement('Ada removed.');
  await box.clearAll();
  await box.expectAnnouncement('All selections cleared.');
  await box.expectNoAccessibilityViolations();
});

test('discards a queued results message when closed inside the coalescing window', async ({
  page,
}) => {
  // L2-036 AC11: Given queued results, when closed before 150 ms, then discard that search announcement.
  const box = new ComboboxDemoPage(page);
  await box.open({ results: 'normal' });
  await box.freezeTime();
  await box.typeText('ad');
  await box.elapse(316);
  await box.expectAnnouncement('');
  await box.closeList('Escape');
  await box.elapse(200);
  await box.resumeTime();
  await box.expectAnnouncement('');
  await box.expectNoAccessibilityViolations();
});

test('announces failures assertively', async ({ page }) => {
  // L2-036 AC5: Given a failed request, when its error appears, then announce assertively.
  const box = new ComboboxDemoPage(page);
  await box.open({ failure: 'observable' });
  await box.typeText('ad');
  await box.expectSearchError();
  await box.expectAnnouncement('Results could not be loaded.', 'assertive');
  await box.expectNoAccessibilityViolations();
});
