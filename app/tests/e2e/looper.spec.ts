import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { button, expect, fakeMic, guitarString, inspectAudio, test } from './helpers';

test.use(fakeMic(guitarString('looper-mic', 196)));

test('looper: a loop over a count-in, layers on top, undo, pedal, stems and the notebook', async ({ page }) => {
  // One bar of 4/4 at 120 BPM: a loop of exactly 2 seconds.
  await page.goto('#/pratiquer/looper');
  await page.evaluate(() => localStorage.setItem('riffbox:v1:looper.settings', JSON.stringify({ bpm: 120, beats: 4, bars: 1 })));
  await page.reload();
  await expect(page.locator('.loop-len')).toHaveText('1 mes. · 0:02');

  await button(page, '● Enregistrer').click();
  await expect(page.locator('.loop-state')).toHaveText('Décompte');
  await expect(page.locator('.loop-state')).toHaveText('Enregistrement', { timeout: 5000 });
  const layers = page.locator('.loop-layer');
  await expect(layers).toHaveCount(1, { timeout: 8000 });
  await expect(page.locator('.loop-state')).toHaveText('Lecture');
  // Tempo and length are now fixed by the first layer.
  await expect(page.getByRole('button', { name: 'Accélérer' })).toBeDisabled();

  // A second layer, from the next loop start.
  await button(page, '＋ Superposer').click();
  await expect(layers).toHaveCount(2, { timeout: 8000 });
  // Pedal: ← undoes the last layer, → records another.
  await page.keyboard.press('ArrowLeft');
  await expect(layers).toHaveCount(1);
  await page.keyboard.press('ArrowRight');
  await expect(layers).toHaveCount(2, { timeout: 8000 });
  await expect(layers.nth(1).locator('.layer-name')).toHaveText('Couche 2');

  await layers.nth(0).getByRole('button', { name: 'Muet' }).click();
  await expect(layers.nth(0)).toHaveClass(/muted/);
  await page.keyboard.press(' ');
  await expect(page.locator('.loop-state')).toHaveText('Arrêté');

  // Stems for a music program: every layer and the mix, exactly one loop long.
  await page.getByLabel('Tonalité (facultatif)').selectOption({ label: 'Sol' });
  const dl = page.waitForEvent('download');
  await button(page, 'Exporter les pistes (.zip)').click();
  const d = await dl;
  const dir = mkdtempSync(join(tmpdir(), 'riffbox-loop-'));
  await d.saveAs(join(dir, 'loop.zip'));
  const z = inspectAudio(join(dir, 'loop.zip'));
  const names = z.names.map((n: string) => n.split('/').pop()).sort();
  expect(names).toEqual(['Couche 1.wav', 'Couche 2.wav', 'LISEZMOI.txt', 'Mix.wav']);
  expect(z.names[0]).toMatch(/^RIFFBOX boucle \d{4}-\d\d-\d\d - 120 BPM - Sol\//);
  for (const [name, w] of Object.entries(z.wavs) as [string, { fmt: number[]; frames: number; acid: number[]; peak: number; crossings_per_s: number }][]) {
    const rate = w.fmt[2];
    expect(w.frames, name).toBe(2 * rate);
    expect(w.acid, name).toEqual([2, 67, 4, 4, 4, 120]);
    expect(w.peak, name).toBeGreaterThan(0.01);
    expect(Math.abs(w.crossings_per_s - 196), name).toBeLessThan(20); // the G string, recorded
  }

  // Kept in the notebook as one loop.
  await button(page, 'Garder dans le carnet').click();
  await expect(page.locator('.backup-msg')).toContainText('« Boucle 120 BPM en Sol » est dans le carnet');
  await page.getByRole('button', { name: 'Voir le carnet ›' }).click();
  const card = page.locator('.idea', { hasText: 'Boucle 120 BPM en Sol' });
  await expect(card.locator('.tag')).toContainText(['Sol', '120 BPM']);
  await expect(card.locator('.idea-meta')).toContainText('0:02');

  // Back in the looper: the layers are still there; « Tout effacer » frees the settings.
  await page.goto('#/pratiquer/looper');
  await expect(layers).toHaveCount(2);
  await page.getByRole('button', { name: 'Tout effacer' }).click();
  await expect(layers).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Accélérer' })).toBeEnabled();
});

test('the looper from a grid takes its tempo; the latency is set by hand or measured', async ({ page }) => {
  await page.goto('#/composer/grille/g-minuit');
  await page.getByRole('button', { name: 'Réglages de la grille' }).click();
  await button(page, 'Jouer par-dessus dans le looper ›').click();
  await expect(page).toHaveURL(/#\/pratiquer\/looper$/);
  await expect(page.locator('.loop-settings .mono')).toHaveText('92 BPM');

  const value = page.locator('.loop-latency .mono');
  const before = parseInt((await value.textContent())!, 10);
  await page.getByRole('button', { name: 'Plus de retard' }).click();
  await expect(value).toHaveText(`${before + 5} ms`);
  await page.reload();
  await expect(value).toHaveText(`${before + 5} ms`); // kept on this device

  // The fake microphone plays a guitar, not the beeps: the measure says so instead of guessing.
  await button(page, 'Mesurer le retard (sans casque)').click();
  await expect(page.locator('.backup-msg')).toContainText(/Bips mal entendus|Retard mesuré/, { timeout: 12_000 });
});

test('merging the layers that can be heard frees memory; muted layers stay apart; the result is one loop', async ({ page }) => {
  await page.goto('#/pratiquer/looper');
  await page.evaluate(() => localStorage.setItem('riffbox:v1:looper.settings', JSON.stringify({ bpm: 120, beats: 4, bars: 1 })));
  await page.reload();
  const layers = page.locator('.loop-layer');
  await button(page, '● Enregistrer').click();
  await expect(layers).toHaveCount(1, { timeout: 8000 });
  for (const n of [2, 3]) {
    await button(page, '＋ Superposer').click();
    await expect(layers).toHaveCount(n, { timeout: 8000 });
  }
  await page.keyboard.press(' '); // stop
  const head = page.locator('.loop-layers-head .kicker');
  await expect(head).toHaveText(/^3 couches · [\d,]+ Mo en mémoire$/);
  const mb = async () => parseFloat((await head.textContent())!.split('·')[1].replace(',', '.'));
  const before = await mb();

  await layers.nth(1).getByRole('button', { name: 'Muet' }).click();
  await button(page, 'Fusionner…').click();
  await expect(page.locator('.loop-note', { hasText: 'ne pourrez plus les séparer' })).toBeVisible();
  await button(page, 'Fusionner 2 couches').click();
  await expect(page.locator('.backup-msg')).toHaveText('2 couches fusionnées en une.');
  await expect(layers).toHaveCount(2);
  await expect(layers.nth(1)).toHaveClass(/muted/); // the muted layer stays apart
  await expect(head).toHaveText(/^2 couches/);
  expect(await mb()).toBeLessThan(before * 0.75);
  // Only one audible layer left: nothing to merge.
  await expect(button(page, 'Fusionner…')).toBeDisabled();

  // The merged layer is still exactly one loop, and plays.
  const dl = page.waitForEvent('download');
  await button(page, 'Exporter les pistes (.zip)').click();
  const dir = mkdtempSync(join(tmpdir(), 'riffbox-merge-'));
  await (await dl).saveAs(join(dir, 'm.zip'));
  const z = inspectAudio(join(dir, 'm.zip'));
  expect(Object.keys(z.wavs).map((n: string) => n.split('/').pop()).sort()).toEqual(['Couche 1.wav', 'Couche 2.wav', 'Mix.wav']);
  for (const w of Object.values(z.wavs) as { fmt: number[]; frames: number; peak: number }[]) {
    expect(w.frames).toBe(2 * w.fmt[2]);
    expect(w.peak).toBeGreaterThan(0.01);
    expect(w.peak).toBeLessThanOrEqual(1);
  }
  await page.keyboard.press(' ');
  await expect(page.locator('.loop-state')).toHaveText('Lecture');
});
