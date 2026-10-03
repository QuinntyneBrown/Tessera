// Acceptance tests. Traces to L2-022, L2-023, L2-035, L2-043, L2-048.
import { test } from '@playwright/test';
import { ComboboxDemoPage } from './pages/combobox-demo-page';

test('reports a missing accessible name during development', async ({ page }) => {
  // L2-035 AC2: Given no visible label or ariaLabel, initialization diagnoses the integration error.
  const box = new ComboboxDemoPage(page);
  await box.open({ unlabelled: true });
  await box.expectIntegrationError('Combobox: an accessible name is required');
});

test('reports Angular NG0950 when searchFn is omitted', async ({ page }) => {
  // L2-043 AC4/8: Given a missing required source, reading it in initialization reports NG0950.
  const box = new ComboboxDemoPage(page);
  await box.open({ missingSearchFn: true });
  await box.expectIntegrationError('NG0950');
});

test('configuration changes re-evaluate search without emitting a text change', async ({
  page,
}) => {
  // Search design / L2-023 AC6 / L2-043 AC7: Given ineligible text, reducing minimum re-evaluates the current query.
  const box = new ComboboxDemoPage(page);
  await box.open({ results: 'normal', minSearchLength: 3 });
  await box.typeText('ad');
  await box.expectMessage('Type at least 3 characters to search.');
  await box.expectEvents(['searchChange:"ad"'], 'searchChange');
  await box.changeConfiguration();
  await box.openList();
  await box.expectOptions(['Ada', 'Grace', 'Linus']);
  await box.expectRequests(['ad:0']);
  await box.expectEvents(['searchChange:"ad"'], 'searchChange');
  await box.changeConfiguration();
  await box.openList();
  await box.expectRequests(['ad:0', 'ad:0']);
  await box.expectNoAccessibilityViolations();
});

for (const [name, value] of [
  ['debounceMs', -1],
  ['minSearchLength', 1.5],
  ['maxSelections', -1],
] as const) {
  test(`reports invalid ${name} as an integration error`, async ({ page }) => {
    // L2-043 AC7: Given invalid configuration, initialization reports the documented error.
    const box = new ComboboxDemoPage(page);
    await box.open({ [name]: value });
    await box.expectIntegrationError(`Combobox: invalid ${name}`);
  });
}
