import { expect, test } from './helpers';

const lit = (scope: import('@playwright/test').Locator) =>
  scope.locator('g.lit, g.root').evaluateAll(gs => gs.map(g => Number(g.getAttribute('data-midi'))).sort((a, b) => a - b));
/** Names written on the lit keys, low to high. */
const names = (scope: import('@playwright/test').Locator) =>
  scope.locator('g.lit, g.root').evaluateAll(gs => gs
    .map(g => [Number(g.getAttribute('data-midi')), g.querySelector('.pk-txt')?.textContent] as const)
    .sort((a, b) => a[0] - b[0]).map(x => x[1]));

test('chord library: the same chord on the piano, as a pianist plays it or with the guitar’s notes', async ({ page }) => {
  await page.goto('#/pratiquer/accords');
  await page.getByRole('group', { name: 'Fondamentale' }).getByRole('button', { name: 'Mi', exact: true }).click();
  await page.getByRole('group', { name: 'Type d’accord' }).getByRole('button').first().click(); // major
  const card = page.locator('.piano-chord').first();
  await expect(card.getByRole('img', { name: /au piano : position de pianiste/ })).toBeVisible();
  expect(await lit(card)).toEqual([52, 64, 68, 71]); // E3 | E4 G#4 B4
  expect(await names(card)).toEqual(['E', 'E', 'G#', 'B']); // spelt as in E major

  await card.getByRole('button', { name: 'Notes de la guitare' }).click();
  await expect(card.getByRole('img', { name: /les notes de la position guitare/ })).toBeVisible();
  expect(await lit(card)).toEqual([40, 47, 52, 56, 59, 64]); // open E: E2 B2 E3 G#3 B3 E4
  // Another position: other notes on the keyboard.
  await page.getByRole('button', { name: 'Position suivante' }).click();
  expect(await lit(card)).not.toEqual([40, 47, 52, 56, 59, 64]);
  await card.getByRole('button', { name: 'Pianiste' }).click();
});

test('from the piano to the guitar: touched keys are named and open in the library', async ({ page }) => {
  await page.goto('#/pratiquer/accords');
  const finder = page.locator('.piano-finder');
  await finder.scrollIntoViewIfNeeded();
  for (const n of ['A3', 'C4', 'E4', 'G4']) await finder.getByRole('button', { name: n, exact: true }).click();
  const best = finder.getByRole('button', { name: 'Voir Am7 à la guitare' });
  await expect(best).toBeVisible();
  // Without the A: C E G, a C chord.
  await finder.getByRole('button', { name: 'A3', exact: true }).click();
  await expect(finder.getByRole('button', { name: 'Voir C à la guitare' })).toBeVisible();
  await finder.getByRole('button', { name: 'A3', exact: true }).click();
  await finder.getByRole('button', { name: 'Voir Am7 à la guitare' }).click();
  await expect(page.locator('.chord-sym')).toHaveText('Am7');
  await expect(page.locator('.diagram-main .chord-svg')).toBeVisible();
  await finder.getByRole('button', { name: 'Effacer' }).click();
  await expect(finder.locator('g.lit, g.root')).toHaveCount(0);
});

test('grid and stage: the chord being played on the piano, which can be hidden', async ({ page }) => {
  await page.goto('#/composer/grille/g-minuit');
  await page.getByRole('button', { name: /Boucle/ }).click();
  const live = page.locator('.live-chords');
  await expect(live.locator('.piano-keys')).toBeVisible();
  // The keyboard shows the chord named above it.
  const name = (await live.locator('.live-now .live-name').textContent())!.trim();
  await expect(live.locator('.piano-keys')).toHaveAttribute('aria-label', new RegExp(`^${name} au piano`));
  await live.getByRole('button', { name: 'Piano' }).click();
  await expect(live.locator('.piano-keys')).toHaveCount(0);
  await page.getByRole('button', { name: /Arrêter/ }).click();

  // On stage the lyrics come first: hidden until « Piano » is touched.
  await page.goto('#/scene/bar-du-port/play/0');
  await expect(page.locator('.sc-piano')).toHaveCount(0);
  await page.getByRole('button', { name: 'Piano', exact: true }).click();
  await expect(page.locator('.sc-piano .piano-keys')).toHaveAttribute('aria-label', /^E au piano/);
});
