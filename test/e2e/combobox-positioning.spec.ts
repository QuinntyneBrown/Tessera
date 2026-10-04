// Acceptance tests. Traces to L2-030, L2-037, L2-039, L2-048.
import { expect, test } from '@playwright/test';
import { ComboboxDemoPage } from './pages/combobox-demo-page';

for (const dialog of ['native', 'cdk']) {
  for (const fallback of [false, true]) {
    test(`supports pointer selection and Escape in ${dialog} dialog with fallback=${fallback}`, async ({
      page,
    }) => {
      // L2-030 AC6/7: Given either modal host, results receive pointer events and input Escape closes only the list.
      const box = new ComboboxDemoPage(page);
      if (fallback) await box.disablePopoverSupport();
      await box.open({ dialog, results: 'normal' });
      await box.typeText('ad');
      await box.expectOptions(['Ada', 'Grace', 'Linus']);
      await box.expectThemedPopup();
      if (!fallback) await box.expectOpenPopup();
      await box.toggleOption('Grace');
      await box.expectSelected('Grace', true);
      await box.expectInput('ad');
      await box.closeList('Escape');
      await box.expectExpanded(false);
      await box.expectChips(['Grace']);
      await box.expectNoAccessibilityViolations();
    });
  }
}

test('tracks container and viewport resizes without losing text, selection or focus', async ({
  page,
}) => {
  // L2-030 AC1/3; L2-039 AC6: Given an open list, geometry follows size changes and state persists.
  const box = new ComboboxDemoPage(page);
  await box.useViewport(768);
  await box.open({ results: 'normal', containerWidth: 500 });
  await box.typeText('ad');
  await box.expectOptions(['Ada', 'Grace', 'Linus']);
  await box.toggleOption('Ada');
  await box.expectPopupGeometry();
  await box.resizeContainer(280);
  await box.expectPopupGeometry();
  await box.useViewport(320);
  await box.expectPopupGeometry();
  await box.expectInputAndSelectionRetained();
  await box.expectNoAccessibilityViolations();
});

test('follows host content expansion and collapse without resizing the field', async ({ page }) => {
  // L2-030 AC8: Given a focused field with an open list, when host content above it
  // expands and collapses without resizing the field, then alignment and input state persist.
  const box = new ComboboxDemoPage(page);
  await box.open({ results: 'normal', hostLayout: true });
  await box.typeText('ad');
  await box.expectOptions(['Ada', 'Grace', 'Linus']);
  await box.toggleOption('Ada');
  await box.expectPopupGeometry();
  await box.toggleHostBanner();
  await box.expectPopupGeometry();
  await box.expectInputAndSelectionRetained();
  await box.toggleHostBanner();
  await box.expectPopupGeometry();
  await box.expectInputAndSelectionRetained();
  await box.expectNoAccessibilityViolations();
});

test('avoids popup layout work for unrelated host renders', async ({ page }) => {
  // Given an open popup with settled geometry, when unrelated host state renders repeatedly,
  // then the popup remains aligned without repeating browser layout work.
  const box = new ComboboxDemoPage(page);
  await box.open({ results: 'normal' });
  await box.typeText('ad');
  await box.expectOptions(['Ada', 'Grace', 'Linus']);
  await box.expectPopupGeometry();
  await box.closeList('Escape');
  const closedPopupLayouts = await box.measureUnrelatedHostRenderLayouts(10);
  await box.openList();
  await box.expectPopupGeometry();
  const openPopupLayouts = await box.measureUnrelatedHostRenderLayouts(20);
  expect(openPopupLayouts).toBeLessThanOrEqual(closedPopupLayouts + 4);
  await box.expectExpanded(true);
  await box.expectPopupGeometry();
  await box.expectNoAccessibilityViolations();
});

test('follows scrolling in an unregistered ancestor without clipping the list', async ({
  page,
}) => {
  // L2-030 AC3: Given a plain overflow ancestor, scroll repositions the top-layer list.
  const box = new ComboboxDemoPage(page);
  await box.open({ results: 'normal', scroll: true });
  await box.typeText('ad');
  await box.expectOptions(['Ada', 'Grace', 'Linus']);
  await box.scrollAncestor();
  await box.expectPopupGeometry();
  await box.toggleOption('Grace');
  await box.expectSelected('Grace', true);
  await box.expectNoAccessibilityViolations();
});

test('keeps the focused input uncovered in the 320 by 256 reflow viewport', async ({ page }) => {
  // L2-030 AC2/4; L2-039 AC2; L2-048 AC3: CSS reflow geometry, separately from manual actual zoom.
  const box = new ComboboxDemoPage(page);
  await box.useViewport(320, 256);
  await box.open({ results: 'normal', valueSize: 200, longPage: true, paged: true });
  await box.typeText('ad');
  await box.expectOptions(Array.from({ length: 30 }, (_, i) => `Learner ${i + 1}`));
  await box.expectPopupGeometry();
  await box.expectResponsiveField();
  await box.pressKey('PageDown');
  await box.pressKey('Enter');
  await box.expectNoAccessibilityViolations();
});
