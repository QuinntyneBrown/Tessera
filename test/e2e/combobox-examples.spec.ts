// Acceptance tests. Traces to L2-031, L2-032, L2-042, L2-043, L2-048, L2-050.
import { test } from '@playwright/test';
import { ComboboxDemoPage } from './pages/combobox-demo-page';

test('runnable examples demonstrate all five documented adoption patterns', async ({ page }) => {
  // L2-050 AC2/3: Given the example screen, all form/model/template/paging examples run.
  const box = new ComboboxDemoPage(page);
  await box.openExamples();
  await box.verifyExamples();
  await box.expectNoAccessibilityViolations();
});
