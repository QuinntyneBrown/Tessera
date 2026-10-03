// Acceptance tests. Traces to L2-022, L2-029, L2-030, L2-035, L2-048.
import { test } from '@playwright/test';
import { ComboboxDemoPage } from './pages/combobox-demo-page';

test('renders a named combobox that starts closed', async ({ page }) => {
  // L2-035 AC1; L2-048 AC1
  const combobox = new ComboboxDemoPage(page);
  await combobox.open();
  await combobox.expectClosedNamedInput();
  await combobox.expectNoAccessibilityViolations();
});

test('emits each committed text change once even below the minimum', async ({ page }) => {
  // L2-022 AC7/8: Given debounced edits, when they commit, then emit the unchanged query once.
  const box = new ComboboxDemoPage(page);
  await box.open({ minSearchLength: 2 });
  await box.freezeTime();
  await box.typeText('a');
  await box.elapse(300);
  await box.expectEvents(['searchChange:"a"'], 'searchChange');
  await box.typeText('ad');
  await box.elapse(300);
  await box.expectEvents(['searchChange:"a"', 'searchChange:"ad"'], 'searchChange');
  await box.expectRequests(['ad:0']);
  await box.resumeTime();
  await box.expectNoAccessibilityViolations();
});

test('loads empty-query results once when minimum length is zero', async ({ page }) => {
  // L2-022 AC4: Given minimum zero, when opened without text, then fetch the first page once.
  const box = new ComboboxDemoPage(page);
  await box.open({ minSearchLength: 0, results: 'normal' });
  await box.openList();
  await box.expectOptions(['Ada', 'Grace', 'Linus']);
  await box.expectRequests([':0']);
  await box.closeList('Escape');
  await box.openList();
  await box.expectRequests([':0']);
  await box.expectNoAccessibilityViolations();
});

test('clears options when the committed query is too short', async ({ page }) => {
  // L2-022 AC8: Given loaded results, when query falls below minimum, then clear options and show instruction.
  const combobox = new ComboboxDemoPage(page);
  await combobox.open({ results: 'normal', minSearchLength: 2 });
  await combobox.typeText('ad');
  await combobox.expectOptions(['Ada', 'Grace', 'Linus']);
  await combobox.typeText('a');
  await combobox.expectMessage('Type at least 2 characters to search.');
  await combobox.expectOptions([]);
  await combobox.expectRequests(['ad:0']);
  await combobox.expectNoAccessibilityViolations();
});

test('shows a non-option empty state', async ({ page }) => {
  // L2-024 AC3/7: Given an empty page, when it arrives, then show No results outside the options.
  const combobox = new ComboboxDemoPage(page);
  await combobox.open();
  await combobox.typeText('ad');
  await combobox.expectRequests(['ad:0']);
  await combobox.expectMessage('No results');
  await combobox.expectOptions([]);
  await combobox.expectNoAccessibilityViolations();
});

for (const failure of ['observable', 'throw', 'empty']) {
  test(`recovers from ${failure} search failure through Retry`, async ({ page }) => {
    // L2-024 AC4/5: Given a failed search, when Retry is activated, then the same search succeeds.
    const combobox = new ComboboxDemoPage(page);
    await combobox.open({ failure, results: 'normal' });
    await combobox.typeText('ad');
    await combobox.expectSearchError();
    await combobox.expectNoAccessibilityViolations();
    await combobox.retry();
    await combobox.expectOptions(['Ada', 'Grace', 'Linus']);
    await combobox.expectRequests(['ad:0', 'ad:0']);
    await combobox.expectOpenPopup();
    await combobox.expectNoAccessibilityViolations();
  });
}

test('keeps results available while a replacement search loads', async ({ page }) => {
  // L2-024 AC1/2: Given previous results, when another request loads, then retain options and expose busy.
  const combobox = new ComboboxDemoPage(page);
  await combobox.open({ responseDelay: 500, results: 'normal' });
  await combobox.typeText('ad');
  await combobox.expectOptions(['Ada', 'Grace', 'Linus']);
  await combobox.freezeTime();
  await combobox.typeText('gr');
  await combobox.elapse(300);
  await combobox.resumeTime();
  await combobox.expectLoading(true);
  await combobox.expectOptions(['Ada', 'Grace', 'Linus']);
  await combobox.expectNoAccessibilityViolations();
  await combobox.expectLoading(false);
});

