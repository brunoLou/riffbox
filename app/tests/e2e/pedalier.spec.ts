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
