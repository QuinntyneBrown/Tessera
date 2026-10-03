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
