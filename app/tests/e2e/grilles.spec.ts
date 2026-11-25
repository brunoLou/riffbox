import { button, expect, test, texts } from './helpers';

const wheel = (page: import('@playwright/test').Page, name: string) =>
  page.locator('.wheel-chord', { has: page.locator('.wc-name', { hasText: new RegExp('^' + name + '$') }) });

test('the loop plays the section and lights the chord being played', async ({ page }) => {
  await page.goto('#/composer/grille/g-minuit');
  await expect(page.locator('.grid-kicker')).toHaveText('92 BPM · Shuffle ▾');
  await page.getByText('▶  Boucle · 92 BPM').click();
  await expect(page.locator('.slot.on .slot-name')).toHaveText('A');
  await expect(page.locator('.slot.on .slot-name')).toHaveText('D', { timeout: 6000 }); // next bar (2.6 s at 92 BPM)
  await page.locator('.seg button', { hasText: 'Refrain' }).click();
  await expect(page.locator('.grid-loop')).toHaveText('Arrêter · refrain');
  await page.locator('.grid-loop').click();
  await expect(page.locator('.slot.on')).toHaveCount(0);
});

test('edits chords, key, name, tempo and groove', async ({ page }) => {
  await page.goto('#/composer/grille/g-minuit');
  await page.locator('.seg button', { hasText: 'Pont' }).click();
  await wheel(page, 'C#m').click();
  expect((await texts(page, '.slot-name')).pop()).toBe('C#m');
  await page.getByLabel('Monter d’un demi-ton').click();
  await expect(page.locator('.hub-key')).toHaveText('Si♭');
  await page.locator('.grid-head').click();
  await page.getByLabel('Nom', { exact: true }).fill('Minuit v2');
  await page.getByLabel('Accélérer').click();
  await page.locator('.set-sheet .seg button', { hasText: 'Rock' }).click();
  await expect(page.locator('.riff-title')).toHaveText('Riff shuffle en La');
  await page.getByLabel('Fermer').click();
  await expect(page.locator('.grid-kicker')).toHaveText('94 BPM · Rock ▾');
  await expect(page.locator('.grid-title')).toHaveText('MINUIT V2');
});

