// Acceptance tests. Traces to L2-046, L2-047, L2-048.
import { test } from '@playwright/test';
import { ComboboxDemoPage } from './pages/combobox-demo-page';

test('consumer harness operates and scopes two real zoneless TestBed comboboxes', async ({
  page,
}) => {
  // L2-047 AC1–5: Given a consumer loader, the public harness operates, reads, rejects missing options and isolates instances.
  const box = new ComboboxDemoPage(page);
  await box.open();
  await box.verifyHarnessContract();
  await box.expectNoAccessibilityViolations();
});
