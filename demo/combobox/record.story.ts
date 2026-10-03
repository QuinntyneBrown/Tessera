import { test } from '@playwright/test';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { Narrator } from '../narration';
import { ComboboxExamplesDemoPage } from './page';

test('narrated continuous combobox walkthrough', async ({ page }) => {
  const run = process.env['COMBOBOX_DEMO_RUN']!;
  const segments = JSON.parse(readFileSync(join(__dirname, 'storyboard.json'), 'utf8'));
  const lengths = JSON.parse(readFileSync(join(run, 'audio', 'durations.json'), 'utf8'));
  const narrator = new Narrator(page);
  const app = new ComboboxExamplesDemoPage(page);
  const speech: { id: string; at: number; duration: number; text: string }[] = [];
  const say = async (id: string) => {
    const segment = segments.find((item: { id: string }) => item.id === id);
    narrator.mark(id);
    speech.push({ id, at: narrator.markers[id], duration: lengths[id], text: segment.speech });
    await narrator.caption(
      segment.caption,
      lengths[id] * 1000 + 650,
      ['paging', 'append', 'arrows'].includes(id) ? 'top' : 'bottom',
    );
    await narrator.clearCaption();
  };
  // The same page is recorded from opening through closing. No application state is injected.
  const opening = narrator.card(
    'Tessera combobox',
    'A narrated walkthrough of the real Angular component',
    lengths.opening * 1000 + 1000,
  );
  await say('opening');
  await opening;
  await app.open();
  await narrator.chapter('1. Search and select', 'Keep your selection while the results change');
  await app.show('Reactive');
  await app.search('Reactive', 'a');
  const matches = [
    'Ada',
    'Grace',
    'Morgan',
    'Sam',
    'Tamara',
    'Arun',
    'Bea',
    'Laila',
    'Kai',
    'Alex',
    'Maya',
  ];
  await app.results(matches);
  await app.focused('Reactive');
  await say('search');
  await app.select('Ada');
  await app.select('Grace');
  await app.chips('Reactive', ['Ada', 'Grace']);
  await app.value('Reactive', 'Ada, Grace');
  await app.focused('Reactive');
  await say('select');
  narrator.mark('poster');
  await app.search('Reactive', 'li');
  await app.results(['Linus']);
  await app.select('Linus');
  await app.chips('Reactive', ['Ada', 'Grace', 'Linus']);
  await app.value('Reactive', 'Ada, Grace, Linus');
  await say('retain');
  // A native top-layer popover sits above the narration card's ordinary z-index.
  // Dismiss it through the actual keyboard interaction before the chapter transition.
  await app.close('Reactive');

  await narrator.chapter(
    '2. Keyboard and removal',
    'Navigate results, move to chips, and clear selections',
  );
  await app.search('Reactive', '');
  await app.key('ArrowLeft');
  await app.focusChip('Reactive', 'Linus');
  await app.key('Delete');
  await app.focusChip('Reactive', 'Grace');
  await app.key('ArrowRight');
  await app.focused('Reactive');
  await app.chips('Reactive', ['Ada', 'Grace']);
  await app.value('Reactive', 'Ada, Grace');
  await say('chips');
  await app.search('Reactive', 'a');
  await app.results(matches);
  await app.key('ArrowDown');
  await app.active('Reactive', 'Grace');
  await app.key('Space');
  await app.selected('Grace', false);
  await app.key('Enter');
  await app.selected('Grace', true);
  await app.focused('Reactive');
  await say('keys');
  await app.close('Reactive');
  await app.chips('Reactive', ['Ada', 'Grace']);
  await app.clear('Reactive');
  await app.chips('Reactive', []);
  await app.value('Reactive', '');
  await app.focused('Reactive');
  await say('clear');

  await narrator.chapter(
    '3. Angular binding patterns',
    'Reactive forms, template forms, and a two-way model',
  );
  await app.show('Template');
  await app.search('Template', 'sam');
  await app.results(['Sam']);
  await app.select('Sam');
  await app.value('Template', 'Sam');
  await app.close('Template');
  await say('forms');
  await app.show('Model');
  await app.search('Model', 'mor');
  await app.results(['Morgan']);
  await app.select('Morgan');
  await app.value('Model', 'Morgan');
  await app.close('Model');
  await say('model');

  await narrator.chapter(
    '4. Custom content',
    'Replace content while the component owns interaction',
  );
  await app.show('Custom');
  await app.search('Custom', 'gr');
  await app.results(['Grace (Learning)']);
  await app.select('Grace (Learning)');
  await app.chips('Custom', ['Ada', 'Grace']);
  await app.customChip('Grace');
  await say('custom');
  await app.search('Custom', 'zzzz');
  await app.empty('No learners match zzzz');
  await app.chips('Custom', ['Ada', 'Grace']);
  await say('empty');
  await app.close('Custom');

  await narrator.chapter('5. Paged results', 'Load another page by pointer or keyboard');
  await app.show('Paging');
  await app.search('Paging', 'a');
  await app.results(matches.slice(0, 3));
  await say('paging');
  await app.loadMore();
  await app.results(matches.slice(0, 6));
  await app.focused('Paging');
  await say('append');
  // At this viewport, bringing the last loaded row into view reaches the scroll end,
  // which legitimately requests the next page before a further ArrowDown.
  for (let i = 0; i < 5; i++) await app.key('ArrowDown');
  await app.results(matches.slice(0, 9));
  await app.active('Paging', 'Arun');
  await app.key('ArrowDown');
  await app.active('Paging', 'Bea');
  await app.key('Enter');
  await app.chips('Paging', ['Bea']);
  await app.focused('Paging');
  await say('arrows');
  await app.close('Paging');
  await app.healthy();
  const ending = narrator.card(
    'Search. Select. Stay in control.',
    'Manual accessibility release checks remain pending',
    lengths.ending * 1000 + 1000,
  );
  await say('ending');
  await ending;
  const video = page.video()!;
  await page.close();
  mkdirSync(join(run, 'staging'), { recursive: true });
  await video.saveAs(join(run, 'staging', 'combobox-raw.webm'));
  writeFileSync(
    join(run, 'timeline.json'),
    JSON.stringify({ chapters: narrator.chapters, markers: narrator.markers, speech }, null, 2),
  );
});
