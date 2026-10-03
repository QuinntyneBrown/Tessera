// Acceptance tests. Traces to L2-035, L2-048.
import { test } from '@playwright/test';
import { ComboboxDemoPage } from './pages/combobox-demo-page';

test('renders a named combobox that starts closed', async ({ page }) => {
  // L2-035 AC1; L2-048 AC1
  const combobox = new ComboboxDemoPage(page);
  await combobox.open();
  await combobox.expectClosedNamedInput();
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
