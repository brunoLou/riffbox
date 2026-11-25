import { expect, test } from './helpers';

/** A MIDI footswitch plugged in: `window.__midi([0xb0, 64, 127])` presses it. */
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const input = { name: 'Pédalier test', onmidimessage: null as null | ((e: { data: Uint8Array }) => void) };
    const access = { inputs: new Map([['in1', input]]), onstatechange: null };
    Object.defineProperty(navigator, 'requestMIDIAccess', { value: () => Promise.resolve(access), configurable: true });
    (window as unknown as { __midi: (b: number[]) => void }).__midi = b => input.onmidimessage?.({ data: new Uint8Array(b) });
  });
});
const press = (page: import('@playwright/test').Page, bytes: number[]) =>
  page.evaluate(b => (window as unknown as { __midi: (b: number[]) => void }).__midi(b), bytes);

test('MIDI pedalboard: connected, a footswitch taught to a pedal, then it drives the metronome', async ({ page }) => {
  await page.goto('#/reglages');
  const card = page.getByLabel('Pédalier MIDI');
  await card.getByRole('button', { name: 'Connecter un pédalier MIDI' }).click();
  await expect(card).toContainText('Connecté : Pédalier test');
  await card.getByRole('button', { name: 'Apprendre : Pédale droite (MIDI)' }).click();
  await expect(card.locator('.pedal-wait')).toBeVisible();
  await press(page, [0xb0, 64, 127]);
  await press(page, [0xb0, 64, 0]); // the release does not count
  await expect(card).toContainText('CC 64 · canal 1 → Pédale droite');
  // Trying it: a footswitch not taught yet.
  await press(page, [0xb0, 65, 127]);
  await expect(card.locator('.pedal-msg')).toHaveText('CC 65 · canal 1 : non attribué');

  // The metronome starts and stops with the footswitch (right pedal), after a reload too.
  await page.goto('#/metronome');
  await page.reload();
  await expect.poll(async () => { await press(page, [0xb0, 64, 127]); await press(page, [0xb0, 64, 0]); return page.locator('.cta').textContent(); }, { timeout: 5000 }).toBe('Arrêter');
  await press(page, [0xb0, 64, 127]);
  await expect(page.locator('.cta')).toContainText('Lecture');
});
