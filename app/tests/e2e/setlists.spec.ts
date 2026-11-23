import { button, expect, test, texts } from './helpers';

test('lists sets by date with the next gig highlighted', async ({ page }) => {
  await page.goto('#/scene');
  await expect(page.locator('.set-name')).toHaveText(['Répét’ jeudi', 'Bar du Port', 'Fête de la musique']);
  await expect(page.locator('.set-card.next .set-name')).toHaveText('Répét’ jeudi');
  await expect(page.locator('[data-tile]')).toHaveCount(0);
});

test('reorders, removes and adds titles', async ({ page }) => {
  await page.goto('#/scene/bar-du-port');
  await expect(page.locator('.song-row')).toHaveCount(9);
  await button(page, 'Modifier').click();
  await page.getByLabel('Monter Café noir').click();
  await page.getByLabel('Retirer Dernier verre').click();
  await page.getByText('+ Ajouter un titre').click();
  await page.locator('.pick-row', { hasText: 'Ligne blanche' }).click();
  await button(page, 'Terminé').click();
  const titles = await texts(page, '.song-title');
  expect(titles[0]).toBe('Café noir');
  expect(titles).not.toContain('Dernier verre');
  expect(titles.at(-1)).toBe('Ligne blanche');
});

test('plays the set: the pedal turns pages, then moves to the next song', async ({ page }) => {
  await page.goto('#/scene/bar-du-port');
  await page.locator('.song-row', { hasText: 'Minuit Shuffle' }).click();
  await expect(page.locator('.stage-pos')).toHaveText('Bar du Port · 3/9');
  await expect(page.locator('.stage-back')).toHaveText('✕ Quitter');
  await expect(page.locator('.stage-title')).toHaveText('MINUIT SHUFFLE');
  // As many pages as the lyrics take (the layout decides), then the next song.
  for (let i = 0; i < 12 && (await page.locator('.stage-title').textContent()) === 'MINUIT SHUFFLE'; i++) {
    await page.keyboard.press('PageDown');
    await page.waitForTimeout(600);
  }
  await expect(page.locator('.stage-title')).toHaveText('ROUILLE ET CHROME');
  await page.keyboard.press('PageUp');
  await expect(page.locator('.stage-title')).toHaveText(/MINUIT SHUFFLE/);
});

test('transposes on stage and scrolls on its own', async ({ page }) => {
  await page.goto('#/scene/bar-du-port/play/2');
  await page.getByLabel('Transposer vers le haut').click();
  await page.getByLabel('Transposer vers le haut').click();
  await expect(page.locator('.stage-tag.key')).toHaveText(/Si/);
  await expect(page.locator('.lyric-chord').first()).toHaveText(/^B7/);
  await button(page, 'LECTURE').click();
  await expect.poll(() => page.locator('.lyrics').evaluate(e => e.scrollTop)).toBeGreaterThan(5);
  await button(page, 'PAUSE').click();
});

test('a new setlist opens ready to fill', async ({ page }) => {
  await page.goto('#/scene');
  await page.getByText('+ Nouvelle setlist').click();
  await expect(page.locator('.set-title-input')).toHaveValue('Nouvelle setlist');
  await page.locator('.set-title-input').fill('Mon concert');
  await button(page, 'Terminé').click();
  await page.goto('#/scene');
  await expect(page.locator('.set-name', { hasText: 'Mon concert' })).toHaveCount(1);
});

test('a setlist needs no date; a date can be added, changed and removed', async ({ page }) => {
  await page.goto('#/scene');
  await page.getByText('+ Nouvelle setlist').click();
  await page.locator('.set-title-input').fill('Répét’ libre');
  // No date by default.
  await expect(page.locator('.set-info')).not.toContainText('·  ·');
  await expect(page.locator('.set-info span').first()).toHaveText('0 titre');
  await button(page, '+ Ajouter une date').click();
  const field = page.getByLabel('Date du concert');
  await field.fill('2027-06-21T20:30');
  await button(page, 'Terminé').click();
  await expect(page.locator('.set-info span').first()).toHaveText('Lun. 21 juin · 20:30');

  // In the list: dated sets by date, undated ones after.
  await page.goto('#/scene');
  const names = page.locator('.set-name');
  await expect(names.last()).toHaveText('Répét’ libre');
  await expect(page.locator('.set-card', { hasText: 'Répét’ libre' }).locator('.set-date')).toHaveText('Lun. 21 juin · 20:30');

  await page.locator('.set-card', { hasText: 'Répét’ libre' }).click();
  await button(page, 'Modifier').click();
  await button(page, 'Retirer la date').click();
  await button(page, 'Terminé').click();
  await expect(page.locator('.set-info span').first()).toHaveText('0 titre');
  await page.goto('#/scene');
  await expect(page.locator('.set-card', { hasText: 'Répét’ libre' }).locator('.set-date')).toHaveText('');
  await expect(names.last()).toHaveText('Répét’ libre');
});

test('a setlist can be deleted (after a confirmation); its songs stay in the library', async ({ page }) => {
  await page.goto('#/scene/repet-jeudi');
  await button(page, 'Modifier').click();
  await button(page, 'Supprimer la setlist…').click();
  await expect(page.locator('.set-delete')).toContainText('Supprimer « Répét’ jeudi » ? Les morceaux restent dans la bibliothèque.');
  await button(page, 'Annuler').click();
  await button(page, 'Supprimer la setlist…').click();
  await button(page, 'Supprimer').click();
  await expect(page).toHaveURL(/#\/scene$/);
  await expect(page.locator('.set-name', { hasText: 'Répét’ jeudi' })).toHaveCount(0);
  await expect(page.locator('.sets-count')).toHaveText('2 sets');
  await page.reload();
  await expect(page.locator('.set-name', { hasText: 'Répét’ jeudi' })).toHaveCount(0);
  await page.goto('#/scene/morceaux');
  await expect(page.locator('.lib-row .song-title', { hasText: 'Minuit Shuffle' })).toHaveCount(1);
});
