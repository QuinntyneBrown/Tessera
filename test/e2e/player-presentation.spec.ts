import { test } from '@playwright/test';
import { PlayerPage } from './pages/player-page';

// Design system: one focus ring (3px, 2px offset), dashed edges for unavailable controls, and a
// current lesson marked by fill and stripe as well as text.
test('applies the design system focus, unavailable and current cues', async ({ page }) => {
  const player = new PlayerPage(page);
  await player.open({ course: 'multi-sco-12' });

  await player.expectFocusRingOnExit();
  await player.expectPreviousShownUnavailable();
  await player.expectCurrentActivityHighlighted();
});

// Design system: the Inter stack, and page titles with tight tracking.
test('applies the design system type', async ({ page }) => {
  const player = new PlayerPage(page);
  await player.open({ course: 'multi-sco-12' });

  await player.expectDesignSystemType();
});

// Design system: errors are notices with a 4px status stripe; only the title takes the danger colour.
test('shows a load failure as a design system notice', async ({ page }) => {
  const player = new PlayerPage(page);
  await player.open({ course: 'single-sco-12', failFirstManifestRequest: true });

  await player.expectErrorMessage(/course manifest/i);
  await player.expectErrorShownAsNotice();
});
