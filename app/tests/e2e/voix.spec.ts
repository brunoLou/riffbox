import { button, expect, fakeMic, sungNote, test } from './helpers';

// The microphone sings A3 (220 Hz) 10 cents sharp.
test.use(fakeMic(sungNote('voix-la-plus-10', 220, 10)));

test('vocal tuner: note, cents and an adjustable in-tune zone', async ({ page }) => {
  await page.goto('#/voix');
  await expect(page.locator('.vnote')).toHaveText('La2');
  await expect(page.locator('.vnote-side')).toContainText('A3');
  await expect(page.locator('.vcents')).toHaveText(/^\+(9|10|11|12) ct$/);
  await expect(page.locator('.vjuste.on')).toHaveCount(1);
  for (let i = 0; i < 4; i++) await page.getByLabel('Tolérance plus stricte').click();
  await expect(page.locator('.tol .mono')).toHaveText('±5 ct');
  await expect(page.locator('.cents-zone')).toHaveAttribute('style', /width: 10%/);
  await expect(page.locator('.vjuste.on')).toHaveCount(0);
  await page.locator('.seg button', { hasText: 'Courbe' }).click();
  await expect(page.locator('.roll-voice').first()).toBeVisible();
});

test('measures the range and finds a key, applied on stage with a capo', async ({ page }) => {
  await page.goto('#/voix/tessiture');
  await page.locator('.tess-card').nth(0).getByText('● Mesurer').click();
  await expect(page.locator('.voice-note')).toHaveText('Note grave : La2 (A3).', { timeout: 8000 });
  for (let i = 0; i < 12; i++) await page.getByLabel('Note la plus aiguë : un demi-ton plus haut').click();
  await page.getByText('Trouver ma tonalité ›').click();
  const minuit = page.locator('.fit-card', { has: page.locator('.song-title', { hasText: /^Minuit Shuffle$/ }) });
  await expect(minuit.locator('.fit-key')).toHaveText('Fa');
  await minuit.locator('.fit-top').click();
  await button(page, 'Appliquer en live').click();
  await expect(minuit.locator('.voice-note')).toHaveText('En live : accords en formes de Mi, capo 1. Ça sonnera en Fa.');
  await page.goto('#/scene/bar-du-port/play/2');
  await expect(page.locator('.stage-tag', { hasText: 'Capo' })).toHaveText('Capo 1');
  await expect(page.locator('.lyric-chord').first()).toHaveText(/^E7/);
});

test('an exercise runs, is scored and recorded, and can be reviewed', async ({ page }) => {
  await page.goto('#/voix/exercices');
  await expect(page.locator('.ex-card')).toHaveCount(7);
  await page.locator('.ex-card', { hasText: 'Tierces' }).click();
  await page.getByText('▶  Commencer').click();
  await expect(page.locator('.session-status')).toContainText('Prêt…');
  await expect(page.locator('.roll-voice').first()).toBeVisible({ timeout: 10_000 });
  await expect(page).toHaveURL(/#\/voix\/prise\/take\d+$/, { timeout: 40_000 });
  await expect(page.locator('.phrase-chip')).toHaveCount(3);
  const score = Number(await page.locator('.result-score').textContent());
  expect(score).toBeGreaterThanOrEqual(0);
  expect(score).toBeLessThan(60); // a steady A does not sing thirds
  await page.getByText('▶  Réécouter').click();
  await expect(page.locator('.roll-now.play')).toHaveCount(1);
  await page.goto('#/voix/prises');
  await expect(page.locator('.take-main')).toHaveCount(1);
});

test('capo calculator', async ({ page }) => {
  await page.goto('#/outils/capo?key=10&m=0');
  await expect(page.locator('.capo-best')).toContainText('CAPO 1');
  await expect(page.locator('.capo-best')).toContainText('formes de La');
  await page.locator('.seg button', { hasText: 'Mineur' }).click();
  await expect(page.locator('.capo-best')).toContainText('CAPO 1');
  await expect(page.locator('.capo-row.best .capo-chords')).toHaveText('Am Dm E7');
});