test('invalidates a pending request as soon as the query changes', async ({ page }) => {
  // L2-023 AC1, AC6: Given an in-flight request, when text changes, then unsubscribe before debounce.
  const combobox = new ComboboxDemoPage(page);
  await combobox.open({ responseDelay: 1000, results: 'normal' });
  await combobox.freezeTime();
  await combobox.typeText('a');
  await combobox.elapse(300);
  await combobox.expectRequests(['a:0']);
  await combobox.typeText('ab');
  await combobox.expectCancellations(['a:0']);
  await combobox.elapse(299);
  await combobox.expectRequests(['a:0']);
  await combobox.elapse(1001);
  await combobox.expectRequests(['a:0', 'ab:0']);
  await combobox.resumeTime();
  await combobox.expectOptions(['Ada', 'Grace', 'Linus']);
  await combobox.expectNoAccessibilityViolations();
});

test('typing opens an inline accessible results popup', async ({ page }) => {
  // L2-029 AC2; L2-030 AC7; L2-035 AC3, AC6: typing opens the controlled multi-select list.
  const combobox = new ComboboxDemoPage(page);
  await combobox.open({ results: 'normal' });
  await combobox.typeText('ad');
  await combobox.expectOptions(['Ada', 'Grace', 'Linus']);
  await combobox.expectOpenPopup();
  await combobox.expectNoAccessibilityViolations();
});

test('searches only after composition has ended', async ({ page }) => {
  // L2-022 AC6, AC10: Given pending text, when IME starts, then search waits for compositionend.
  const combobox = new ComboboxDemoPage(page);
  await combobox.open();
  await combobox.freezeTime();
  await combobox.typeText('m');
  await combobox.elapse(100);
  await combobox.compose('も');
  await combobox.elapse(500);
  await combobox.expectRequests([]);
  await combobox.compose('もり', true);
  await combobox.elapse(299);
  await combobox.expectRequests([]);
  await combobox.elapse(1);
  await combobox.expectRequests(['もり:0']);
  await combobox.resumeTime();
  await combobox.expectNoAccessibilityViolations();
});

test('reuses a completed query after edits within the pause', async ({ page }) => {
  // L2-022 AC5: Given completed ada, when text returns to ada during debounce, then no refetch.
  const combobox = new ComboboxDemoPage(page);
  await combobox.open();
  await combobox.freezeTime();
  await combobox.typeText('ada');
  await combobox.elapse(300);
  await combobox.expectRequests(['ada:0']);
  await combobox.typeText('adax');
  await combobox.elapse(100);
  await combobox.typeText('ada');
  await combobox.elapse(300);
  await combobox.expectRequests(['ada:0']);
  await combobox.resumeTime();
  await combobox.expectNoAccessibilityViolations();
});

test('waits for the minimum query length', async ({ page }) => {
  // L2-022 AC3: Given minimum 2, when one character is committed, then no search runs.
  const combobox = new ComboboxDemoPage(page);
  await combobox.open({ minSearchLength: 2 });
  await combobox.freezeTime();
  await combobox.typeText('a');
  await combobox.elapse(300);
  await combobox.expectRequests([]);
  await combobox.typeText('ad');
  await combobox.elapse(300);
  await combobox.expectRequests(['ad:0']);
  await combobox.resumeTime();
  await combobox.expectNoAccessibilityViolations();
});

test('honors the configured search pause', async ({ page }) => {
  // L2-022 AC2: Given 500 ms debounce, when typing stops, then search waits 500 ms.
  const combobox = new ComboboxDemoPage(page);
  await combobox.open({ debounceMs: 500 });
  await combobox.freezeTime();
  await combobox.typeText('ad');
  await combobox.elapse(499);
  await combobox.expectRequests([]);
  await combobox.elapse(1);
  await combobox.expectRequests(['ad:0']);
  await combobox.resumeTime();
  await combobox.expectNoAccessibilityViolations();
});

test('searches once 300 milliseconds after the last character', async ({ page }) => {
  // L2-022 AC1; L2-048 AC1
  const combobox = new ComboboxDemoPage(page);
  await combobox.open();
  await combobox.freezeTime();
  await combobox.typeText('a');
  await combobox.elapse(100);
  await combobox.typeText('ad');
  await combobox.elapse(299);
  await combobox.expectRequests([]);
  await combobox.elapse(1);
  await combobox.expectRequests(['ad:0']);
  await combobox.resumeTime();
  await combobox.expectNoAccessibilityViolations();
});
