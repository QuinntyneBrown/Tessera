// Acceptance tests. Traces to L2-026, L2-027, L2-028, L2-036, L2-048.
import { test } from '@playwright/test';
import { ComboboxDemoPage } from './pages/combobox-demo-page';

test('toggles an option once while keeping search, popup and input focus', async ({ page }) => {
  // L2-026 AC1/2/3/5: Given results, when activated twice, then add and remove exactly once.
  const box = new ComboboxDemoPage(page);
  await box.open({ results: 'normal' });
  await box.typeText('ad');
  await box.expectOptions(['Ada', 'Grace', 'Linus']);
  await box.toggleOption('Ada');
  await box.expectSelected('Ada', true);
  await box.expectInput('ad');
  await box.expectOpenPopup();
  await box.expectEvents(['selectionChange:{"added":"Ada","value":["Ada"]}'], 'selectionChange');
  await box.expectNoAccessibilityViolations();
  await box.toggleOption('Ada');
  await box.expectSelected('Ada', false);
  await box.expectEvents(
    [
      'selectionChange:{"added":"Ada","value":["Ada"]}',
      'selectionChange:{"removed":"Ada","value":[]}',
    ],
    'selectionChange',
  );
  await box.expectNoAccessibilityViolations();
});

test('clears search after addition only when configured', async ({ page }) => {
  // L2-026 AC4: Given clearSearchOnSelect, when adding a selection, then reset query and eligibility.
  const box = new ComboboxDemoPage(page);
  await box.open({ results: 'normal', clearSearchOnSelect: true });
  await box.typeText('ad');
  await box.expectOptions(['Ada', 'Grace', 'Linus']);
  await box.toggleOption('Ada');
  await box.expectInput('');
  await box.expectChips(['Ada']);
  await box.expectMessage('Type at least 1 characters to search.');
  await box.expectOptions([]);
  await box.expectNoAccessibilityViolations();
});

test('prevents additions at the limit while allowing removal', async ({ page }) => {
  // L2-028 AC3/4/5: Given a full value, when an unselected option is activated, then ignore it; allow deselection.
  const box = new ComboboxDemoPage(page);
  await box.open({ results: 'normal', value: 'Ada|Grace', maxSelections: 2 });
  await box.freezeTime();
  await box.typeText('ad');
  await box.elapse(200);
  await box.expectAnnouncement('Maximum of 2 selections reached.');
  await box.elapse(150);
  await box.resumeTime();
  await box.expectOptions(['Ada', 'Grace', 'Linus']);
  await box.expectOptionDisabled('Linus', true);
  await box.expectOptionDisabled('Ada', false);
  await box.toggleOption('Linus');
  await box.expectChips(['Ada', 'Grace']);
  await box.expectEvents([], 'selectionChange');
  await box.toggleOption('Ada');
  await box.expectOptionDisabled('Linus', false);
  await box.expectNoAccessibilityViolations();
});

test('ignores activation of a consumer-disabled option', async ({ page }) => {
  // L2-026 AC6: Given optionDisabled, when activated, then preserve value without selection output.
  const box = new ComboboxDemoPage(page);
  await box.open({ results: 'normal', disabledOption: 'Grace' });
  await box.typeText('ad');
  await box.expectOptionDisabled('Grace', true);
  await box.toggleOption('Grace');
  await box.expectSelected('Grace', false);
  await box.expectEvents([], 'selectionChange');
  await box.expectNoAccessibilityViolations();
});

test('matches and deselects new object instances with compareWith', async ({ page }) => {
  // L2-028 AC1/2: Given selected id 0, when a new instance arrives, then recognize and remove the stored value.
  const box = new ComboboxDemoPage(page);
  await box.open({ objects: true, value: 'Ada', results: 'normal' });
  await box.expectChips(['Ada']);
  await box.typeText('ad');
  await box.expectOptions(['Ada', 'Grace', 'Linus']);
  await box.expectSelected('Ada', true);
  await box.toggleOption('Ada');
  await box.expectChips([]);
  await box.expectSelected('Ada', false);
  await box.expectEvents(
    ['selectionChange:{"removed":{"id":0,"name":"Ada"},"value":[]}'],
    'selectionChange',
  );
  await box.expectNoAccessibilityViolations();
});

test('renders external selections and removes chips with surviving focus', async ({ page }) => {
  // L2-027 AC1/2/3/4/5/6: Given external values, when removed, then preserve selection order and focus.
  const box = new ComboboxDemoPage(page);
  await box.open({ value: 'Ada|Grace|External' });
  await box.expectChips(['Ada', 'Grace', 'External']);
  await box.expectEvents([], 'selectionChange');
  await box.removeChip('Grace');
  await box.expectChips(['Ada', 'External']);
  await box.expectFocusedRemoval('External');
  await box.removeChip('External');
  await box.expectFocusedRemoval('Ada');
  await box.clearAll();
  await box.expectChips([]);
  await box.expectInput('');
  await box.expectEvents(
    [
      'selectionChange:{"removed":"Grace","value":["Ada","External"]}',
      'selectionChange:{"removed":"External","value":["Ada"]}',
      'selectionChange:{"value":[]}',
    ],
    'selectionChange',
  );
  await box.expectNoAccessibilityViolations();
});
