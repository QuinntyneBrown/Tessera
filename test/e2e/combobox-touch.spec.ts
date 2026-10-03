// Acceptance tests. Traces to L2-039, L2-040, L2-048.
import { test } from '@playwright/test';
import { ComboboxDemoPage } from './pages/combobox-demo-page';
test.use({ hasTouch: true });

test('touch selection and toggle keep input focus and an outside tap dismisses', async ({
  page,
}) => {
  // L2-040 AC1/2/3: Given touch input, tapping toggles once with retained input focus.
  const box = new ComboboxDemoPage(page);
  await box.useViewport(320);
  await box.open({ results: 'normal' });
  await box.typeText('ad');
  await box.expectOptions(['Ada', 'Grace', 'Linus']);
  await box.tapOption('Grace');
  await box.expectSelected('Grace', true);
  await box.expectInput('ad');
  await box.tapOutside();
  await box.expectExpanded(false);
  await box.tapToggle();
  await box.expectExpanded(true);
  await box.expectInput('ad');
  await box.expectNoAccessibilityViolations();
});
