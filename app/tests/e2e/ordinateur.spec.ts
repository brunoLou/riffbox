import { readFileSync } from 'node:fs';
import type { Page } from '@playwright/test';
import { expect, guitarString, test } from './helpers';

test.use({ viewport: { width: 1440, height: 900 } });

/** Drops files on the window, as from the computer's file manager. */
async function drop(page: Page, files: { name: string; type: string; base64: string }[]) {
  await page.evaluate(fs => {
    const dt = new DataTransfer();
    for (const f of fs) dt.items.add(new File([Uint8Array.from(atob(f.base64), c => c.charCodeAt(0))], f.name, { type: f.type }));
    const target = document.querySelector('.phone')!;
    for (const type of ['dragenter', 'dragover', 'drop']) target.dispatchEvent(new DragEvent(type, { dataTransfer: dt, bubbles: true, cancelable: true }));
  }, files);
}

test('on a computer: tabs as a sidebar, a wide centred column, the home board four pedals a row', async ({ page }) => {
  await page.goto('#/');
  const side = (await page.locator('.tabbar').boundingBox())!;
  expect(side.x).toBe(0);
  expect(side.width).toBe(220);
  expect(side.height).toBe(900);
  await expect(page.locator('.tabbar a.tab')).toHaveText(['Accueil', 'Composer', 'Pratiquer', 'Live']);
  const col = (await page.locator('.phone').boundingBox())!;
  expect(col.x).toBeGreaterThanOrEqual(220);
  expect(col.width).toBeGreaterThan(800);
  // Four pedals on the first row.
  const ys = await page.locator('.pedal').evaluateAll(els => els.slice(0, 4).map(e => Math.round(e.getBoundingClientRect().top)));
  expect(new Set(ys).size).toBe(1);

  // The grid: the circle of fifths beside the chords.
  await page.locator('.tabbar .tab', { hasText: 'Composer' }).click();
  await page.goto('#/composer/grille/g-minuit');
  const slots = (await page.locator('.slots').boundingBox())!;
  const wheel = (await page.locator('.wheel').boundingBox())!;
  expect(wheel.x).toBeGreaterThan(slots.x + 200);
  expect(wheel.y).toBeLessThan(slots.y + slots.height + 100);
});

test('on a computer: « / » searches the songs; files dropped on the window are imported', async ({ page }) => {
  await page.goto('#/scene/morceaux');
  await expect(page.locator('.lib-row').first()).toBeVisible();
  await page.keyboard.press('/');
  await expect(page.getByLabel('Rechercher un titre')).toBeFocused();
  await page.keyboard.type('caf');
  await expect(page.locator('.lib-row .song-title')).toHaveText(['Café noir']);

  // A chord sheet dropped from the home screen: the library opens and imports it.
  await page.goto('#/');
  const sheet = 'Le Fleuve\n\nG          D\nLe fleuve dort sous la chaleur\n';
  await drop(page, [{ name: 'le-fleuve.txt', type: 'text/plain', base64: Buffer.from(sheet).toString('base64') }]);
  await expect(page).toHaveURL(/#\/scene\/morceaux$/);
  const dialog = page.getByRole('dialog', { name: 'Importer des morceaux' });
  await expect(dialog.locator('.cp-pick .song-title')).toHaveText(['Le Fleuve']);
  await dialog.getByRole('button', { name: 'Importer 1 morceau' }).click();
  await expect(page.locator('.lib-row', { hasText: 'Le Fleuve' })).toHaveCount(1);

  // An audio file: into « Mes fichiers » of the backing tracks.
  await drop(page, [{ name: 'Mon blues 80 bpm.wav', type: 'audio/wav', base64: readFileSync(guitarString('drop-audio', 196)).toString('base64') }]);
  await expect(page).toHaveURL(/#\/pratiquer\/backing$/);
  await expect(page.getByRole('button', { name: 'Mes fichiers' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.track', { hasText: 'Mon blues 80 bpm' }).locator('.track-bpm')).toHaveText('80 BPM');
});
