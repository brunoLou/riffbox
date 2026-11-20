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
