import { readFileSync } from 'node:fs';
import { button, expect, guitarString, test } from './helpers';

const wav = () => readFileSync(guitarString('backing-perso', 220));

test('my own backing tracks: added from a file, played in a loop at another speed, edited, kept, deleted', async ({ page }) => {
  await page.goto('#/pratiquer/backing');
  await button(page, 'Mes fichiers').click();
  await expect(page.locator('.my-empty')).toBeVisible();

  // Something that is not audio is refused; a WAV is added, its tempo read from the name.
  await page.getByLabel('Fichiers audio').setInputFiles([
    { name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('pas du son') },
    { name: 'Blues_en_La 90 bpm.wav', mimeType: 'audio/wav', buffer: wav() },
  ]);
  await expect(page.locator('.backup-msg')).toHaveText('1 fichier ajouté. Non lu par ce navigateur : notes.txt.');
  const row = page.locator('.track', { hasText: 'Blues en La 90 bpm' });
  await expect(row.locator('.track-bpm')).toHaveText('90 BPM');
  await expect(row.locator('.track-form')).toHaveText('0:12 · 1,1 Mo');

  // It plays: the position moves.
  await row.getByRole('button', { name: 'Lire Blues en La 90 bpm' }).click();
  const player = page.getByRole('region', { name: 'Lecteur' });
  await expect(player.locator('.player-kicker')).toContainText('En lecture');
  await expect.poll(async () => Number(await player.getByLabel('Position').inputValue()), { timeout: 8000 }).toBeGreaterThan(0.5);

  // Slower, pitch kept; loop on by default and can be turned off.
  await player.getByRole('button', { name: 'Plus lent' }).click();
  await player.getByRole('button', { name: 'Plus lent' }).click();
  await expect(player.locator('.stepper .mono')).toHaveText('90 %');
  await expect(player.locator('.my-note')).toHaveText('À cette vitesse : 81 BPM.');
  await expect(row.locator('.track-form')).toContainText('vitesse 90 %');
  await expect(button(page, '↻ Boucle')).toHaveAttribute('aria-pressed', 'true');
  await button(page, '↻ Boucle').click();
  await expect(button(page, '↻ Boucle')).toHaveAttribute('aria-pressed', 'false');

  // Pedal: space pauses.
  await page.keyboard.press(' ');
  await expect(player.locator('.player-kicker')).toContainText('En pause');

  // Name, key and tempo; kept after a reload.
  await row.getByRole('button', { name: 'Modifier Blues en La 90 bpm' }).click();
  const sheet = page.getByRole('dialog', { name: 'Modifier la backing track' });
  await sheet.getByLabel('Nom').fill('Blues lent en La');
  await sheet.getByLabel('Tonalité').selectOption({ label: 'La mineur' });
  await sheet.getByRole('button', { name: 'Accélérer' }).click();
  await sheet.getByLabel('Fermer').click();
  await page.reload();
  const kept = page.locator('.track', { hasText: 'Blues lent en La' });
  await expect(kept.locator('.tag.key')).toHaveText('La m');
  await expect(kept.locator('.track-bpm')).toHaveText('91 BPM');
  await expect(page.getByRole('button', { name: 'Mes fichiers' })).toHaveAttribute('aria-pressed', 'true'); // remembered

  // It still plays after the reload (the sound is kept on the device).
  await kept.getByRole('button', { name: 'Lire Blues lent en La' }).click();
  await expect(page.getByRole('region', { name: 'Lecteur' }).locator('.player-kicker')).toContainText('En lecture');

  // Back to the app's tracks: one sound at a time.
  await button(page, 'RIFFBOX').click();
  await page.getByRole('button', { name: 'Lire Blues en La' }).click();
  await expect(page.getByRole('region', { name: 'Lecteur' }).locator('.player-kicker')).toContainText('En lecture · Blues en La');
  await button(page, 'Mes fichiers').click();
  await expect(page.getByRole('region', { name: 'Lecteur' })).toHaveCount(0);

  // Deleted after a confirmation.
  await kept.getByRole('button', { name: 'Modifier Blues lent en La' }).click();
  await button(page, 'Supprimer ce fichier…').click();
  await button(page, 'Supprimer').click();
  await expect(page.locator('.track')).toHaveCount(0);
  await expect(page.locator('.my-empty')).toBeVisible();
});

