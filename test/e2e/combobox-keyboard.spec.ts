// Acceptance tests. Traces to L2-029, L2-033, L2-034, L2-035, L2-037, L2-048.
import { test } from '@playwright/test';
import { ComboboxDemoPage } from './pages/combobox-demo-page';

test('pointer cursor movement returns Space to text editing after option navigation', async ({
  page,
}) => {
  // L2-033 AC15: Given a cursor move after navigation, Space inserts text instead of toggling a result.
  const box = new ComboboxDemoPage(page);
  await box.open({ results: 'normal' });
  await box.typeText('ad');
  await box.expectOptions(['Ada', 'Grace', 'Linus']);
  await box.pressKey('ArrowDown');
  await box.moveCursorByPointer();
  await box.pressKey('Space');
  await box.expectInput('ad ');
  await box.expectChips([]);
  await box.expectNoAccessibilityViolations();
});

for (const [key, active] of [
  ['ArrowDown', 'Ada'],
  ['ArrowUp', 'Linus'],
  ['Alt+ArrowDown', null],
] as const) {
  test(`preserves the ${key} opening mode when results render`, async ({ page }) => {
    // L2-029 AC5; L2-033 AC1/2/3: Given closed, when opened, then activate according to opening mode.
    const box = new ComboboxDemoPage(page);
    await box.open({ minSearchLength: 0, results: 'normal' });
    await box.openList(key);
    await box.expectOptions(['Ada', 'Grace', 'Linus']);
    await box.expectActiveOption(active);
    await box.expectNoAccessibilityViolations();
  });
}

test('navigates without wrapping and reaches disabled options with input focus', async ({
  page,
}) => {
  // L2-033 AC1/2/4; L2-035 AC4/7; L2-037 AC1: Given options, arrows update active descendant only.
  const box = new ComboboxDemoPage(page);
  await box.open({ minSearchLength: 0, results: 'normal', disabledOption: 'Grace' });
  await box.openList('ArrowDown');
  await box.expectActiveOption('Ada');
  for (const label of ['Grace', 'Linus', 'Linus']) {
    await box.pressKey('ArrowDown');
    await box.expectActiveOption(label);
  }
  for (const label of ['Grace', 'Ada', 'Ada']) {
    await box.pressKey('ArrowUp');
    await box.expectActiveOption(label);
  }
  await box.expectEvents([], 'selectionChange');
  await box.closeList('Escape');
  await box.expectActiveOption(null);
  await box.expectNoAccessibilityViolations();
});

for (const key of ['Enter', 'Space', 'Backspace', 'Delete']) {
  test(`${key} removes a focused chip once and focuses its neighbor`, async ({ page }) => {
    // L2-034 AC1: Given focused chip, when removal key is pressed, then remove once and focus survivor.
    const box = new ComboboxDemoPage(page);
    await box.open({ value: 'Ada|Grace' });
    await box.focusChip('Grace');
    await box.pressKey(key);
    await box.expectChips(['Ada']);
    await box.expectFocusedRemoval('Ada');
    await box.expectEvents(
      ['selectionChange:{"removed":"Grace","value":["Ada"]}'],
      'selectionChange',
    );
    await box.expectAnnouncement('Grace removed.');
    await box.expectNoAccessibilityViolations();
  });
}

for (const direction of ['ltr', 'rtl']) {
  test(`moves between chips and input in ${direction}`, async ({ page }) => {
    // L2-033 AC12; L2-034 AC2/3/5: Given chips, horizontal keys follow direction without wrapping.
    const box = new ComboboxDemoPage(page);
    const previous = direction === 'ltr' ? 'ArrowLeft' : 'ArrowRight';
    const next = direction === 'ltr' ? 'ArrowRight' : 'ArrowLeft';
    await box.open({ value: 'Ada|Grace', direction });
    await box.focusInput();
    await box.pressKey(previous);
    await box.expectFocusedRemoval('Grace');
    await box.pressKey(previous);
    await box.expectFocusedRemoval('Ada');
    await box.pressKey(previous);
    await box.expectFocusedRemoval('Ada');
    await box.pressKey(next);
    await box.expectFocusedRemoval('Grace');
    await box.pressKey(next);
    await box.expectInput('');
    await box.expectChips(['Ada', 'Grace']);
    await box.expectNoAccessibilityViolations();
  });
}

