import { expect, test } from './helpers';

/** Every screen opens, shows its title and throws no error. */
const SCREENS: [string, RegExp][] = [
  ['/', /MON PEDALBOARD/], ['/accordeur', /ACCORDEUR/], ['/metronome', /MÉTRONOME/],
  ['/composer', /CARNET D’IDÉES/], ['/composer/grilles', /CARNET D’IDÉES/], ['/composer/grille/g-minuit', /MINUIT SHUFFLE/],
  ['/pratiquer', /PRATIQUER/], ['/pratiquer/routine', /ÉTAPE/], ['/pratiquer/gammes', /GAMMES/], ['/pratiquer/accords', /ACCORDS/],
  ['/pratiquer/backing', /BACKING TRACKS/], ['/voix', /JUSTESSE VOCALE/], ['/voix/exercices', /ÉCHAUFFEMENTS/],
  ['/voix/melodies', /MÉLODIES/], ['/voix/prises', /MES PRISES/], ['/voix/tessiture', /MA TESSITURE/],
  ['/voix/tonalite', /TROUVER MA TONALITÉ/], ['/voix/ex/gamme5', /GAMME 5 NOTES/], ['/outils/capo', /CAPODASTRE/], ['/outils/ton', /QUEL TON/], ['/pratiquer/looper', /LOOPER/],
  ['/scene', /SETLISTS/], ['/scene/bar-du-port', /BAR DU PORT/], ['/scene/morceaux', /MORCEAUX/],
  ['/scene/morceau/s3', /MINUIT SHUFFLE/], ['/scene/bar-du-port/play/2', /MINUIT SHUFFLE/], ['/reglages', /RÉGLAGES/],
];

for (const [route, title] of SCREENS) {
  test(`opens ${route}`, async ({ page }) => {
    await page.goto('#' + route);
    await expect(page.locator('.phone .display').first()).toHaveText(title);
  });
}

test('unknown addresses go home, old addresses still work', async ({ page }) => {
  await page.goto('#/nulle-part');
  await expect(page).toHaveURL(/#\/$/);
  await page.goto('#/scene/prompteur');
  await expect(page).toHaveURL(/#\/scene\/bar-du-port\/play\/2$/);
  await page.goto('#/composer/grille');
  await expect(page).toHaveURL(/#\/composer\/grille\/g-minuit$/);
});

test('the tab bar moves between the four tabs', async ({ page }) => {
  await page.goto('#/');
  for (const [tab, url] of [['Composer', '/composer'], ['Pratiquer', '/pratiquer'], ['Live', '/scene'], ['Accueil', '/']] as const) {
    await page.getByRole('link', { name: tab }).click();
    await expect(page).toHaveURL(new RegExp(`#${url}$`));
    await expect(page.getByRole('link', { name: tab })).toHaveAttribute('aria-current', 'page');
  }
});

test('screens that need the microphone explain when it is refused', async ({ page }) => {
  await page.goto('#/accordeur');
  await expect(page.locator('.mic-msg')).toHaveText(/Micro (refusé|indisponible)/);
  await page.goto('#/voix');
  await expect(page.locator('.mic-banner')).toContainText(/Micro (refusé|indisponible)/);
});
