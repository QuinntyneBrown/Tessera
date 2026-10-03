// Acceptance tests. Traces to L2-035, L2-044, L2-048.
import { test } from '@playwright/test';
import { ComboboxDemoPage } from './pages/combobox-demo-page';

test('renders hostile labels and queries as literal text in options, chips, descriptions and speech', async ({
  page,
}) => {
  // L2-044 AC1–4: Given untrusted markup, it remains text in every component-owned rendering path.
  const label = '<img src=x onerror="window.__xss=1">';
  const box = new ComboboxDemoPage(page);
  await box.open({ results: 'normal', hostile: true });
  await box.typeText(label);
  await box.expectOptions([label, 'Grace', 'Linus']);
  await box.expectRequests([`${label}:0`]);
  await box.expectAnnouncement('3 results available.');
  await box.toggleOption(label);
  await box.expectChips([label]);
  await box.expectAnnouncement(`${label} selected. 1 selected in total.`);
  await box.expectLiteralRendering(label);
  await box.expectNoAccessibilityViolations();
});

test('generated references are unique across two open instances', async ({ page }) => {
  // L2-044 AC3/5: Given two instances, option ids and controls references never collide.
  const box = new ComboboxDemoPage(page);
  await box.open({ results: 'normal', instances: 2 });
  await box.typeText('ad');
  await box.expectOptions(['Ada', 'Grace', 'Linus']);
  await box.verifyInstanceIds();
  await box.expectNoAccessibilityViolations();
});
