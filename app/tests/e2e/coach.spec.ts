import { chordType, voicingMidi, voicings } from '../../src/lib/chords';
import { button, expect, fakeMic, strummedChords, test } from './helpers';

// The microphone alternates C and G every 1.5 s, strummed twice each: a strum on every beat at 80 BPM.
const C = voicingMidi(voicings(0, chordType('maj'))[0]), G = voicingMidi(voicings(7, chordType('maj'))[0]);
test.use(fakeMic(strummedChords('coach-cg-pick', Array.from({ length: 24 }, (_, i) => (i % 2 ? G : C)), 1.5, true)));

test('the coach: goals, styles and time, three tests at the microphone, then a routine for my level', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('#/pratiquer');
  await page.evaluate(() => localStorage.setItem('riffbox:v1:coach.testScale', '0.25')); // shorter tests
  await page.locator('.coach-card').click();
  await expect(page).toHaveURL(/#\/pratiquer\/coach$/);

  // 1. Goals.
  await expect(button(page, 'Suivant ›')).toBeDisabled();
  await page.getByRole('button', { name: /^Accords et accompagnement/ }).click();
  await page.getByRole('button', { name: /^Solo et improvisation/ }).click();
  await button(page, 'Suivant ›').click();
  // 2. Styles and time.
  await page.getByRole('group', { name: 'Styles' }).getByRole('button', { name: 'Blues' }).click();
  await page.getByRole('group', { name: 'Temps par jour' }).getByRole('button', { name: '20 min' }).click();
  await button(page, 'Suivant ›').click();

  // 3. One-minute changes, counted from the microphone (C ↔ G).
  await button(page, 'Commencer (1 minute)').click();
  const meter = page.locator('.coach-meter');
  await expect(meter).toContainText('changements par minute', { timeout: 30_000 });
  const changes = Number(await meter.locator('b').textContent());
  expect(changes).toBeGreaterThanOrEqual(20);
  expect(changes).toBeLessThanOrEqual(48);
  await button(page, 'Suivant ›').click();

  // 4. Pentatonic at the click: clean at 60 and 70, too hard at 80 → 70 BPM.
  await button(page, 'Commencer à 60 BPM').click();
  await button(page, 'Propre ✓ (plus vite)').click();
  await button(page, 'Propre ✓ (plus vite)').click();
  await expect(meter.locator('b')).toHaveText('80');
  await button(page, 'Trop dur ✗').click();
  await expect(meter).toContainText('70BPM propre · Intermédiaire');
  await button(page, 'Suivant ›').click();

  // 5. Strumming with the click: a steady player is « avancé ».
  await page.getByRole('button', { name: /^Commencer \(/ }).click();
  await expect(meter).toContainText('ms autour du clic', { timeout: 30_000 });
  const spread = Number((await meter.locator('b').textContent())!.replace(/\D/g, ''));
  expect(spread).toBeLessThanOrEqual(20);
  await button(page, 'Voir mon programme ›').click();

  // The programme: levels per skill, and a 20-minute routine.
  const lv = page.getByRole('list', { name: 'Vos niveaux' }).getByRole('listitem');
  await expect(lv).toHaveCount(3);
  await expect(lv.nth(1)).toContainText('Intermédiaire');
  await expect(lv.nth(1)).toContainText('penta en croches à 70 BPM');
  await expect(lv.nth(2)).toContainText('Avancé');
  await expect(page.locator('.coach-routine-head .mono')).toHaveText('20 min');
  const mins = (await page.locator('.coach-step-name .mono').allTextContents()).map(t => Number(t.match(/\d+/)![0]));
  expect(mins.reduce((a, b) => a + b, 0)).toBe(20);
  await expect(page.locator('.coach-step-name').first()).toContainText('Échauffement');

  // Used as today's routine; its steps open their tool already set up.
  await button(page, 'Utiliser cette routine aujourd’hui').click();
  await expect(page).toHaveURL(/#\/pratiquer\/routine$/);
  await page.locator('.rlink').first().click();
  await expect(page).toHaveURL(/#\/metronome$/);
  expect(Number(await page.evaluate(() => localStorage.getItem('riffbox:v1:metro.bpm')))).toBeGreaterThanOrEqual(60);

  await page.goto('#/pratiquer');
  await expect(page.locator('.routine-kicker')).toHaveText('Routine du jour · coach');
  await expect(page.locator('.coach-card-sub')).toContainText('Votre programme');

  // Back to my own routine.
  await page.locator('.coach-card').click();
  await button(page, 'Revenir à ma routine').click();
  await page.goto('#/pratiquer');
  await expect(page.locator('.routine-kicker')).toHaveText('Routine du jour');
  await expect(page.locator('.rstep-name')).toContainText(['Échauffement', 'Technique', 'Gammes', 'Impro']);
});

test('the coach without the tests: the player says where they stand', async ({ page }) => {
  await page.goto('#/pratiquer/coach');
  await page.getByRole('button', { name: /^Rythme/ }).click();
  await button(page, 'Suivant ›').click();
  await page.getByRole('button', { name: 'Funk' }).click();
  await button(page, 'Suivant ›').click();
  for (const [skill, level] of [['Accords', 'Débutant'], ['Gammes et technique', 'Avancé'], ['Rythme', 'Intermédiaire']]) {
    await page.getByRole('group', { name: `Mon niveau : ${skill}` }).getByRole('button', { name: level }).click();
    await button(page, skill === 'Rythme' ? 'Voir mon programme ›' : 'Suivant ›').click();
  }
  const lv = page.getByRole('list', { name: 'Vos niveaux' }).getByRole('listitem');
  await expect(lv.nth(0)).toContainText('Débutant');
  await expect(lv.nth(0)).toContainText('niveau indiqué');
  await expect(lv.nth(2)).toContainText('Intermédiaire');
  await expect(page.locator('.coach-step-name')).toContainText(['Échauffement', 'Rythme']);
  await expect(page.locator('.coach-step-detail').nth(1)).toContainText('ghost notes'); // funk, intermediate
  // Later: the programme stays, and can be used from the coach screen.
  await button(page, 'Plus tard').click();
  await expect(page.locator('h1')).toHaveText('COACH');
  await page.reload();
  await expect(button(page, 'Utiliser cette routine aujourd’hui')).toBeVisible();
});

const DAY = 86400000;
/** A player who took the check-up a month ago (modest results), and uses the coach. */
const monthAgo = (page: import('@playwright/test').Page) => page.addInitScript(() => {
  if (sessionStorage.getItem('prepared')) return;
  sessionStorage.setItem('prepared', '1');
  const set = (k: string, v: unknown) => localStorage.setItem('riffbox:v1:' + k, JSON.stringify(v));
  const then = Date.now() - 30 * 86400000;
  set('coach.profile', { goals: ['rhythm', 'solo'], styles: ['blues'], minutes: 20, measures: { changes: 10, pair: 'Do ↔ Sol', scaleBpm: 60, rhythmMs: 60 }, declared: {}, date: then });
  set('coach.testScale', 0.25);
});

test('coach over time: « facile » raises the tempo of the next routine, the week is reviewed', async ({ page }) => {
  await monthAgo(page);
  await page.goto('#/pratiquer/coach');
  await button(page, 'Utiliser cette routine aujourd’hui').click();
  // The rhythm step, at its starting tempo.
  const rhythm = page.locator('.rlist-row', { hasText: 'Rythme' });
  await rhythm.click();
  const feel = page.getByRole('group', { name: /^Rythme à \d+ BPM : comment c’était/ });
  const played = Number((await feel.getAttribute('aria-label'))!.match(/(\d+) BPM/)![1]);
  await feel.getByRole('button', { name: 'Facile' }).click();
  await expect(feel.getByRole('button', { name: 'Facile' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.coach-feel-next')).toHaveText(`Prochaine fois : ${played + 4} BPM (+4).`);
  // Changing one's mind the same day replaces the answer.
  await feel.getByRole('button', { name: 'Difficile' }).click();
  await expect(page.locator('.coach-feel-next')).toHaveText(`Prochaine fois : ${played - 4} BPM, pour jouer propre.`);
  await feel.getByRole('button', { name: 'Facile' }).click();

  // The coach's programme now uses the new tempo, and the week shows it.
  await page.goto('#/pratiquer/coach');
  await expect(page.locator('.coach-step-detail', { hasText: `${played + 4} BPM` })).toHaveCount(1);
  const week = page.getByRole('region', { name: 'Bilan de la semaine' });
  await expect(week.locator('.coach-tempos li')).toContainText([`Rythme${played} → ${played + 4} BPM+4`]);
  await expect(week.locator('.coach-advice')).not.toBeEmpty();
});

test('coach over time: a month later, the three tests again, compared with the first check-up', async ({ page }) => {
  test.setTimeout(120_000);
  await monthAgo(page);
  await page.goto('#/pratiquer/coach');
  const month = page.getByRole('region', { name: 'Test du mois' });
  await month.getByRole('button', { name: 'Passer le test du mois' }).click();
  await expect(page.locator('.kicker').first()).toHaveText('Test du mois · 1/3');
  await button(page, 'Commencer (1 minute)').click();
  await expect(page.locator('.coach-meter')).toContainText('changements par minute', { timeout: 30_000 });
  await button(page, 'Suivant ›').click();
  await button(page, 'Commencer à 60 BPM').click();
  await button(page, 'Propre ✓ (plus vite)').click(); // 60 clean
  await button(page, 'Propre ✓ (plus vite)').click(); // 70 clean
  await button(page, 'Trop dur ✗').click(); // 80 too hard → 70
  await button(page, 'Suivant ›').click();
  await page.getByRole('button', { name: /^Commencer \(/ }).click();
  await expect(page.locator('.coach-meter')).toContainText('ms autour du clic', { timeout: 30_000 });
  await button(page, 'Voir mes progrès ›').click();

  const changes = page.locator('.coach-changes li');
  await expect(changes).toHaveCount(3);
  await expect(changes.nth(0)).toContainText('Accords10 →');
  await expect(changes.nth(1)).toContainText('60 → 70 BPM▲');
  await expect(changes.nth(2)).toContainText('60 →');
  for (let i = 0; i < 3; i++) await expect(changes.nth(i).locator('b')).toHaveText('▲');
  await button(page, 'Terminer').click();
  // The next test in four weeks; the progress since the start stays on the coach screen.
  await expect(month).toContainText('Prochain test dans 28 jours');
  await expect(month.locator('.coach-changes li')).toHaveCount(3);
});
