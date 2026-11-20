import { button, expect, test } from './helpers';

test('the pedal light reacts to pedal keys only, and stays detected from song to song', async ({ page }) => {
  await page.goto('#/scene/bar-du-port/play/2');
  const pedal = page.locator('.stage-pedal');
  await expect(pedal).toHaveText('Pédalier : appuyez');
  await expect(pedal).not.toHaveClass(/seen/);

  // On-screen buttons and other keys are not the pedal.
  await button(page, 'Suivant ›').click();
  await page.keyboard.press('a');
  await expect(pedal).toHaveText('Pédalier : appuyez');

  await page.keyboard.press('PageDown');
  await expect(pedal).toHaveText('Pédalier détecté');
  await expect(pedal).toHaveClass(/seen/);
  await expect(pedal).toHaveClass(/flash/);
  await expect(pedal).not.toHaveClass(/flash/); // the blink is brief

  // Next song (the prompteur remounts): still detected.
  for (let i = 0; i < 8 && (await page.locator('.stage-title').textContent()) === 'MINUIT SHUFFLE'; i++) {
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(600);
  }
  await expect(page.locator('.stage-title')).toHaveText('ROUILLE ET CHROME');
  await expect(pedal).toHaveText('Pédalier détecté');
});

/** Fake Screen Wake Lock that records what the page does with it. */
function fakeWakeLock() {
  const w = window as unknown as { wl: { requests: number; held: number; sentinels: EventTarget[] } };
  w.wl = { requests: 0, held: 0, sentinels: [] };
  Object.defineProperty(navigator, 'wakeLock', {
    configurable: true,
    value: {
      request: async () => {
        w.wl.requests++; w.wl.held++;
        const s = new EventTarget() as EventTarget & { released: boolean; release: () => Promise<void> };
        s.released = false;
        s.release = async () => {
          if (s.released) return;
          s.released = true; w.wl.held--;
          s.dispatchEvent(new Event('release'));
        };
        w.wl.sentinels.push(s);
        return s;
      },
    },
  });
}

test('keeps the screen awake on stage, takes the lock back after the page was hidden, lets go on leaving', async ({ page }) => {
  await page.addInitScript(fakeWakeLock);
  const wl = () => page.evaluate(() => (window as unknown as { wl: { requests: number; held: number } }).wl);
  await page.goto('#/scene/bar-du-port/play/2');
  await expect(page.locator('.stage-head')).toHaveAttribute('data-wakelock', 'on');
  await expect(page.locator('.stage-sleep')).toHaveCount(0);
  expect(await wl()).toMatchObject({ requests: 1, held: 1 });

  // Hiding the page makes the browser drop the lock; coming back takes it again.
  await page.evaluate(async () => {
    const w = window as unknown as { wl: { sentinels: { release: () => Promise<void> }[] } };
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    await w.wl.sentinels.at(-1)!.release();
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(page.locator('.stage-head')).toHaveAttribute('data-wakelock', 'off');
  await expect(page.locator('.stage-sleep')).toBeVisible();
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(page.locator('.stage-head')).toHaveAttribute('data-wakelock', 'on');
  expect((await wl()).held).toBe(1);

  // Changing song keeps exactly one lock; leaving the stage releases it.
  await page.goto('#/scene/bar-du-port/play/3');
  await expect(page.locator('.stage-head')).toHaveAttribute('data-wakelock', 'on');
  expect((await wl()).held).toBe(1);
  await page.locator('.stage-back').click();
  await expect(page.locator('.stage-head')).toHaveCount(0);
  await expect.poll(async () => (await wl()).held).toBe(0);
});

test('without wake lock support, the stage warns that the screen may sleep', async ({ page }) => {
  await page.addInitScript(() => { delete (Navigator.prototype as { wakeLock?: unknown }).wakeLock; });
  await page.goto('#/scene/bar-du-port/play/2');
  await expect(page.locator('.stage-head')).toHaveAttribute('data-wakelock', 'unsupported');
  await expect(page.locator('.stage-sleep')).toHaveText('Veille possible');
});

test('Réglages: learn a key for a pedal, try it, and use it on stage', async ({ page }) => {
  await page.goto('#/reglages');
  const right = page.locator('[data-pedal="right"]');
  const left = page.locator('[data-pedal="left"]');
  await expect(right.locator('.pedal-key')).toHaveText(['→×', '↓×', 'Page ↓×']);

  // Try: an assigned key lights the pedal, another key says it is not assigned.
  await page.keyboard.press('PageDown');
  await expect(page.locator('.pedal-try')).toHaveText('Pédale droite · Page ↓');
  await page.keyboard.press('Enter');
  await expect(page.locator('.pedal-try')).toHaveText('Entrée : non attribuée');

  // Learn Enter on the right pedal; Escape cancels a learning.
  await right.getByRole('button', { name: 'Apprendre' }).click();
  await expect(right.locator('.pedal-wait')).toBeVisible();
  await page.keyboard.press('Shift'); // modifiers are not pedals: still waiting
  await expect(right.locator('.pedal-wait')).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page.locator('.pedal-msg')).toHaveText('Entrée → Pédale droite');
  await expect(right.locator('.pedal-key').last()).toHaveText('Entrée×');
  await left.getByRole('button', { name: 'Apprendre' }).click();
  await page.keyboard.press('Escape');
  await expect(left.locator('.pedal-wait')).toHaveCount(0);

  // A reversed pedal: learning → for the left pedal takes it away from the right one.
  await left.getByRole('button', { name: 'Apprendre' }).click();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('.pedal-msg')).toHaveText('→ → Pédale gauche (retirée de la pédale droite)');
  await expect(right.locator('.pedal-key')).toHaveText(['↓×', 'Page ↓×', 'Entrée×']);
  await right.getByLabel('Retirer ↓ de la pédale droite').click();
  await expect(right.locator('.pedal-key')).toHaveText(['Page ↓×', 'Entrée×']);

  // On stage, Enter now turns the page and → goes back.
  await page.goto('#/scene/bar-du-port/play/2');
  await expect(page.locator('.lyric-line').first()).toBeVisible();
  const top = () => page.locator('.lyrics').evaluate(e => e.scrollTop);
  await page.keyboard.press('Enter');
  await expect.poll(top).toBeGreaterThan(100);
  await page.keyboard.press('ArrowRight');
  await expect.poll(top).toBe(0);
  await expect(page.locator('.stage-pedal')).toHaveText('Pédalier détecté');

  // Back to the defaults.
  await page.goto('#/reglages');
  await button(page, 'Touches par défaut').click();
  await expect(right.locator('.pedal-key')).toHaveText(['→×', '↓×', 'Page ↓×']);
  await expect(button(page, 'Touches par défaut')).toBeDisabled();
});

