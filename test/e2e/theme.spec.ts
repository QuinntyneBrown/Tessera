// Acceptance tests. Traces to L2-051, L2-052, L2-053, L2-054, L2-055.
import { test } from '@playwright/test';
import { ThemePage } from './pages/theme-page';

test('applies, replaces, nests and clears themes without changing unrelated styles or inputs', async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: 'light' });
  const theme = new ThemePage(page);
  await theme.open();
  await theme.choose('dark');
  await theme.expectSample('rgb(244, 247, 245)');
  await theme.nestLight();
  await theme.expectSample('rgb(24, 49, 46)', true);
  await theme.choose('custom');
  await theme.expectSample('rgb(76, 29, 149)');
  await theme.expectSample('rgb(24, 49, 46)', true);
  await theme.choose('light');
  await theme.expectSample('rgb(24, 49, 46)');
  await theme.choose('system');
  await theme.expectSample('rgb(24, 49, 46)');
  await theme.expectUnrelatedStyle();
  await theme.expectApiChecks();
});

for (const detached of [false, true]) {
  test(`combobox inherits themes and existing overrides with ${detached ? 'detached' : 'inline'} overlays`, async ({
    page,
  }) => {
    // L2-052, L2-053: Given an open list, theme changes preserve its presentation and selection.
    const theme = new ThemePage(page);
    if (detached) await theme.useDetachedOverlays();
    await theme.open();
    await theme.choose('dark');
    await theme.search();
    await theme.expectCombobox('rgb(244, 247, 245)');
    await theme.selectAda();
    await theme.choose('light');
    await theme.expectCombobox('rgb(24, 49, 46)');
    await theme.expectSelectionPreserved();
    await theme.overrideCombobox();
    await theme.expectCombobox('rgb(76, 29, 149)');
    await theme.choose('dark');
    await theme.expectCombobox('rgb(76, 29, 149)');
    await theme.expectFocusTheme('rgb(255, 191, 105)');
  });
}

// L2-054: Theme changes affect the player shell, preserving keyboard navigation and isolated content.
test('themes the player shell without changing the course or navigation', async ({ page }) => {
  const theme = new ThemePage(page);
  await theme.open();
  await theme.choose('dark');
  await theme.expectPlayer('rgb(244, 247, 245)', 'rgb(24, 49, 46)');
  await theme.expectPlayerFocus('rgb(255, 191, 105)');
  await theme.expectContrast();
  await theme.expectAccessible();
  await theme.nextByKeyboard();
  await theme.expectCoursePresentationUnchanged();
  await theme.choose('light');
  await theme.expectPlayer('rgb(24, 49, 46)', 'rgb(255, 255, 255)');
  await theme.expectContrast();
  await theme.expectAccessible();
});

test('themes the player error state', async ({ page }) => {
  const theme = new ThemePage(page);
  await theme.open('malformed-xml');
  await theme.expectPlayerError();
  await theme.choose('dark');
  await theme.expectPlayer('rgb(244, 247, 245)', 'rgb(24, 49, 46)');
  await theme.expectErrorColor();
  await theme.expectAccessible();
});

test('themes the loading state', async ({ page }) => {
  const theme = new ThemePage(page);
  const release = await theme.holdManifest();
  try {
    await theme.open('single-sco-12');
    await theme.expectLoading();
    await theme.choose('dark');
    await theme.expectPlayer('rgb(244, 247, 245)', 'rgb(24, 49, 46)');
    await theme.expectAccessible();
  } finally {
    release();
  }
});

for (const width of [320, 576, 768, 992, 1200, 1920]) {
  test(`both themed components reflow at ${width} CSS px`, async ({ page }) => {
    // L2-055: Given a narrow or wide viewport, themed controls remain operable.
    const theme = new ThemePage(page);
    await theme.useViewport(width);
    await theme.open();
    await theme.choose('dark');
    await theme.search();
    await theme.selectAda();
    await theme.nextByKeyboard();
    await theme.expectReflow();
    await theme.expectAccessible();
  });
}

for (const adaptation of ['text', 'spacing']) {
  test(`themed components remain usable with ${adaptation} overrides`, async ({ page }) => {
    const theme = new ThemePage(page);
    await theme.useViewport(320);
    await theme.open();
    await theme.choose('dark');
    if (adaptation === 'text') await theme.enlargeText();
    else await theme.applyTextSpacing();
    await theme.nextByKeyboard();
    await theme.expectReflow();
    await theme.expectAccessible();
  });
}

test('forced colors override an explicitly applied dark theme', async ({ page }) => {
  const theme = new ThemePage(page);
  await theme.open();
  await theme.choose('dark');
  await page.emulateMedia({ forcedColors: 'active', reducedMotion: 'reduce' });
  await theme.expectForcedColors();
  await theme.nextByKeyboard();
  await theme.expectAccessible();
});
