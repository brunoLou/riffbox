import { button, expect, test, texts } from './helpers';

const order = (page: import('@playwright/test').Page) => texts(page, '.pedal-name');

test('home tiles open their tools and show live summaries', async ({ page }) => {
  await page.goto('#/');
  await expect(page.locator('[data-tile="metro"] .pedal-sub')).toHaveText('92 BPM · 4/4');
  await expect(page.locator('[data-tile="grilles"] .pedal-sub')).toHaveText('3 grilles');
  await page.locator('[data-tile="tuner"]').click();
  await expect(page).toHaveURL(/#\/accordeur$/);
  await page.getByLabel('Retour').click();
  await expect(page).toHaveURL(/#\/$/);
});

test('tiles can be dragged by their grip, moved with the keyboard, resized and removed', async ({ page }) => {
  await page.goto('#/');
  const initial = await order(page);
  expect(initial.slice(0, 2)).toEqual(['Accordeur', 'Métronome']);
  await button(page, 'Modifier').click();
  await expect(page.locator('.edit-hint')).toBeVisible();
  await expect(page.locator('.fab')).toHaveCount(0);

  // Drag Métronome onto Accordeur.
  const grip = await page.locator('[data-grip="metro"]').boundingBox();
  const target = await page.locator('[data-tile="tuner"]').boundingBox();
  await page.mouse.move(grip!.x + grip!.width / 2, grip!.y + grip!.height / 2);
  await page.mouse.down();
  await page.mouse.move(target!.x + target!.width / 2, target!.y + target!.height / 2, { steps: 8 });
  await expect(page.locator('.pedal.lifted .pedal-name')).toHaveText('Métronome');
  await page.mouse.up();
  expect((await order(page)).slice(0, 2)).toEqual(['Métronome', 'Accordeur']);

  // Keyboard: two steps back, focus stays on the grip.
  const before = await order(page);
  await page.locator('[data-grip="capo"]').focus();
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowLeft');
  const after = await order(page);
  expect(after.indexOf('Capo')).toBe(before.indexOf('Capo') - 2);
  await expect(page.locator('[data-grip="capo"]')).toBeFocused();

  await page.getByLabel('Agrandir Accordeur').click();
  await expect(page.locator('[data-tile="tuner"]')).toHaveCSS('grid-column-start', 'span 2');
  await page.getByLabel('Retirer Voix').click();
  expect(await order(page)).not.toContain('Voix');
});

test('the catalog adds tiles, the layout persists and can be reset', async ({ page }) => {
  await page.goto('#/');
  await button(page, 'Modifier').click();
  await page.getByText('+ Ajouter une pédale').click();
  // The catalog shows the pedals themselves.
  await expect(page.locator('.catalog-list .pedal-name')).toHaveText(['Accords', 'Morceaux', 'Tonalité', 'Quel ton ?', 'Looper', 'Relever', 'Oreille', 'Rythme', 'Sans guitare', 'Coach', 'Réglages']);
  await expect(page.locator('.catalog-list .pedal-motif')).toHaveCount(11);
  await page.getByRole('button', { name: 'Ajouter Accords' }).click();
  await expect(page.locator('.catalog-list .pedal-name')).toHaveText(['Morceaux', 'Tonalité', 'Quel ton ?', 'Looper', 'Relever', 'Oreille', 'Rythme', 'Sans guitare', 'Coach', 'Réglages']);
  await page.getByLabel('Fermer').click();
  await button(page, 'Terminé').click();
  await expect(page.locator('.pedal-name').last()).toHaveText('Accords');

  await page.reload();
  await expect(page.locator('.pedal-name').last()).toHaveText('Accords');
  await page.locator('[data-tile="accords"]').click();
  await expect(page).toHaveURL(/#\/pratiquer\/accords$/);

  await page.goto('#/');
  await button(page, 'Modifier').click();
  await page.getByText('+ Ajouter une pédale').click();
  await page.getByText('Rétablir l’accueil d’origine…').click();
  await button(page, 'Rétablir').click();
  expect(await order(page)).toEqual(['Accordeur', 'Métronome', 'Carnet', 'Grilles', 'Backing tracks', 'Manche', 'Routine', 'Voix', 'Capo', 'Setlists']);
});

test('compartments: named by the player, pedals sorted into them, kept after a reload', async ({ page }) => {
  await page.goto('#/');
  await button(page, 'Modifier').click();
  await button(page, '+ Nouveau compartiment').click();
  await page.getByLabel('Nom du nouveau compartiment').fill('Outils');
  await button(page, 'Créer').click();
  await expect(page.getByLabel('Nom du compartiment')).toHaveValue('Outils');

  // Sort with the « Ranger » button.
  await page.getByLabel('Ranger Accordeur dans un compartiment').click();
  await page.getByRole('dialog', { name: 'Ranger Accordeur' }).getByRole('button', { name: 'Outils' }).click();
  await page.getByLabel('Ranger Capo dans un compartiment').click();
  await page.getByRole('dialog').getByRole('button', { name: 'Outils' }).click();
  const outils = page.getByRole('region', { name: 'Compartiment Outils' });
  await expect(outils.locator('.pedal-name')).toHaveText(['Accordeur', 'Capo']);

  // A second one, created while sorting a pedal (from a suggestion).
  await page.getByLabel('Ranger Routine dans un compartiment').click();
  await page.getByRole('dialog').getByRole('button', { name: '+ Nouveau compartiment' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Entraînement', exact: true }).click();
  const train = page.getByRole('region', { name: 'Compartiment Entraînement' });
  await expect(train.locator('.pedal-name')).toHaveText(['Routine']);

  // Drag Métronome down into Entraînement: the board scrolls by itself near the bottom edge.
  await page.locator('[data-tile="metro"]').scrollIntoViewIfNeeded();
  const grip = await page.locator('[data-grip="metro"]').boundingBox();
  const vp = page.viewportSize()!;
  await page.mouse.move(grip!.x + grip!.width / 2, grip!.y + grip!.height / 2);
  await page.mouse.down();
  await page.mouse.move(vp.width / 2, vp.height - 100, { steps: 8 });
  await expect.poll(async () => { const b = await train.locator('[data-tile="routine"]').boundingBox(); return b ? b.y + b.height < vp.height - 100 : false; }, { timeout: 15000 }).toBe(true);
  const target = await train.locator('[data-tile="routine"]').boundingBox();
  await page.mouse.move(target!.x + target!.width / 2, target!.y + target!.height / 2, { steps: 6 });
  await page.mouse.up();
  await expect.poll(() => texts(page, '[aria-label="Compartiment Entraînement"] .pedal-name')).toContain('Métronome');

  // Rename, then finish.
  await page.getByLabel('Nom du compartiment').first().fill('Mes outils');
  await button(page, 'Terminé').click();
  await page.reload();
  const mine = page.getByRole('region', { name: 'Compartiment Mes outils' });
  await expect(mine.locator('.pedal-name')).toHaveText(['Accordeur', 'Capo']);
  await expect(mine.locator('.group-count')).toHaveText('2 pédales');

  // Folding hides the pedals.
  await mine.locator('.group-toggle').click();
  await expect(mine.locator('.pedal')).toHaveCount(0);
  await mine.locator('.group-toggle').click();
  await expect(mine.locator('.pedal')).toHaveCount(2);

  // Deleting a compartment keeps its pedals.
  await button(page, 'Modifier').click();
  await page.getByLabel('Supprimer le compartiment Mes outils').click();
  await expect(page.getByRole('region', { name: 'Compartiment Mes outils' })).toHaveCount(0);
  await expect(page.locator('[data-tile="tuner"]')).toBeVisible();
  await expect(page.locator('[data-tile="capo"]')).toBeVisible();
});

test('Pratiquer shows its tools as the home pedals', async ({ page }) => {
  await page.goto('#/pratiquer');
  await expect(page.locator('.prat-pedals .pedal-name')).toHaveText(['Manche', 'Accords', 'Backing tracks', 'Looper', 'Relever', 'Oreille', 'Quel ton ?', 'Rythme', 'Voix']);
  await expect(page.locator('.prat-pedals .pedal-motif')).toHaveCount(9);
  await page.locator('.prat-pedals [data-tile="looper"]').click();
  await expect(page).toHaveURL(/#\/pratiquer\/looper$/);
});
