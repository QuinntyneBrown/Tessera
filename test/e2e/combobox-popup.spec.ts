// Acceptance tests. Traces to L2-029, L2-035, L2-048.
import { test } from '@playwright/test';
import { ComboboxDemoPage } from './pages/combobox-demo-page';

for (const trigger of ['ArrowDown', 'ArrowUp', 'Alt+ArrowDown', 'field', 'toggle']) {
  test(`opens once through ${trigger} and stays closed on focus alone`, async ({ page }) => {
    // L2-029 AC1/2: Given closed, when explicitly opened, then emit once; focus alone does not open.
    const box = new ComboboxDemoPage(page);
    await box.open();
    await box.focusInput();
    await box.expectExpanded(false);
    await box.openList(trigger);
    await box.expectExpanded(true);
    await box.expectEvents(['opened'], 'transition');
    await box.expectNoAccessibilityViolations();
  });
}

for (const trigger of ['Escape', 'Tab', 'Alt+ArrowUp', 'outside', 'toggle']) {
  test(`closes once through ${trigger}`, async ({ page }) => {
    // L2-029 AC3/4: Given open, when dismissed, then emit once and let browser move focus naturally.
    const box = new ComboboxDemoPage(page);
    await box.open();
    await box.typeText('ad');
    await box.expectExpanded(true);
    await box.closeList(trigger);
    await box.expectExpanded(false);
    await box.expectEvents(['opened', 'closed'], 'transition');
    await box.expectNoAccessibilityViolations();
  });
}
