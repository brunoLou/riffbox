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
  await expect(page.locator('.catalog-list .song-title')).toHaveText(['Accords', 'Morceaux', 'Tonalité', 'Quel ton ?', 'Looper', 'Coach', 'Réglages']);
  await page.locator('.catalog-list .pick-row', { has: page.locator('.song-title', { hasText: /^Accords$/ }) }).click();
  await expect(page.locator('.catalog-list .song-title')).toHaveText(['Morceaux', 'Tonalité', 'Quel ton ?', 'Looper', 'Coach', 'Réglages']);
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
