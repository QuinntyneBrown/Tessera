// Acceptance tests. Traces to L2-035, L2-036, L2-041, L2-042, L2-048.
import { test } from '@playwright/test';
import { ComboboxDemoPage } from './pages/combobox-demo-page';

test('renders custom option and chip content while retaining its own semantics', async ({
  page,
}) => {
  // L2-042 AC1/2/5: Given custom slots, contexts stay current and native removal remains available.
  const box = new ComboboxDemoPage(page);
  await box.open({ templates: true, results: 'normal', value: 'Ada' });
  await box.expectChips(['Chosen Ada']);
  await box.typeText('ad');
  await box.expectOptions([
    'Ada · selected=true · active=true',
    'Grace · selected=false · active=false',
    'Linus · selected=false · active=false',
  ]);
  await box.pressKey('ArrowDown');
  await box.pressKey('Enter');
  await box.expectOptions([
    'Ada · selected=true · active=false',
    'Grace · selected=true · active=true',
    'Linus · selected=false · active=false',
  ]);
  await box.expectChips(['Chosen Ada', 'Chosen Grace']);
  await box.removeChip('Grace');
  await box.expectChips(['Chosen Ada']);
  await box.expectNoAccessibilityViolations();
});

test('customizes the empty row with the current query while preserving its announcement', async ({
  page,
}) => {
  // L2-042 AC3: Given an empty slot, the row receives query and standard speech remains.
  const box = new ComboboxDemoPage(page);
  await box.open({ templates: true });
  await box.typeText('nobody');
  await box.expectMessage('No learners match nobody');
  await box.expectAnnouncement('No results found.');
  await box.expectNoAccessibilityViolations();
});

test('uses partial injected translations for labels, actions and announcements', async ({
  page,
}) => {
  // L2-041 AC2/3/4: Given partial overrides, when rendered, then translate owned strings and retain defaults.
  const box = new ComboboxDemoPage(page);
  await box.open({ localized: true, value: 'Ada' });
  await box.expectChips(['Ada'], 'Elegidos');
  await box.expectNamedButton('Quitar Ada');
  await box.expectNamedButton('Borrar selección');
  await box.expectNamedButton('Mostrar opciones');
  await box.typeText('ad');
  await box.expectMessage('Sin resultados');
  await box.expectAnnouncement('Ninguna coincidencia.');
  await box.expectNamedButton('Ocultar opciones');
  await box.expectNoAccessibilityViolations();
});
