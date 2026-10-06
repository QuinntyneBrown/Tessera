// Acceptance tests. Traces to L2-031, L2-043, L2-046, L2-048, L2-056.
import { test } from '@playwright/test';
import { ComboboxDemoPage } from './pages/combobox-demo-page';
test('strict separate application consumes the tarball with forms, content slots and an ordinary label', async ({
  page,
}) => {
  // L2-042 AC1/2/3; L2-043 AC5: Given a separate strict application without aliases,
  // the packed package compiles content slots, renders objects and exchanges form values.
  const box = new ComboboxDemoPage(page);
  await box.verifyPackedConsumer();
  await box.expectNoAccessibilityViolations();
});

test('packed theme API themes both component packages without source aliases', async ({ page }) => {
  // L2-056: Given installed tarballs, a strict consumer applies shared themes to both components.
  const consumer = new ComboboxDemoPage(page);
  await consumer.verifyPackedThemes();
  await consumer.expectNoAccessibilityViolations();
});
