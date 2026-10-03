// Acceptance tests. Traces to L2-023, L2-030, L2-046, L2-048.
import { expect, test } from '@playwright/test';
import { ComboboxDemoPage } from './pages/combobox-demo-page';

test('destroy cancels requests and removes popup, observers and delayed work', async ({ page }) => {
  // L2-046 AC2/3/4: Given an open request, unmount releases owned resources and later events do nothing.
  const box = new ComboboxDemoPage(page);
  await box.open({ responseDelay: 5000 });
  await box.typeText('ad');
  await box.expectRequests(['ad:0']);
  await box.setMounted(false);
  await box.expectCancellations(['ad:0']);
  await box.expectDisposed();
  await box.emitLaterEvents();
  await box.expectRequests(['ad:0']);
  await box.expectNoAccessibilityViolations();
});

test('100 repeated mounts and destroys return panes and document listeners to their warm baseline', async ({
  page,
}) => {
  // L2-046 AC5: Given repeated real mounts, component-owned resources return to baseline.
  test.setTimeout(180000);
  const box = new ComboboxDemoPage(page);
  await box.open({ minSearchLength: 0, results: 'normal' });
  await box.openList();
  await box.setMounted(false);
  await box.expectDisposed();
  const baseline = await box.documentListenerCount();
  for (let i = 0; i < 100; i++) {
    await box.setMounted(true);
    await box.openList();
    await box.setMounted(false);
  }
  await box.expectDisposed();
  expect(await box.documentListenerCount()).toBe(baseline);
  await box.emitLaterEvents();
  await box.expectNoAccessibilityViolations();
});
