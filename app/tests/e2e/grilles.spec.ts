import { button, expect, test, texts } from './helpers';

const wheel = (page: import('@playwright/test').Page, name: string) =>
  page.locator('.wheel-chord', { has: page.locator('.wc-name', { hasText: new RegExp('^' + name + '$') }) });

test('the loop plays the section and lights the chord being played', async ({ page }) => {
  await page.goto('#/composer/grille/g-minuit');
  await expect(page.locator('.grid-kicker')).toHaveText('92 BPM · Shuffle ▾');
  await page.getByText('▶  Boucle · 92 BPM').click();
  await expect(page.locator('.slot.on .slot-name')).toHaveText('A');
  await expect(page.locator('.slot.on .slot-name')).toHaveText('D', { timeout: 6000 }); // next bar (2.6 s at 92 BPM)
  await page.locator('.seg button', { hasText: 'Refrain' }).click();
  await expect(page.locator('.grid-loop')).toHaveText('Arrêter · refrain');
  await page.locator('.grid-loop').click();
  await expect(page.locator('.slot.on')).toHaveCount(0);
});

test('edits chords, key, name, tempo and groove', async ({ page }) => {
  await page.goto('#/composer/grille/g-minuit');
  await page.locator('.seg button', { hasText: 'Pont' }).click();
  await wheel(page, 'C#m').click();
  expect((await texts(page, '.slot-name')).pop()).toBe('C#m');
  await page.getByLabel('Monter d’un demi-ton').click();
  await expect(page.locator('.hub-key')).toHaveText('Si♭');
  await page.locator('.grid-head').click();
  await page.locator('.text-input').fill('Minuit v2');
  await page.getByLabel('Accélérer').click();
  await page.locator('.set-sheet .seg button', { hasText: 'Rock' }).click();
  await expect(page.locator('.riff-title')).toHaveText('Riff shuffle en La');
  await page.getByLabel('Fermer').click();
  await expect(page.locator('.grid-kicker')).toHaveText('94 BPM · Rock ▾');
  await expect(page.locator('.grid-title')).toHaveText('MINUIT V2');
});

test('a riff becomes a grid, the grid joins a setlist and shows on stage, deleting it cleans up', async ({ page }) => {
  await page.goto('#/composer');
  await page.locator('.idea', { hasText: 'Funk en Mi m' }).locator('.idea-top').click();
  await page.getByText('Ajouter à une grille ›').click();
  await page.getByText('Nouvelle grille avec ce riff').click();
  await expect(page.locator('.grid-kicker')).toHaveText('104 BPM · Funk ▾');
  await expect(page.locator('.hub-key')).toHaveText('Sol');
  await expect(page.locator('.slot-name')).toHaveText(['Em']);
  for (const n of ['Am', 'Bm', 'C']) await wheel(page, n).click();
  await expect(page.locator('.slot-name')).toHaveText(['Em', 'Am', 'Bm', 'C']);

  await page.getByText('Setlist +').click();
  await page.locator('.set-sheet .pick-row', { hasText: 'Bar du Port' }).click();
  await expect(page).toHaveURL(/#\/scene\/bar-du-port$/);
  await expect(page.locator('.song-row').last()).toContainText('Funk en Mi m, 16e');
  await page.locator('.song-row').last().click();
  await expect(page.locator('.stage-title')).toHaveText('FUNK EN MI M, 16E');
  await expect(page.locator('.lyric-line.chords-only')).toHaveCount(1);

  await page.goto('#/composer/grilles');
  await page.locator('.idea', { hasText: 'Funk en Mi m' }).first().locator('.idea-top').click();
  await page.getByText('Ouvrir la grille ›').click();
  await page.locator('.grid-head').click();
  await page.getByText('Supprimer la grille…').click();
  await page.locator('.btn-danger').click();
  await expect(page).toHaveURL(/#\/composer\/grilles$/);
  await page.goto('#/scene/bar-du-port');
  await expect(page.locator('.song-row')).toHaveCount(9);
});

test('a catalog song without lyrics shows its grid on stage, flats kept', async ({ page }) => {
  await page.goto('#/scene/bar-du-port/play/1');
  await expect(page.locator('.stage-title')).toHaveText('CAFÉ NOIR');
  await expect(page.locator('.lyric-line').nth(1)).toContainText('Bb');
});

test('the Grilles tile filters the notebook for this visit only', async ({ page }) => {
  await page.goto('#/');
  await page.locator('[data-tile="grilles"]').click();
  await expect(page.locator('.kind-chip.on-cream')).toHaveText('Grilles');
  await page.getByRole('link', { name: 'Accueil' }).click();
  await page.getByRole('link', { name: 'Composer' }).click();
  await expect(page.locator('.kind-chip.on-cream')).toHaveText('Tout');
});

test('touching a chord of the grid shows its diagram, other positions, and the library', async ({ page }) => {
  await page.goto('#/composer/grille/g-minuit');
  await page.getByLabel('Accord D : diagramme').click();
  const sheet = page.getByRole('dialog', { name: 'Accord D' });
  await expect(sheet.locator('.sheet-kicker')).toHaveText('Couplet · accord 2/4');
  await expect(sheet.locator('.cs-sub')).toHaveText('Ré majeur · degré IV en La');
  await expect(sheet.locator('.cs-pos')).toHaveText('Forme de Ré · position ouverte · 1/5');
  await expect(sheet.locator('.cd-label')).toHaveText(['A', 'D', 'F♯']); // notes on the dots

  // Step through the section's chords.
  await sheet.getByLabel('Accord suivant').click();
  await expect(page.getByRole('dialog', { name: 'Accord A' }).locator('.sheet-kicker')).toHaveText('Couplet · accord 3/4');
  await page.getByLabel('Accord précédent').click();

  // Another position, remembered for this chord everywhere.
  await sheet.getByLabel('Position suivante').click();
  await expect(sheet.locator('.cs-pos')).toHaveText(/^Forme de .* · case \d+ · 2\/5$/);
  const pos2 = await sheet.locator('.cs-pos').textContent();
  await sheet.getByLabel('Fermer').click();
  await page.reload();
  await page.getByLabel('Accord D : diagramme').click();
  await expect(sheet.locator('.cs-pos')).toHaveText(pos2!);

  // The library opens on the same chord and position.
  await button(page, 'Bibliothèque ›').click();
  await expect(page).toHaveURL(/#\/pratiquer\/accords$/);
  await expect(page.locator('.shape-label')).toHaveText(/· 2\/5$/);
  await expect(page.locator('.chord-sym')).toHaveText('D');
});

test('a minor chord outside the key, and removing a chord from the sheet', async ({ page }) => {
  await page.goto('#/composer/grille/g-minuit');
  await page.locator('.seg button', { hasText: 'Pont' }).click();
  await wheel(page, 'C#m').click();
  await page.getByLabel('Accord C#m : diagramme').click();
  await expect(page.locator('.cs-sub')).toHaveText('Do♯ mineur · degré iii en La');
  await page.getByLabel('Accord précédent').click();
  await button(page, /^Retirer .* de la grille$/).click();
  // The sheet moves to the chord that took its place.
  await expect(page.locator('.chord-sheet .cs-name')).toHaveText('C#m');
  expect(await texts(page, '.slot-name')).toHaveLength(4);
  await button(page, 'Retirer C#m de la grille').click();
  await expect(page.locator('.slot-name')).toHaveCount(3);
});