test('metronome: right pedal starts and stops, left pedal taps the tempo', async ({ page }) => {
  await page.clock.install();
  await page.goto('#/metronome');
  await expect(page.locator('.cta')).toBeVisible();
  await page.clock.pauseAt(Date.now() + 1000);
  for (let i = 0; i < 4; i++) { await page.keyboard.press('ArrowLeft'); await page.clock.runFor(500); }
  await expect(page.locator('.cta')).toHaveText(/120 BPM/);
  await page.keyboard.press('PageDown');
  await expect(page.locator('.cta')).toHaveText('Arrêter');
  await page.keyboard.press(' ');
  await expect(page.locator('.cta')).toHaveText(/Lecture/);
});

test('grid: the pedal loops and moves to the next section', async ({ page }) => {
  await page.goto('#/composer/grille/g-minuit');
  const sections = page.locator('.seg button');
  await expect(sections.nth(0)).toHaveClass(/on/);
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('.grid-loop')).toHaveText(/Arrêter · couplet/);
  await page.keyboard.press('ArrowLeft');
  await expect(sections.nth(1)).toHaveClass(/on/);
  await expect(page.locator('.grid-loop')).toHaveText(/Arrêter · refrain/);
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('.grid-loop')).toHaveText(/Boucle/);
});

test('backing track: the pedal plays the first track, pauses, and starts again from bar 1', async ({ page }) => {
  await page.goto('#/pratiquer/backing');
  await expect(page.locator('.track').first()).toBeVisible();
  await page.keyboard.press('PageDown');
  await expect(page.locator('.player-toggle')).toHaveText('PAUSE');
  await expect(page.locator('.player-next .mono')).toHaveText(/Mesure 2\//, { timeout: 6000 });
  await page.keyboard.press('PageUp');
  await expect(page.locator('.player-next .mono')).toHaveText(/Mesure 1\//);
  await page.keyboard.press('PageDown');
  await expect(page.locator('.player-toggle')).toHaveText('LECTURE');
});

test('routine: the pedal moves to the next step and starts the timer', async ({ page }) => {
  await page.goto('#/pratiquer/routine');
  await expect(page.locator('.display').first()).toHaveText('ÉTAPE 3/4');
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('.display').first()).toHaveText('ÉTAPE 4/4');
  await page.keyboard.press('ArrowLeft');
  await expect(button(page, 'PAUSE')).toBeVisible();
  await page.keyboard.press('ArrowLeft');
  await expect(button(page, 'GO')).toBeVisible();
});

test('typing in a field never drives the pedal', async ({ page }) => {
  await page.goto('#/metronome');
  await expect(page.locator('.cta')).toBeVisible();
  // A text field on a screen that listens to the pedal.
  await page.evaluate(() => { const i = document.createElement('input'); i.id = 'f'; document.querySelector('.screen-body')!.prepend(i); });
  await page.locator('#f').click();
  await page.keyboard.type('a b');
  await page.keyboard.press('PageDown');
  await expect(page.locator('#f')).toHaveValue('a b');
  await expect(page.locator('.cta')).toHaveText(/Lecture/);
  // Outside the field, the same key starts the metronome.
  await page.locator('.metro-sig').click();
  await page.keyboard.press('PageDown');
  await expect(page.locator('.cta')).toHaveText('Arrêter');
});