test('a riff becomes a grid, the grid joins a setlist and shows on stage, deleting it cleans up', async ({ page }) => {
  await page.goto('#/composer');
  await page.locator('.idea', { hasText: 'Funk en Mi m' }).locator('.idea-top').click();
  await page.getByText('Ajouter à une grille ›').click();
  await page.getByText('Nouvelle grille avec ce riff').click();
  await expect(page.locator('.grid-kicker')).toHaveText('104 BPM · Funk ▾');
  await expect(page.locator('.hub-key')).toHaveText('Sol');
  await expect(page.locator('.slot-name')).toHaveText(['Em']);
  for (const n of ['Am', 'Bm', 'C']) await wheel(page, n).click();
  await expect(page.locator('.slot-name')).toHaveText(['Em', 'Am', 'Bm', 'C']);

  await page.getByText('Setlist +').click();
  await page.locator('.set-sheet .pick-row', { hasText: 'Bar du Port' }).click();
  await expect(page).toHaveURL(/#\/scene\/bar-du-port$/);
  await expect(page.locator('.song-row').last()).toContainText('Funk en Mi m, 16e');
  await page.locator('.song-row').last().click();
  await expect(page.locator('.stage-title')).toHaveText('FUNK EN MI M, 16E');
  await expect(page.locator('.lyric-line.chords-only')).toHaveCount(1);

  await page.goto('#/composer/grilles');
  await page.locator('.idea', { hasText: 'Funk en Mi m' }).first().locator('.idea-top').click();
  await page.getByText('Ouvrir la grille ›').click();
  await page.locator('.grid-head').click();
  await page.getByText('Supprimer la grille…').click();
  await page.locator('.btn-danger').click();
  await expect(page).toHaveURL(/#\/composer\/grilles$/);
  await page.goto('#/scene/bar-du-port');
  await expect(page.locator('.song-row')).toHaveCount(9);
});

test('a catalog song without lyrics shows its grid on stage, flats kept', async ({ page }) => {
  await page.goto('#/scene/bar-du-port/play/1');
  await expect(page.locator('.stage-title')).toHaveText('CAFÉ NOIR');
  await expect(page.locator('.lyric-line').nth(1)).toContainText('Bb');
});

test('the Grilles tile filters the notebook for this visit only', async ({ page }) => {
  await page.goto('#/');
  await page.locator('[data-tile="grilles"]').click();
  await expect(page.locator('.kind-chip.on-cream')).toHaveText('Grilles');
  await page.getByRole('link', { name: 'Accueil' }).click();
  await page.getByRole('link', { name: 'Composer' }).click();
  await expect(page.locator('.kind-chip.on-cream')).toHaveText('Tout');
});

test('touching a chord of the grid shows its diagram, other positions, and the library', async ({ page }) => {
  await page.goto('#/composer/grille/g-minuit');
  await page.getByLabel('Accord D : diagramme').click();
  const sheet = page.getByRole('dialog', { name: 'Accord D' });
  await expect(sheet.locator('.sheet-kicker')).toHaveText('Couplet · accord 2/4');
  await expect(sheet.locator('.cs-sub')).toHaveText('Ré majeur · degré IV en La');
  await expect(sheet.locator('.cs-pos')).toHaveText('Forme de Ré · position ouverte · 1/5');
  await expect(sheet.locator('.cd-label')).toHaveText(['A', 'D', 'F♯']); // notes on the dots

  // Step through the section's chords.
  await sheet.getByLabel('Accord suivant').click();
  await expect(page.getByRole('dialog', { name: 'Accord A' }).locator('.sheet-kicker')).toHaveText('Couplet · accord 3/4');
  await page.getByLabel('Accord précédent').click();

  // Another position, remembered for this chord everywhere.
  await sheet.getByLabel('Position suivante').click();
  await expect(sheet.locator('.cs-pos')).toHaveText(/^Forme de .* · case \d+ · 2\/5$/);
  const pos2 = await sheet.locator('.cs-pos').textContent();
  await sheet.getByLabel('Fermer').click();
  await page.reload();
  await page.getByLabel('Accord D : diagramme').click();
  await expect(sheet.locator('.cs-pos')).toHaveText(pos2!);

  // The library opens on the same chord and position.
  await button(page, 'Bibliothèque ›').click();
  await expect(page).toHaveURL(/#\/pratiquer\/accords$/);
  await expect(page.locator('.shape-label')).toHaveText(/· 2\/5$/);
  await expect(page.locator('.chord-sym')).toHaveText('D');
});

test('a minor chord outside the key, and removing a chord from the sheet', async ({ page }) => {
  await page.goto('#/composer/grille/g-minuit');
  await page.locator('.seg button', { hasText: 'Pont' }).click();
  await wheel(page, 'C#m').click();
  await page.getByLabel('Accord C#m : diagramme').click();
  await expect(page.locator('.cs-sub')).toHaveText('Do♯ mineur · degré iii en La');
  await page.getByLabel('Accord précédent').click();
  await button(page, /^Retirer .* de la grille$/).click();
  // The sheet moves to the chord that took its place.
  await expect(page.locator('.chord-sheet .cs-name')).toHaveText('C#m');
  expect(await texts(page, '.slot-name')).toHaveLength(4);
  await button(page, 'Retirer C#m de la grille').click();
  await expect(page.locator('.slot-name')).toHaveCount(3);
});

test('ideas for what comes next: heard in context, added in one tap, cadences, a full section', async ({ page }) => {
  await page.goto('#/composer/grille/g-minuit'); // Couplet: A D A E, in La
  const slots = page.locator('.slots .slot-name');
  await expect(page.locator('.suggest-kicker')).toHaveText('Après E');
  await expect(page.locator('.sug-name').first()).toHaveText('A');
  await expect(page.locator('.sug-why').nth(1)).toHaveText('cadence trompeuse');

  // Heard after the two chords before it, then stopped.
  await button(page, 'Écouter A, E, A').click();
  await expect(page.locator('.sug.playing')).toHaveCount(1);
  await button(page, 'Arrêter l’écoute').click();
  await expect(page.locator('.sug.playing')).toHaveCount(0);

  await page.getByRole('button', { name: /^Ajouter A : retour/ }).click();
  await expect(slots).toHaveText(['A', 'D', 'A', 'E', 'A']);
  await expect(page.locator('.suggest-kicker')).toHaveText('Après A');

  // A colour: the ♭VII, shown with its degree.
  await button(page, 'Couleurs').click();
  await page.locator('.sug-add', { hasText: '♭VII' }).click();
  await expect(slots.last()).toHaveText('G');
  await expect(page.locator('.slot-deg').last()).toHaveText('♭VII');

  // A cadence adds two chords; then the section is full.
  await button(page, 'Pour finir').click();
  await page.locator('.sug-add', { hasText: 'V7 → I' }).click();
  await expect(slots).toHaveText(['A', 'D', 'A', 'E', 'A', 'G', 'E7', 'A']);
  await expect(page.locator('.suggest-full')).toBeVisible();

  // The seventh shows its own diagram.
  await page.locator('.slot', { hasText: 'E7' }).click();
  await expect(page.locator('.cs-sub')).toHaveText('Mi septième · V7 en La');
});

test('a grid generated from a style, a key and a structure; « Une autre » keeps the locked chords', async ({ page }) => {
  await page.goto('#/composer');
  await page.getByText('+ Grille').click();
  const sheet = page.getByRole('dialog', { name: 'Nouvelle grille' });
  await sheet.getByRole('button', { name: 'Rock' }).click();
  await sheet.getByLabel('Tonalité').selectOption({ label: 'Mi (relatif Do♯ m)' });
  await sheet.getByRole('button', { name: '8', exact: true }).click();
  await sheet.getByLabel('Avec un pont').uncheck();
  await button(page, 'Générer la grille').click();

  await expect(page).toHaveURL(/#\/composer\/grille\/grid\d+$/);
  await expect(page.locator('.grid-title')).toHaveText('ROCK EN MI');
  await expect(page.locator('.hub-key')).toHaveText('Mi');
  await expect(page.locator('.slots .slot')).toHaveCount(8);
  await expect(page.locator('.seg button', { hasText: 'Pont' })).toHaveText('Pont ·'); // no bridge
  await page.locator('.seg button', { hasText: 'Refrain' }).click();
  await expect(page.locator('.slots .slot')).toHaveCount(8);
  await page.locator('.seg button', { hasText: 'Couplet' }).click();

  // Lock the first chord, then make the verse again: it stays, the section changes.
  const first = await page.locator('.slot-name').first().textContent();
  await page.locator('.slot').first().click();
  await button(page, 'Garder cet accord si je régénère').click();
  await page.getByLabel('Fermer').click();
  await expect(page.locator('.slot').first().locator('.slot-lock')).toBeVisible();
  await expect(page.locator('.regen-hint')).toHaveText('Rock · 1 gardé');
  const before = await page.locator('.slot-name').allTextContents();
  let changed = false;
  for (let k = 0; k < 4 && !changed; k++) {
    await page.locator('.regen-btn').click();
    changed = (await page.locator('.slot-name').allTextContents()).join() !== before.join();
  }
  expect(changed).toBe(true);
  await expect(page.locator('.slot-name').first()).toHaveText(first!);

  // The choices are remembered; « Grille vide » still makes an empty one.
  await page.goto('#/composer');
  await page.getByText('+ Grille').click();
  await expect(page.getByRole('dialog', { name: 'Nouvelle grille' }).getByRole('button', { name: 'Rock' })).toHaveAttribute('aria-pressed', 'true');
  await button(page, 'Grille vide').click();
  await expect(page.locator('.slots-empty')).toBeVisible();
  await expect(page.locator('.regen-row')).toHaveCount(0);
});

test('a generated grid in the key of my voice, once the range is measured', async ({ page }) => {
  await page.goto('#/composer');
  await page.getByText('+ Grille').click();
  let sheet = page.getByRole('dialog', { name: 'Nouvelle grille' });
  // Not measured yet: the choice is offered but not available, with a way to measure.
  await expect(sheet.getByLabel('Tonalité').locator('option[value="voice"]')).toHaveJSProperty('disabled', true);
  await expect(sheet.getByLabel('Tonalité')).toHaveValue('random');
  await expect(sheet.getByRole('button', { name: /Mesurer ma tessiture/ })).toBeVisible();

  // A measured baritone range, La1 – Fa♯3.
  await page.evaluate(() => localStorage.setItem('riffbox:v1:voice.range', JSON.stringify({ low: 45, high: 66, measured: true })));
  await page.reload();
  await page.getByText('+ Grille').click();
  sheet = page.getByRole('dialog', { name: 'Nouvelle grille' });
  await sheet.getByRole('button', { name: 'Folk' }).click();
  await expect(sheet.getByLabel('Tonalité')).toHaveValue('voice');
  await expect(sheet.locator('.ng-voice')).toContainText('dans votre tessiture (La1 – Fa♯3)');
  const key = (await sheet.locator('.ng-voice b').textContent())!.trim();
  await button(page, 'Générer la grille').click();
  await expect(page.locator('.hub-key')).toHaveText(key);
  await expect(page.locator('.grid-title')).toHaveText(`FOLK EN ${key.toUpperCase()}`);
});

test('while the grid loops, the diagram of the chord being played follows the bars, with the next one', async ({ page }) => {
  await page.goto('#/composer/grille/g-minuit'); // Couplet: A D A E
  await expect(page.locator('.live-chords')).toHaveCount(0);
  await page.getByRole('button', { name: /Boucle/ }).click();
  const live = page.locator('.live-chords');
  await expect(live).toBeVisible();
  // Always the chord lit in the grid, and the one after it.
  const seen = new Set<string>();
  for (let k = 0; k < 30 && seen.size < 3; k++) { // a bar lasts 2.6 s at 92 BPM
    // Everything read at the same instant (a bar can change between two separate reads).
    const snap = await page.evaluate(() => ({
      on: document.querySelector('.slot.on .slot-name')?.textContent?.trim(),
      shown: document.querySelector('.live-now .live-name')?.textContent?.trim(),
      kicker: document.querySelector('.live-now .live-kicker')?.textContent ?? '',
      next: document.querySelector('.live-next .live-name')?.textContent?.trim(),
    }));
    if (snap.on && snap.on === snap.shown) {
      seen.add(snap.shown!);
      const order = ['A', 'D', 'A', 'E'];
      const bar = Number(snap.kicker.match(/(\d)\/4/)![1]);
      expect(order[bar - 1]).toBe(snap.shown);
      expect(snap.next).toBe(order[bar % 4]);
    }
    await page.waitForTimeout(500);
  }
  expect([...seen].sort()).toEqual(['A', 'D', 'E']);
  await expect(live.locator('.live-now .chord-svg')).toBeVisible();
  await expect(live.locator('.live-next .chord-svg')).toBeVisible();

  await page.getByRole('button', { name: /Arrêter/ }).click();
  await expect(page.locator('.live-chords')).toHaveCount(0);
});
