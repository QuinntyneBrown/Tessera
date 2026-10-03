// Acceptance tests. Traces to L2-027, L2-037, L2-038, L2-039, L2-048.
import { test } from '@playwright/test';
import { ComboboxDemoPage } from './pages/combobox-demo-page';

for (const colorScheme of ['light', 'dark'] as const) {
  test(`meets measured text, icon, border and focus contrast in ${colorScheme}`, async ({
    page,
  }) => {
    // L2-038 AC1; L2-037 AC3: Given default palette, rendered foregrounds meet their contrast thresholds.
    await page.emulateMedia({ colorScheme });
    const box = new ComboboxDemoPage(page);
    await box.open({ results: 'normal', value: 'Ada', disabledOption: 'Grace' });
    await box.typeText('ad');
    await box.expectOptions(['Ada', 'Grace', 'Linus']);
    await box.focusChip('Ada');
    await box.expectContrast();
    await box.expectNoAccessibilityViolations();
  });
}

for (const width of [320, 576, 768, 992, 1200, 1920]) {
  test(`wraps and bounds long chips at ${width} CSS px`, async ({ page }) => {
    // L2-027 AC7/8; L2-039 AC1/5: Given many long chips, no page overflow and every target remains usable.
    const box = new ComboboxDemoPage(page);
    await box.useViewport(width);
    await box.open({ valueSize: 30, results: 'normal' });
    await box.typeText('ad');
    await box.expectOptions(['Ada', 'Grace', 'Linus']);
    await box.expectResponsiveField();
    await box.expectNoAccessibilityViolations();
  });
}

for (const adaptation of ['text', 'spacing']) {
  test(`preserves controls with enlarged ${adaptation}`, async ({ page }) => {
    // L2-039 AC3/4: Given text or spacing overrides, content remains operable without horizontal overflow.
    const box = new ComboboxDemoPage(page);
    await box.useViewport(320);
    await box.open({ valueSize: 30, results: 'normal' });
    if (adaptation === 'text') await box.enlargeText();
    else await box.applyTextSpacing();
    await box.typeText('ad');
    await box.expectOptions(['Ada', 'Grace', 'Linus']);
    await box.expectResponsiveField();
    await box.toggleOption('Ada');
    await box.expectSelected('Ada', true);
    await box.expectNoAccessibilityViolations();
  });
}

test('keeps focus and option state cues visible in forced colors with reduced motion', async ({
  page,
}) => {
  // L2-037 AC3/4; L2-038 AC2/3/4: Given accessibility media preferences, structural state cues remain.
  const box = new ComboboxDemoPage(page);
  await box.emulateAccessibilityMedia();
  await box.open({ value: 'Ada', results: 'normal', disabledOption: 'Grace' });
  await box.typeText('ad');
  await box.expectOptions(['Ada', 'Grace', 'Linus']);
  await box.expectVisibleStates();
  await box.expectNoAccessibilityViolations();
});
