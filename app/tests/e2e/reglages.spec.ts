import { readFileSync } from 'node:fs';
import { button, expect, fakeMic, guitarString, test } from './helpers';

test.use(fakeMic(guitarString('reglages-mic', 196)));

test('display settings: streak card and stage lyric size', async ({ page }) => {
  await page.goto('#/reglages');
  await page.locator('.settings-row', { hasText: 'Série de jours' }).click();
  for (let i = 0; i < 3; i++) await page.getByLabel('Plus grand').click();
  await page.goto('#/');
  await expect(page.locator('.streak')).toHaveCount(0);
  await page.goto('#/scene/bar-du-port/play/2');
  await expect(page.locator('.lyric-text').first()).toHaveCSS('font-size', '32px');
});

test('themes: light, dark, automatic; the stage stays dark', async ({ page }) => {
  await page.goto('#/reglages');
  const theme = () => page.evaluate(() => document.documentElement.dataset.theme);
  await button(page, 'Clair').click();
  expect(await theme()).toBe('light');
  await page.reload();
  expect(await theme()).toBe('light');
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#f6f1e8');
  await page.goto('#/scene/bar-du-port/play/2');
  await expect(page.locator('.lyric-text').first()).toHaveCSS('color', 'rgb(239, 230, 210)');
  await page.goto('#/reglages');
  await page.emulateMedia({ colorScheme: 'light' });
  await button(page, 'Automatique').click();
  expect(await theme()).toBe('light');
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect.poll(theme).toBe('dark');
  await button(page, 'Sombre').click();
  expect(await theme()).toBe('dark');
});

test('clearing the examples keeps my own content; resetting brings everything back', async ({ page }) => {
  await page.goto('#/scene');
  await page.getByText('+ Nouvelle setlist').click();
  await page.locator('.set-title-input').fill('Mon set');
  await button(page, 'Terminé').click();
  await page.goto('#/reglages');
  await expect(page.locator('.settings-help').filter({ hasText: 'Retire' })).toContainText('5 idées, 3 grilles, 11 morceaux, 3 setlists');
  await button(page, 'Effacer les exemples').click();
  await expect(page.locator('.data-list').first()).toContainText('Setlists1');
  await page.goto('#/scene');
  await expect(page.locator('.set-name')).toHaveText(['Mon set']);
  await page.goto('#/reglages');
  await page.getByText('Tout réinitialiser…').click();
  await Promise.all([page.waitForEvent('load'), page.locator('.settings-card.danger .btn-danger').click()]);
  await expect(page).toHaveURL(/#\/$/);
  await page.goto('#/scene');
  await expect(page.locator('.set-name')).toHaveCount(3);
});

test('backup: export, restore after a reset, and merge on another device', async ({ page, browser }) => {
  // Some content of my own, with a recording.
  await page.goto('#/composer');
  await page.locator('.rec-cta').click();
  await expect(page.locator('.rec-time')).toHaveText(/0:0[1-9]/);
  await page.getByText('■ Arrêter et ranger').click();
  const memo = (await page.locator('.idea-title').first().textContent())!;
  await page.goto('#/metronome');
  for (let i = 0; i < 7; i++) await page.getByLabel('Plus 1 BPM').click();

  await page.goto('#/reglages');
  const [download] = await Promise.all([page.waitForEvent('download'), button(page, 'Exporter').click()]);
  expect(download.suggestedFilename()).toMatch(/^riffbox-sauvegarde-\d{4}-\d{2}-\d{2}\.json$/);
  const file = await download.path();
  const json = JSON.parse(readFileSync(file, 'utf8'));
  expect(json.app).toBe('riffbox');
  expect(Object.keys(json.audio)).toHaveLength(1);
  expect(JSON.stringify(json.data.ideas)).not.toContain('blob:');
  expect(json.data['metro.bpm']).toBe(99);
  await expect(page.locator('.backup-msg')).toContainText('avec 1 enregistrement');

  // A file that is not a backup is refused.
  await page.locator('input[type=file]').setInputFiles({ name: 'x.json', mimeType: 'application/json', buffer: Buffer.from('{"hello":1}') });
  await expect(page.locator('.backup-msg')).toHaveText('Ce fichier n’est pas une sauvegarde RIFFBOX.');

  // Reset (the app reloads itself on the home screen), then restore everything.
  await page.getByText('Tout réinitialiser…').click();
  await Promise.all([page.waitForEvent('load'), page.locator('.settings-card.danger .btn-danger').click()]);
  await expect(page).toHaveURL(/#\/$/);
  await page.goto('#/reglages');
  await page.locator('input[type=file]').setInputFiles(file);
  await expect(page.locator('.backup-import .data-list')).toContainText('Enregistrements audio1');
  await button(page, 'Tout remplacer…').click();
  // The app reloads itself on the same address once the data is written: wait for that reload.
  await Promise.all([page.waitForEvent('load'), button(page, 'Tout remplacer').click()]);
  await expect(page).toHaveURL(/#\/reglages$/);
  await page.goto('#/composer');
  await page.locator('.kind-chip', { hasText: 'Tout' }).click();
  const restored = page.locator('.idea', { has: page.locator('.idea-title', { hasText: memo }) });
  await expect(restored).toHaveCount(1);
  await restored.locator('.idea-play').click();
  await expect(restored.locator('.idea-play.on')).toHaveCount(1);
  await page.goto('#/');
  await expect(page.locator('[data-tile="metro"] .pedal-sub')).toHaveText('99 BPM · 4/4');

  // Another device with its own setlist: merging adds what is missing, overwrites nothing.
  const other = await browser.newContext({ viewport: { width: 520, height: 960 }, reducedMotion: 'reduce', serviceWorkers: 'block' });
  const p2 = await other.newPage();
  await p2.goto('/#/scene');
  await p2.getByText('+ Nouvelle setlist').click();
  await p2.locator('.set-title-input').fill('Set B');
  await p2.getByRole('button', { name: 'Terminé', exact: true }).click();
  await p2.goto('/#/reglages');
  await p2.locator('input[type=file]').setInputFiles(file);
  await p2.getByRole('button', { name: 'Ajouter à mes données', exact: true }).click();
  await expect(p2.locator('.backup-msg')).toContainText('élément');
  await p2.waitForTimeout(1500);
  await p2.goto('/#/composer');
  await expect(p2.locator('.idea-title', { hasText: memo })).toHaveCount(1);
  await p2.goto('/#/scene');
  await expect(p2.locator('.set-name', { hasText: 'Set B' })).toHaveCount(1);
  await other.close();
});
