// Acceptance tests. Traces to L2-027, L2-033, L2-048.
import { test } from '@playwright/test';
import { ComboboxDemoPage } from './pages/combobox-demo-page';

test('shows a hoverable full-label tooltip and dismisses it before popup Escape', async ({
  page,
}) => {
  // L2-027 AC7/9: Given an ellipsized chip, hover reveals the whole label; Escape dismisses only the tooltip.
  const label = 'A very long learner name '.repeat(8);
  const box = new ComboboxDemoPage(page);
  await box.useViewport(320);
  await box.open({ value: label, results: 'normal' });
  await box.typeText('ad');
  await box.expectOptions(['Ada', 'Grace', 'Linus']);
  await box.hoverChip(label);
  await box.expectTooltip(label);
  await box.hoverTooltip();
  await box.expectTooltip(label);
  await box.pressKey('Escape');
  await box.expectTooltip(null);
  await box.expectExpanded(true);
  await box.expectChips([label]);
  await box.expectNoAccessibilityViolations();
});

test('reveals the full label on removal-button focus and closes on focus exit', async ({
  page,
}) => {
  // L2-027 AC7/9: Given keyboard focus on a truncated chip, full label remains until exit or dismissal.
  const label = 'A very long learner name '.repeat(8);
  const box = new ComboboxDemoPage(page);
  await box.useViewport(320);
  await box.open({ value: label });
  await box.focusChip(label);
  await box.expectTooltip(label);
  await box.focusInput();
  await box.expectTooltip(null);
  await box.expectNoAccessibilityViolations();
});
