// Acceptance tests. Traces to L2-022, L2-023, L2-031, L2-032, L2-034, L2-035, L2-036, L2-048.
import { test } from '@playwright/test';
import { ComboboxDemoPage } from './pages/combobox-demo-page';

test('reflects a replacement control and ignores events from its predecessor', async ({ page }) => {
  // L2-031 AC11: Given a new control identity, render its value/validation and unsubscribe the old one.
  const box = new ComboboxDemoPage(page);
  await box.open({ forms: 'reactive', value: 'Ada' });
  await box.replaceControl();
  await box.expectChips([]);
  await box.expectRequired(true, true);
  await box.expectDescriptions(['Selection is required.', 'Choose learners']);
  await box.disableOldControl();
  await box.expectDisabled(false);
  await box.expectRequired(true, true);
  await box.expectNoAccessibilityViolations();
});

test('honors updateOn submit until the containing form submits', async ({ page }) => {
  // L2-031 AC2: Given submit timing, selection stays pending through blur and commits once on submit.
  const box = new ComboboxDemoPage(page);
  await box.open({ forms: 'submit', results: 'normal', updateOn: 'submit' });
  await box.typeText('ad');
  await box.expectOptions(['Ada', 'Grace', 'Linus']);
  await box.toggleOption('Grace');
  await box.expectChips(['Grace']);
  await box.focusOutside();
  await box.expectFormState({ value: [], dirty: false, changes: 0 });
  await box.submitForm();
  await box.expectFormState({ value: ['Grace'], dirty: true, changes: 1 });
  await box.expectNoAccessibilityViolations();
});

test('synchronizes external model and control writes once without marking dirty or emitting selection', async ({
  page,
}) => {
  // L2-032 AC3/4: Given dual binding, the latest external write wins without an echo.
  const box = new ComboboxDemoPage(page);
  await box.open({ forms: 'dual', value: 'Ada', results: 'normal' });
  await box.writeExternal('model');
  await box.expectChips(['Grace']);
  await box.expectFormState({ value: ['Grace'], dirty: false, changes: 1 });
  await box.writeExternal('control');
  await box.expectChips(['Linus']);
  await box.expectModelValue(['Linus']);
  await box.expectFormState({ value: ['Linus'], dirty: false, changes: 2 });
  await box.expectEvents([], 'selectionChange');
  await box.typeText('ad');
  await box.expectOptions(['Ada', 'Grace', 'Linus']);
  await box.toggleOption('Ada');
  await box.expectFormState({ value: ['Linus', 'Ada'], dirty: true, changes: 3 });
  await box.expectModelValue(['Linus', 'Ada']);
  await box.expectNoAccessibilityViolations();
});

test('disabling cancels a pending request and permits retry on reopening', async ({ page }) => {
  // L2-023 AC3; L2-022 AC9; L2-031 AC3/4: Given a pending request, disable closes/cancels; reenable restores operation.
  const box = new ComboboxDemoPage(page);
  await box.open({ responseDelay: 1000, results: 'normal', value: 'Ada' });
  await box.typeText('ad');
  await box.expectRequests(['ad:0']);
  await box.setDisabled(true);
  await box.expectDisabled(true);
  await box.expectExpanded(false);
  await box.expectCancellations(['ad:0']);
  await box.expectChips(['Ada']);
  await box.expectNoAccessibilityViolations();
  await box.setDisabled(false);
  await box.expectDisabled(false);
  await box.openList();
  await box.expectRequests(['ad:0', 'ad:0']);
  await box.expectOptions(['Ada', 'Grace', 'Linus']);
  await box.expectNoAccessibilityViolations();
});

test('exposes required validation after genuine exit and clears it on reset', async ({ page }) => {
  // L2-031 AC7/8/9/11; L2-035 AC5: Given required validator alone, expose required and touched error/hint.
  const box = new ComboboxDemoPage(page);
  await box.open({ forms: 'reactive', validatorOnly: true });
  await box.expectRequired(true, false);
  await box.expectDescriptions(['Choose learners']);
  await box.focusInput();
  await box.focusOutside();
  await box.expectRequired(true, true);
  await box.expectDescriptions(['Selection is required.', 'Choose learners']);
  await box.expectNoAccessibilityViolations();
  await box.resetForm();
  await box.expectRequired(true, false);
  await box.expectDescriptions(['Choose learners']);
});

