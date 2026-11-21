import { readFileSync } from 'node:fs';
import { button, expect, test } from './helpers';

test('the library shows what each song has, and searches', async ({ page }) => {
  await page.goto('#/scene');
  await page.locator('.scene-tabs a', { hasText: 'Morceaux' }).click();
  await expect(page).toHaveURL(/#\/scene\/morceaux$/);
  const status = (t: string) => page.locator('.lib-row', { hasText: t }).locator('.lib-status');
  await expect(status('Minuit Shuffle')).toHaveText('Paroles');
  await expect(status('Café noir')).toHaveText('Accords');
  await expect(status('Bayou sec')).toHaveText('À écrire');
  await page.locator('.search').fill('caf');
  await expect(page.locator('.lib-row .song-title')).toHaveText(['Café noir']);
});

test('lyrics are typed with chords inserted from the bar, previewed and shown on stage', async ({ page }) => {
  await page.goto('#/scene/morceau/s6');
  await expect(page.locator('.ins:not(.sec)')).toHaveText(['C', 'Dm', 'Em', 'F', 'G', 'Am', 'G7']);
  await page.locator('.chordpro').click();
  await page.locator('.ins.sec', { hasText: 'Couplet' }).click();
  await page.locator('.ins', { hasText: /^C$/ }).click(); await page.keyboard.type('Le fleuve dort sous ');
  await page.locator('.ins', { hasText: /^F$/ }).click(); await page.keyboard.type('la chaleur');
  await expect(page.locator('.chordpro')).toHaveValue('{c:Couplet}\n[C]Le fleuve dort sous [F]la chaleur');
  await page.locator('.mini-seg button', { hasText: 'Aperçu' }).click();
  await expect(page.locator('.preview .lyric-line')).toHaveText(/C\s*Le fleuve dort sous F\s*la chaleur/);
  await button(page, 'OK').click();
  await page.goto('#/scene/bar-du-port/play/5');
  await expect(page.locator('.lyric-text').first()).toHaveText('Le fleuve dort sous ');
  await page.locator('.stage-edit').click();
  await expect(page).toHaveURL(/#\/scene\/morceau\/s6$/);
});

test('a new song from the library: title focused, minor key chords', async ({ page }) => {
  await page.goto('#/scene/morceaux');
  await page.getByText('+ Nouveau morceau').click();
  await expect(page.locator('.text-input').first()).toBeFocused();
  await page.keyboard.type('Ma chanson');
  await page.locator('select').nth(0).selectOption('4');
  await page.locator('select').nth(1).selectOption('m');
  await expect(page.locator('.ins:not(.sec)')).toHaveText(['Em', 'G', 'Am', 'Bm', 'C', 'D', 'B7']);
  await button(page, 'OK').click();
  await expect(page.locator('.lib-row', { hasText: 'Ma chanson' }).locator('.song-meta')).toHaveText(/^Mi m · 90 BPM/);
});

test('a song created from a setlist joins it', async ({ page }) => {
  await page.goto('#/scene/repet-jeudi');
  await button(page, 'Modifier').click();
  await page.getByText('+ Ajouter un titre').click();
  await page.getByText('Créer un morceau').click();
  await page.keyboard.type('Inédit du jeudi');
  await button(page, 'Ajouter').click();
  await expect(page).toHaveURL(/#\/scene\/repet-jeudi$/);
  await expect(page.locator('.song-title').last()).toHaveText('Inédit du jeudi');
});

test('a grid song gets its own record once, chords inserted once, deletion unlinks', async ({ page }) => {
  await page.goto('#/composer');
  await page.getByText('+ Grille').click();
  for (const n of ['A', 'D', 'E']) await page.locator('.wheel-chord', { has: page.locator('.wc-name', { hasText: new RegExp('^' + n + '$') }) }).click();
  await page.getByText('Setlist +').click();
  await page.locator('.set-sheet .pick-row', { hasText: 'Répét' }).click();
  await button(page, 'Modifier').click();
  await page.locator('.song-row', { hasText: 'Nouvelle grille' }).locator('.song-text').click();
  await expect(page).toHaveURL(/#\/scene\/morceau\/song-grid\d+$/);
  await expect(page.locator('.grid-link')).toContainText('Grille reliée : Nouvelle grille');
  await button(page, 'Insérer ses accords').click();
  await expect(page.locator('.chordpro')).toHaveValue('{c:Couplet}\n[A][D][E]');
  await page.getByText('Supprimer le morceau…').click();
  await page.locator('.btn-danger').click();
  await page.goto('#/scene/repet-jeudi');
  await expect(page.locator('.song-row', { hasText: 'Nouvelle grille' })).toHaveCount(0);
});

test('ChordPro: export one song, then the whole library', async ({ page }) => {
  await page.goto('#/scene/morceau/s3');
  const [one] = await Promise.all([page.waitForEvent('download'), button(page, 'Exporter en ChordPro').click()]);
  expect(one.suggestedFilename()).toBe('minuit-shuffle.cho');
  const text = readFileSync((await one.path())!, 'utf8');
  expect(text).toMatch(/^\{title: Minuit Shuffle\}\n\{key: A\}\n\{tempo: 92\}\n/);
  expect(text).toContain('[A7]');

  await page.goto('#/scene/morceaux');
  const count = Number((await page.locator('.sets-count').textContent())!.match(/\d+/)![0]);
  const [all] = await Promise.all([page.waitForEvent('download'), button(page, 'Tout exporter').click()]);
  expect(all.suggestedFilename()).toMatch(/^riffbox-morceaux-\d{4}-\d{2}-\d{2}\.cho$/);
  const book = readFileSync((await all.path())!, 'utf8');
  expect(book.match(/^\{title: /gm)).toHaveLength(count);
  expect(book.match(/^\{new_song\}$/gm)).toHaveLength(count - 1);
  await expect(page.locator('.cp-msg')).toHaveText(`${count} morceaux exportés en ChordPro, dans un seul fichier.`);
});

test('ChordPro: import files from another app, skipping a title already there', async ({ page }) => {
  await page.goto('#/scene/morceaux');
  const before = await page.locator('.lib-row').count();
  await page.locator('input[type=file]').setInputFiles([
    { name: 'le-quai.chopro', mimeType: 'text/plain', buffer: Buffer.from(
      '{title: Le Quai}\n{artist: Les Néons}\n{key: Em}\n{tempo: 84}\n{capo: 2}\n\n{start_of_verse}\n[Em]Les néons tremblent [C]au bord du quai\n{end_of_verse}\n{soc}\n[G]La nuit s’é[D]tire\n{eoc}\n') },
    { name: 'recueil.cho', mimeType: 'text/plain', buffer: Buffer.from(
      '{t: Café noir}\n[Dm]Déjà là\n{new_song}\n{t: Route 12}\n{key: G}\n[G]On roule [C]encore') },
  ]);
  const sheet = page.getByRole('dialog', { name: 'Importer des morceaux' });
  await expect(sheet.locator('.sheet-kicker')).toHaveText('3 morceaux trouvés');
  await expect(sheet.locator('.cp-pick .song-title')).toHaveText(['Le Quai', 'Café noir', 'Route 12']);
  await expect(sheet.locator('.cp-pick').nth(0).locator('.song-meta')).toHaveText('Les Néons · Mi m · 84 BPM · shuffle · paroles et accords');
  // The title already in the library is not ticked.
  await expect(sheet.locator('.cp-pick').nth(1)).toHaveAttribute('aria-pressed', 'false');
  await expect(sheet.locator('.cp-dup')).toHaveText(['Un titre du même nom existe déjà']);
  await button(page, 'Importer 2 morceaux').click();
  await expect(page.locator('.cp-msg')).toHaveText('2 morceaux importés.');
  await expect(page.locator('.lib-row')).toHaveCount(before + 2);
  await expect(page.locator('.lib-row', { hasText: 'Le Quai' }).locator('.song-meta')).toHaveText(/^Les Néons · Mi m · 84 BPM/);

  // The sections became labels, and the song plays on stage with its capo.
  await page.locator('.lib-row', { hasText: 'Le Quai' }).click();
  await expect(page.locator('textarea')).toHaveValue('{c:Couplet}\n[Em]Les néons tremblent [C]au bord du quai\n\n{c:Refrain}\n[G]La nuit s’é[D]tire');
  await page.reload();
  await expect(page.locator('textarea')).toHaveValue(/^\{c:Couplet\}/);
});

test('ChordPro: a file that is not ChordPro is refused', async ({ page }) => {
  await page.goto('#/scene/morceaux');
  await page.locator('input[type=file]').setInputFiles({ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('juste une liste de courses') });
  await expect(page.locator('.cp-msg.error')).toHaveText('Aucun morceau ChordPro trouvé dans ce fichier.');
  await expect(page.getByRole('dialog')).toHaveCount(0);
});
