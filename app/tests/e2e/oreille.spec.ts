import { chordType, voicingMidi, voicings } from '../../src/lib/chords';
import { button, expect, fakeMic, strummedChords, test } from './helpers';

// The microphone: a C major chord strummed again and again.
const C = voicingMidi(voicings(0, chordType('maj'))[0]);
test.use(fakeMic(strummedChords('oreille-c', Array.from({ length: 12 }, () => C), 1.5, true)));

test('ear training: intervals then chords, with the answer shown and the scores kept', async ({ page }) => {
  await page.goto('#/pratiquer');
  await page.getByRole('button', { name: /^Oreille/ }).click();
  await expect(page).toHaveURL(/#\/pratiquer\/oreille$/);
  await button(page, 'Commencer').click();
  const choices = page.getByRole('group', { name: 'Réponses' }).getByRole('button');
  await expect(choices).toHaveText(['Quarte juste', 'Quinte juste', 'Octave']);
  await choices.first().click();
  await expect(page.locator('.ear-result')).toHaveText(/^(Bonne réponse !|C’était : (Quinte juste|Octave)\.)$/);
  await expect(page.locator('.ear-choice.right')).toHaveCount(1);
  await expect(choices.first()).toBeDisabled();
  await expect(page.getByLabel('Score de la séance')).toHaveText(/^[01]\/1$/);
  await expect(page.getByLabel('Vos scores')).toContainText('sur 1 question');

  // The right answer, this time: the one shown after a first try.
  await button(page, 'Suivant ›').click();
  await choices.nth(1).click();
  const right = (await page.locator('.ear-choice.right').textContent())!;
  await button(page, 'Suivant ›').click();
  await expect(page.locator('.ear-result')).toHaveCount(0);
  await expect(page.getByLabel('Vos scores')).toContainText('sur 2 questions');
  expect(['Quarte juste', 'Quinte juste', 'Octave']).toContain(right);

  // Chords, intermediate: five qualities to tell apart.
  await page.getByRole('group', { name: 'Exercice' }).getByRole('button', { name: 'Accords' }).click();
  await page.getByRole('group', { name: 'Niveau' }).getByRole('button', { name: 'Intermédiaire' }).click();
  await button(page, 'Commencer').click();
  await expect(choices).toHaveText(['Majeur', 'Mineur', 'Septième (7)', 'Septième majeure (maj7)', 'Mineur 7 (m7)']);
  await choices.nth(0).click();
  await expect(page.locator('.ear-result')).toBeVisible();

  // Kept for next time.
  await page.reload();
  await expect(page.getByRole('group', { name: 'Exercice' }).getByRole('button', { name: 'Accords' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByLabel('Vos scores')).toContainText('sur 1 question');
});

test('ear training: play the chord the app names, the microphone checks it', async ({ page }) => {
  await page.goto('#/pratiquer/oreille');
  await page.getByRole('group', { name: 'Exercice' }).getByRole('button', { name: 'Jouer l’accord' }).click();
  await page.getByLabel('Accord à jouer').selectOption('C');
  await expect(page.locator('.ear-target')).toContainText('Do majeur');
  await page.getByRole('button', { name: 'Voir le schéma' }).click();
  await expect(page.locator('.ear-shape .chord-svg')).toBeVisible();
  await button(page, 'Écouter ma guitare').click();
  await expect(page.locator('.ear-result.ok')).toHaveText('Bien joué : c’est bien Do majeur !', { timeout: 20_000 });
  await expect(page.getByLabel('Vos scores')).toContainText('Réussite 100 % sur 1 accord joué');
});
