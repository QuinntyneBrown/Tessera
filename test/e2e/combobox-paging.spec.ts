// Acceptance tests. Traces to L2-025, L2-033, L2-036, L2-048.
import { test } from '@playwright/test';
import { ComboboxDemoPage } from './pages/combobox-demo-page';

test('keeps the explicit paging action visible but disabled after a failed page', async ({
  page,
}) => {
  // L2-025 AC8/9: Given hasMore and a failed append, the pointer action remains visible
  // but cannot issue requests until Retry or a new query.
  const box = new ComboboxDemoPage(page);
  await box.open({ results: 'normal', paged: true, pageFailure: true });
  await box.typeText('ad');
  await box.expectOptions(['Ada', 'Grace', 'Linus']);
  await box.loadMore();
  await box.expectSearchError();
  await box.expectLoadMoreDisabled();
  await box.expectRequests(['ad:0', 'ad:1']);
  await box.expectNoAccessibilityViolations();
});

test('editing after a failed page blocks retry of the stale query', async ({ page }) => {
  // L2-023 AC6; L2-025 AC7/9: Given a failed append, when text changes during debounce,
  // then Enter and pointer Retry cannot reissue the previous query; the new first page replaces it.
  const box = new ComboboxDemoPage(page);
  await box.open({ results: 'normal', paged: true, pageFailure: true });
  await box.typeText('ad');
  await box.expectOptions(['Ada', 'Grace', 'Linus']);
  await box.loadMore();
  await box.expectSearchError();
  await box.freezeTime();
  await box.typeText('gr');
  await box.pressKey('Enter');
  await box.retry();
  await box.expectRequests(['ad:0', 'ad:1']);
  await box.elapse(300);
  await box.expectRequests(['ad:0', 'ad:1', 'gr:0']);
  await box.resumeTime();
  await box.expectOptions(['Ada', 'Grace', 'Linus']);
  await box.expectNoAccessibilityViolations();
});

test('PageDown at the last option requests the next page without changing the active option', async ({
  page,
}) => {
  // L2-033 AC16; L2-025 AC2: Given last active with hasMore, PageDown loads and preserves it.
  const box = new ComboboxDemoPage(page);
  await box.open({ results: 'normal', paged: true });
  await box.typeText('ad');
  await box.expectOptions(['Ada', 'Grace', 'Linus']);
  await box.pressKey('PageDown');
  await box.expectActiveOption('Linus');
  await box.pressKey('PageDown');
  await box.expectOptions(['Ada', 'Grace', 'Linus', 'Morgan', 'Sam']);
  await box.expectActiveOption('Linus');
  await box.expectRequests(['ad:0', 'ad:1']);
  await box.expectNoAccessibilityViolations();
});

test('scrolling to the end requests one page while loading', async ({ page }) => {
  // L2-025 AC1/3: Given an overflowing list, reaching its end appends a page once.
  const box = new ComboboxDemoPage(page);
  await box.open({ results: 'normal', longPage: true, paged: true, responseDelay: 500 });
  await box.typeText('ad');
  const first = Array.from({ length: 30 }, (_, i) => `Learner ${i + 1}`);
  await box.expectOptions(first);
  await box.freezeTime();
  await box.scrollResultsToEnd();
  await box.scrollResultsToEnd();
  await box.expectRequests(['ad:0', 'ad:1']);
  await box.elapse(500);
  await box.resumeTime();
  await box.expectOptions([...first, 'Morgan', 'Sam']);
  await box.expectNoAccessibilityViolations();
});

test('appends a page through the explicit pointer action and exposes positions', async ({
  page,
}) => {
  // L2-025 AC5/8; L2-036 AC9: Given hasMore and total, Load more appends and announces the added count.
  const box = new ComboboxDemoPage(page);
  await box.open({ results: 'normal', paged: true, total: 5 });
  await box.typeText('ad');
  await box.expectOptions(['Ada', 'Grace', 'Linus']);
  await box.expectOptionPositions(5);
  await box.loadMore();
  await box.expectOptions(['Ada', 'Grace', 'Linus', 'Morgan', 'Sam']);
  await box.expectOptionPositions(5);
  await box.expectAnnouncement('2 more results loaded.');
  await box.expectRequests(['ad:0', 'ad:1']);
  await box.expectInput('ad');
  await box.expectNoAccessibilityViolations();
});

test('arrows past the last option once, preserving the active option until another arrow', async ({
  page,
}) => {
  // L2-025 AC2/3: Given a delayed next page, repeated ArrowDown does not duplicate it or jump on arrival.
  const box = new ComboboxDemoPage(page);
  await box.open({ results: 'normal', paged: true, responseDelay: 500 });
  await box.typeText('ad');
  await box.expectOptions(['Ada', 'Grace', 'Linus']);
  await box.expectOptionPositions(null);
  await box.pressKey('ArrowDown');
  await box.pressKey('ArrowDown');
  await box.expectActiveOption('Linus');
  await box.freezeTime();
  await box.pressKey('ArrowDown');
  await box.pressKey('ArrowDown');
  await box.expectRequests(['ad:0', 'ad:1']);
  await box.expectActiveOption('Linus');
  await box.elapse(500);
  await box.resumeTime();
  await box.expectOptions(['Ada', 'Grace', 'Linus', 'Morgan', 'Sam']);
  await box.expectActiveOption('Linus');
  await box.pressKey('ArrowDown');
  await box.expectActiveOption('Morgan');
  await box.pressKey('ArrowDown');
  await box.pressKey('ArrowDown');
  await box.expectActiveOption('Sam');
  await box.expectRequests(['ad:0', 'ad:1']);
  await box.expectNoAccessibilityViolations();
});

test('retries the failed next page without losing loaded options and resets on a new query', async ({
  page,
}) => {
  // L2-025 AC6/7: Given a failed append, Retry repeats its descriptor, then a new query replaces all pages.
  const box = new ComboboxDemoPage(page);
  await box.open({ results: 'normal', paged: true, pageFailure: true });
  await box.typeText('ad');
  await box.expectOptions(['Ada', 'Grace', 'Linus']);
  await box.loadMore();
  await box.expectSearchError();
  await box.expectOptions(['Ada', 'Grace', 'Linus']);
  await box.pressKey('ArrowDown');
  await box.expectRequests(['ad:0', 'ad:1']);
  await box.pressKey('Enter');
  await box.expectOptions(['Ada', 'Grace', 'Linus', 'Morgan', 'Sam']);
  await box.typeText('gr');
  await box.expectOptions(['Ada', 'Grace', 'Linus']);
  await box.expectRequests(['ad:0', 'ad:1', 'ad:1', 'gr:0']);
  await box.expectNoAccessibilityViolations();
});

test('loads through Enter without an active option and never loops on an empty page', async ({
  page,
}) => {
  // L2-025 AC8: Given an empty first page with more available, Enter requests the next page once.
  const box = new ComboboxDemoPage(page);
  await box.open({ paged: true });
  await box.typeText('ad');
  await box.expectMessage('No results');
  await box.expectRequests(['ad:0']);
  await box.pressKey('Enter');
  await box.expectRequests(['ad:0', 'ad:1']);
  await box.expectOptions([]);
  await box.expectNoAccessibilityViolations();
});