test('Escape closes then clears text before reaching the containing application', async ({
  page,
}) => {
  // L2-033 AC8/9: Given open and text, first Escape closes, second clears, third propagates.
  const box = new ComboboxDemoPage(page);
  await box.open();
  await box.typeText('ad');
  await box.pressKey('Escape');
  await box.expectExpanded(false);
  await box.expectInput('ad');
  await box.expectAncestorEscapes(0);
  await box.pressKey('Escape');
  await box.expectExpanded(false);
  await box.expectInput('');
  await box.expectAncestorEscapes(0);
  await box.pressKey('Escape');
  await box.expectAncestorEscapes(1);
  await box.expectNoAccessibilityViolations();
});

test('uses Space for explicit option navigation and preserves native text editing', async ({
  page,
}) => {
  // L2-033 AC10/15: Given typing or cursor editing, Space inserts text; after explicit navigation it toggles.
  const box = new ComboboxDemoPage(page);
  await box.open({ results: 'normal' });
  await box.typeText('ad');
  await box.expectActiveOption('Ada');
  await box.pressKey('Space');
  await box.expectInput('ad ');
  await box.pressKey('ArrowDown');
  await box.expectActiveOption('Grace');
  await box.pressKey('Space');
  await box.expectSelected('Grace', true);
  await box.expectInput('ad ');
  await box.pressKey('End');
  await box.pressKey('Space');
  await box.expectInput('ad  ');
  await box.expectNoAccessibilityViolations();
});

test('moves by visible pages without wrapping', async ({ page }) => {
  // L2-033 AC16: Given an open list, Page keys navigate a visible page; from none choose first/last.
  const box = new ComboboxDemoPage(page);
  await box.open({ minSearchLength: 0, results: 'normal' });
  await box.openList('Alt+ArrowDown');
  await box.expectActiveOption(null);
  await box.pressKey('PageDown');
  await box.expectActiveOption('Ada');
  await box.pressKey('PageDown');
  await box.expectActiveOption('Linus');
  await box.pressKey('PageUp');
  await box.expectActiveOption('Ada');
  await box.pressKey('PageUp');
  await box.expectActiveOption('Ada');
  await box.expectNoAccessibilityViolations();
});

test('Backspace removes the last chip only when the input is empty', async ({ page }) => {
  // L2-033 AC11: Given chips, Backspace edits nonempty text or removes the last selected value.
  const box = new ComboboxDemoPage(page);
  await box.open({ value: 'Ada|Grace' });
  await box.typeText('ad');
  await box.pressKey('Backspace');
  await box.expectInput('a');
  await box.expectChips(['Ada', 'Grace']);
  await box.typeText('');
  await box.pressKey('Backspace');
  await box.expectChips(['Ada']);
  await box.expectInput('');
  await box.expectAnnouncement('Grace removed.');
  await box.expectNoAccessibilityViolations();
});

test('Enter toggles the active option without submitting the open form', async ({ page }) => {
  // L2-033 AC5/6: Given an open list in a form, Enter toggles; closed Enter uses native submission.
  const box = new ComboboxDemoPage(page);
  await box.open({ minSearchLength: 0, results: 'normal' });
  await box.openList('ArrowDown');
  await box.expectActiveOption('Ada');
  await box.pressKey('Enter');
  await box.expectSelected('Ada', true);
  await box.expectChips(['Ada']);
  await box.expectSubmissions(0);
  await box.closeList('Escape');
  await box.pressKey('Enter');
  await box.expectSubmissions(1);
  await box.expectNoAccessibilityViolations();
});

test('Enter retries a failed search and ignores disabled active options', async ({ page }) => {
  // L2-033 AC7; L2-026 AC6: Given an error or disabled active option, Enter retries or preserves value.
  const box = new ComboboxDemoPage(page);
  await box.open({ failure: 'observable', results: 'normal', disabledOption: 'Grace' });
  await box.typeText('ad');
  await box.expectSearchError();
  await box.pressKey('Enter');
  await box.expectActiveOption('Ada');
  await box.pressKey('ArrowDown');
  await box.expectActiveOption('Grace');
  await box.pressKey('Enter');
  await box.expectSelected('Grace', false);
  await box.expectSubmissions(0);
  await box.expectNoAccessibilityViolations();
});
