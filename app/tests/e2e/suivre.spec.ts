import { chordType, voicingMidi, voicings } from '../../src/lib/chords';
import { followEvents } from '../../src/lib/chordFollow';
import { SONG } from '../../src/lib/data';
import { parseChordPro } from '../../src/lib/music';
import { button, expect, fakeMic, strummedChords, test } from './helpers';

// The microphone plays the chord changes of « Minuit Shuffle », as written, from the start.
const notes = (name: string) => {
  const root = { A: 9, D: 2, E: 4, 'F#': 6 }[name.replace(/m|7/g, '')]!;
  return voicingMidi(voicings(root, chordType(name.endsWith('7') ? '7' : name.endsWith('m') ? 'm' : 'maj'))[0]);
};
const changes = followEvents(parseChordPro(SONG, 0)).map(e => e.chord).filter((c, i, a) => i === 0 || c !== a[i - 1]).slice(0, 14);
test.use(fakeMic(strummedChords('minuit-changes', changes.map(notes))));

test('« Suivre ma guitare »: the chord played lights up and the lyrics follow', async ({ page }) => {
  await page.goto('#/scene/bar-du-port/play/2');
  const follow = button(page, 'Suivre ma guitare');
  await follow.click();
  await expect(follow).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.follow-status')).toContainText('Entendu', { timeout: 8000 });

  // It moves through the song: the lit chord leaves the first line and the text scrolls.
  await expect.poll(async () => Number(await page.locator('.lyric-seg.now').evaluate(el => el.closest('[data-line]')!.getAttribute('data-line'))), { timeout: 20_000 })
    .toBeGreaterThanOrEqual(6);
  expect(await page.locator('.lyrics').evaluate(el => el.scrollTop)).toBeGreaterThan(50);
  await expect(page.locator('.lyric-seg.next')).toHaveCount(1);
  // Never ahead of the music: the lit chord is one the microphone is playing.
  expect(changes).toContain((await page.locator('.lyric-seg.now .lyric-chord').textContent())!.trim());
});

test('auto-scroll and following exclude each other; a song without chords cannot be followed', async ({ page }) => {
  await page.goto('#/scene/bar-du-port/play/2');
  await button(page, 'Suivre ma guitare').click();
  await button(page, 'LECTURE').click();
  await expect(button(page, 'Suivre ma guitare')).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('.follow-status')).toHaveCount(0);
  await button(page, 'Suivre ma guitare').click();
  await expect(button(page, 'LECTURE')).toBeVisible();

  // The choice is kept for the next song; one without chords cannot be followed.
  await page.goto('#/scene/bar-du-port/play/3');
  await expect(button(page, 'Suivre ma guitare')).toBeDisabled();
});
