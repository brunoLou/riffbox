import { button, expect, test } from './helpers';

test.use({ viewport: { width: 1440, height: 900 } });

test('computer, wide window: songs and setlists in two panes, the list stays', async ({ page }) => {
  await page.goto('#/scene/morceaux');
  const left = page.locator('.pane-left'), right = page.locator('.pane-right');
  await expect(right).toContainText('Choisissez un morceau');
  await expect(page.getByRole('navigation', { name: 'Onglets' })).toHaveCount(1);
  await left.getByLabel('Rechercher un titre').fill('min');
  await left.locator('.lib-row', { hasText: 'Minuit Shuffle' }).click();
  await expect(page).toHaveURL(/#\/scene\/morceau\/s3$/);
  await expect(right.locator('.chordpro')).toHaveValue(/Couplet/);
  // The list is still there, with its search, and shows which song is open.
  await expect(left.getByLabel('Rechercher un titre')).toHaveValue('min');
  await expect(left.locator('.lib-row.sel')).toHaveText(/Minuit Shuffle/);
  await expect(right.getByRole('button', { name: 'Retour' })).toHaveCount(0);

  await left.getByRole('button', { name: 'Setlists' }).or(left.getByRole('link', { name: 'Setlists' })).first().click();
  await expect(page).toHaveURL(/#\/scene$/);
  await expect(page.locator('.pane-right')).toContainText('Choisissez une setlist');
  await page.locator('.pane-left .set-card', { hasText: 'BAR DU PORT' }).click();
  await expect(page.locator('.pane-right')).toContainText('Avant de monter sur scène');
  await expect(page.locator('.pane-left .set-card.sel')).toContainText('Bar du Port');
  await button(page, '▶  Jouer le set').click();
  await expect(page).toHaveURL(/#\/scene\/bar-du-port\/play\/0$/); // the stage stays full screen
  await expect(page.locator('.pane')).toHaveCount(0);
});

test('computer, wide window: chords with the guitar shape on the left, piano and neck on the right', async ({ page }) => {
  await page.goto('#/pratiquer/accords');
  const diagram = await page.locator('.diagram-card').boundingBox();
  const piano = await page.locator('.piano-chord').first().boundingBox();
  const neck = await page.locator('.neck-wrap').boundingBox();
  expect(piano!.x).toBeGreaterThan(diagram!.x + diagram!.width);
  expect(Math.abs(piano!.y - diagram!.y)).toBeLessThan(300); // side by side, not below
  expect(neck!.x).toBeGreaterThan(diagram!.x + diagram!.width);
  expect(neck!.y + neck!.height).toBeLessThan(900); // all of it in view
});
