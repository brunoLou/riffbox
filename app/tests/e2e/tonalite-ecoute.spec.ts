import { chordType, voicingMidi, voicings } from '../../src/lib/chords';
import { button, expect, fakeMic, strummedChords, test } from './helpers';

// The microphone plays a song in Ré majeur: D G A Bm, D G A D, over and over (about 40 s).
const ch = (root: number, t: string) => voicingMidi(voicings(root, chordType(t))[0]);
const D = ch(2, 'maj'), G = ch(7, 'maj'), A = ch(9, 'maj'), Bm = ch(11, 'm');
const loop = [D, G, A, Bm, D, G, A, D];
test.use(fakeMic(strummedChords('re-majeur', [...loop, ...loop, ...loop])));

test('« Quel ton ? » hears a song in Ré majeur and opens its scale', async ({ page }) => {
  await page.goto('#/outils/ton');
  await expect(page.locator('.detect-result')).toHaveCount(0);
  await button(page, '▶ Écouter').click();
  await expect(page.locator('.detect-key')).toHaveText('Ré majeur', { timeout: 20_000 });
  // The tonic bar is the one highlighted; Ré majeur's seven notes are marked.
  await expect(page.locator('.detect-note.tonic .detect-name')).toHaveText('Ré');
  await expect(page.locator('.detect-note.in')).toHaveCount(7);
  await button(page, '■ Arrêter').click();
  await expect(page.locator('.detect-mic-state')).toHaveText('Écoute arrêtée');

  await button(page, 'Voir la gamme ›').click();
  await expect(page).toHaveURL(/#\/pratiquer\/gammes$/);
  await expect(page.locator('body')).toContainText('Ré');
});

test('from a song’s page, the key heard is applied to that song', async ({ page }) => {
  await page.goto('#/scene/morceau/s6'); // Bayou sec, in Do
  await button(page, 'Détecter le ton à l’écoute ›').click();
  await expect(page).toHaveURL(/#\/outils\/ton$/);
  await expect(page.locator('.detect-help')).toContainText('« Bayou sec »');
  await button(page, '▶ Écouter').click();
  await expect(page.locator('.detect-key')).toHaveText('Ré majeur', { timeout: 20_000 });
  await button(page, 'Appliquer à « Bayou sec »').click();
  await expect(page.locator('.backup-msg')).toHaveText('« Bayou sec » est maintenant en Ré majeur.');
  await page.goBack();
  await expect(page.locator('select.text-input').first()).toHaveValue('2');
});

test('the tile is in the catalog and the tool in Pratiquer', async ({ page }) => {
  await page.goto('#/pratiquer');
  await page.locator('[data-tile="detect"]').click();
  await expect(page).toHaveURL(/#\/outils\/ton$/);
  await expect(page.locator('h1')).toHaveText('QUEL TON ?');
});