test('each app track can get its own audio file: choose between it and the RIFFBOX sound, which stays as it was', async ({ page }) => {
  await page.goto('#/pratiquer/backing');
  await page.getByRole('button', { name: 'Lire Blues en La' }).click();
  const player = page.getByRole('region', { name: 'Lecteur' });
  const sound = player.getByRole('group', { name: 'Son de la backing track' });
  // RIFFBOX by default: chords, grid, key and tempo as before.
  await expect(sound.getByRole('button', { name: 'RIFFBOX' })).toHaveAttribute('aria-pressed', 'true');
  await expect(player.locator('.player-chord')).toHaveText('A7');
  await expect(player.locator('.player-bars span')).toHaveCount(12);
  await page.keyboard.press(' '); // pause

  // Attach a file to « Blues en La »: it is chosen at once.
  await page.getByLabel('Fichier audio de la backing track').setInputFiles({ name: 'Mon blues en La.wav', mimeType: 'audio/wav', buffer: wav() });
  await expect(player.locator('.backup-msg')).toHaveText('« Mon blues en La » associé à Blues en La.');
  await expect(sound.getByRole('button', { name: 'Mon fichier' })).toHaveAttribute('aria-pressed', 'true');
  await expect(player.locator('.sound-name')).toHaveText('♪ Mon blues en La · 0:12');
  await expect(player.locator('.player-chord')).toHaveCount(0);
  const row = page.locator('.track', { hasText: 'Blues en La' }).first();
  await expect(row.locator('.track-form')).toHaveText('♪ Mon fichier · Mon blues en La');

  // It plays the file (the position moves), slower if wanted.
  await player.getByRole('button', { name: 'LECTURE' }).click();
  await expect(player.locator('.player-kicker')).toContainText('En lecture');
  await expect.poll(async () => Number(await player.getByLabel('Position').inputValue()), { timeout: 8000 }).toBeGreaterThan(0.5);
  await player.getByRole('button', { name: 'Plus lent' }).click();
  await expect(player.locator('.stepper .mono')).toHaveText('95 %');

  // Back to the RIFFBOX sound: the file stops, chords, grid, key and tempo are back and still work.
  await sound.getByRole('button', { name: 'RIFFBOX' }).click();
  await expect(player.locator('.player-kicker')).toContainText('En pause');
  await expect(player.locator('.player-chord')).toHaveText('A7');
  await player.getByRole('button', { name: 'Accélérer' }).click();
  await expect(player.locator('.stepper .mono').nth(1)).toHaveText('92');
  await player.getByRole('button', { name: 'LECTURE' }).click();
  await expect(player.locator('.player-kicker')).toContainText('En lecture');
  await expect(row.locator('.track-form')).toHaveText('12 mesures · shuffle');

  // The choice and the file are kept; the file does not show in « Mes fichiers ».
  await page.reload();
  await page.getByRole('button', { name: 'Lire Blues en La' }).click();
  await page.keyboard.press(' ');
  await expect(sound.getByRole('button', { name: 'RIFFBOX' })).toHaveAttribute('aria-pressed', 'true');
  await sound.getByRole('button', { name: 'Mon fichier' }).click();
  await expect(player.locator('.sound-name')).toHaveText('♪ Mon blues en La · 0:12');
  await expect(player.locator('.stepper .mono')).toHaveText('95 %');

  // Removed: back to RIFFBOX only.
  await player.getByRole('button', { name: 'Retirer' }).click();
  await player.getByRole('button', { name: 'Retirer' }).click();
  await expect(player.locator('.backup-msg')).toHaveText('Fichier retiré : le son RIFFBOX est utilisé.');
  await expect(sound.getByRole('button', { name: 'RIFFBOX' })).toHaveAttribute('aria-pressed', 'true');
  await expect(player.getByRole('button', { name: '+ Associer un fichier audio à Blues en La…' })).toBeVisible();
  await page.getByRole('button', { name: 'Mes fichiers' }).click();
  await expect(page.locator('.my-empty')).toBeVisible();
});