test('shows the localized default required error without forms and describes selections', async ({
  page,
}) => {
  // L2-031 AC10; L2-036 AC10: Given standalone required field, exit exposes default error; values have a summary.
  const box = new ComboboxDemoPage(page);
  await box.open({ required: true, hint: 'Choose learners', results: 'normal' });
  await box.expectRequired(true, false);
  await box.focusInput();
  await box.focusOutside();
  await box.expectRequired(true, true);
  await box.expectDescriptions(['Select at least one option.', 'Choose learners']);
  await box.typeText('ad');
  await box.expectOptions(['Ada', 'Grace', 'Linus']);
  await box.toggleOption('Ada');
  await box.expectRequired(true, false);
  await box.expectDescriptions(['Choose learners', '1 selected: Ada']);
  await box.expectNoAccessibilityViolations();
});

test('marks touched only when focus leaves the whole component', async ({ page }) => {
  // L2-031 AC5/6; L2-034 AC4: Given internal focus moves, when exiting by Tab, then mark touched.
  const box = new ComboboxDemoPage(page);
  await box.open({ forms: 'reactive', value: 'Ada' });
  await box.focusInput();
  await box.focusChip('Ada');
  await box.expectFormState({ touched: false });
  await box.focusInput();
  await box.pressKey('Tab');
  await box.expectFormState({ touched: false });
  await box.pressKey('Tab');
  await box.expectFormState({ touched: true });
  await box.expectNoAccessibilityViolations();
});

test('honors updateOn blur without committing during internal focus moves', async ({ page }) => {
  // L2-031 AC2/5/6: Given updateOn blur, when selection changes, then commit once only on genuine exit.
  const box = new ComboboxDemoPage(page);
  await box.open({ forms: 'reactive', value: 'Ada', results: 'normal', updateOn: 'blur' });
  await box.typeText('ad');
  await box.expectOptions(['Ada', 'Grace', 'Linus']);
  await box.toggleOption('Grace');
  await box.expectChips(['Ada', 'Grace']);
  await box.expectBoundValue(['Ada']);
  await box.focusChip('Ada');
  await box.expectFormState({ touched: false, dirty: false, changes: 0 });
  await box.focusOutside();
  await box.expectBoundValue(['Ada', 'Grace']);
  await box.expectFormState({ touched: true, dirty: true, changes: 1 });
  await box.expectNoAccessibilityViolations();
});

for (const forms of ['reactive', 'template', 'model']) {
  test(`exchanges array values through ${forms} binding`, async ({ page }) => {
    // L2-031 AC1/2; L2-032 AC1/2: Given a bound value, when selecting, then update the host once.
    const box = new ComboboxDemoPage(page);
    await box.open({ forms, value: 'Ada', results: 'normal' });
    await box.expectChips(['Ada']);
    await box.expectEvents([], 'selectionChange');
    await box.typeText('ad');
    await box.expectOptions(['Ada', 'Grace', 'Linus']);
    await box.toggleOption('Grace');
    await box.expectBoundValue(['Ada', 'Grace']);
    if (forms === 'reactive') await box.expectFormState({ dirty: true, changes: 1 });
    await box.expectNoAccessibilityViolations();
  });
}

test('normalizes a form reset to an empty pristine value and disables via the control', async ({
  page,
}) => {
  // L2-031 AC1/3/4: Given reactive binding, when reset or disabled, then normalize null and reflect disabled state.
  const box = new ComboboxDemoPage(page);
  await box.open({ forms: 'reactive', value: 'Ada' });
  await box.expectChips(['Ada']);
  await box.resetForm();
  await box.expectChips([]);
  await box.expectFormState({ value: null, dirty: false, touched: false });
  await box.setDisabled(true);
  await box.expectDisabled(true);
  await box.setDisabled(false);
  await box.expectDisabled(false);
  await box.expectNoAccessibilityViolations();
});
