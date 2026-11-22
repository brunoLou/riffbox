import { execFileSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { button, expect, fakeMic, guitarString, test } from './helpers';

test.use(fakeMic(guitarString('export-mic', 196)));

/** Reads a ZIP or WAV file in Python (its own zipfile / RIFF parsing), independently of the app. */
const inspect = (file: string) => JSON.parse(execFileSync('python3', ['-c', `
import json, struct, sys, zipfile, io
def wav_info(b):
    assert b[:4] == b'RIFF' and b[8:12] == b'WAVE'
    assert struct.unpack('<I', b[4:8])[0] == len(b) - 8
    i, out = 12, {}
    while i < len(b):
        cid, size = b[i:i+4].decode('latin1'), struct.unpack('<I', b[i+4:i+8])[0]
        body = b[i+8:i+8+size]
        if cid == 'fmt ': out['fmt'] = struct.unpack('<HHIIHH', body[:16])
        if cid == 'acid': f, root, _, _, beats, den, num, tempo = struct.unpack('<IHHfIHHf', body); out['acid'] = [f, root, beats, num, den, round(tempo, 2)]
        if cid == 'LIST': n = struct.unpack('<I', body[8:12])[0]; out['info'] = body[12:12+n].rstrip(b'\\0').decode()
        if cid == 'data':
            s = [int.from_bytes(body[k:k+3], 'little', signed=True) for k in range(0, len(body) - 2, 3)]
            out['seconds'] = round(len(s) / 48000, 2)
            mid = s[len(s)//4: len(s)//4 + 24000]
            out['peak'] = max(abs(x) for x in s) / 8388608
            out['crossings_per_s'] = sum(1 for a, c in zip(mid, mid[1:]) if a < 0 <= c) * 2
        i += 8 + size + (size & 1)
    return out
p = sys.argv[1]
if p.endswith('.zip'):
    z = zipfile.ZipFile(p); assert z.testzip() is None
    print(json.dumps({'names': z.namelist(), 'csv': z.read([n for n in z.namelist() if n.endswith('index.csv')][0]).decode('utf-8-sig'),
      'wavs': {n: wav_info(z.read(n)) for n in z.namelist() if n.endswith('.wav')}}))
else:
    print(json.dumps(wav_info(open(p, 'rb').read())))
`, file]).toString());

test('every recording exported as 24-bit 48 kHz WAV for a music program, tempo and key inside', async ({ page }) => {
  // A real recording through the (fake) microphone: a G string at 196 Hz.
  await page.goto('#/composer');
  await page.locator('.rec-cta').click();
  await expect(page.locator('.rec-time')).toHaveText(/0:0[2-9]/, { timeout: 8000 });
  await page.getByText('■ Arrêter et ranger').click();
  const sheet = page.getByRole('dialog', { name: 'Nommer l’idée' });
  await sheet.locator('.text-input').fill('Solo: en Sol');
  await sheet.getByRole('button', { name: 'Riff', exact: true }).click();
  await sheet.getByLabel('Tonalité').selectOption({ label: 'Sol' });
  await sheet.getByRole('button', { name: 'Enregistrer', exact: true }).click();
  await expect(page.locator('.idea-title', { hasText: 'Solo: en Sol' })).toBeVisible();
  // Its tempo, as set by tap tempo.
  await page.evaluate(() => {
    const k = 'riffbox:v1:ideas';
    const ideas = JSON.parse(localStorage.getItem(k)!);
    ideas.find((i: { title: string }) => i.title === 'Solo: en Sol').bpm = 96;
    localStorage.setItem(k, JSON.stringify(ideas));
  });
  await page.reload();

  // One WAV from the notebook.
  const open = page.locator('.idea', { hasText: 'Solo: en Sol' }).locator('.idea-open');
  if ((await open.getAttribute('aria-expanded')) !== 'true') await open.click();
  const one = page.waitForEvent('download');
  await button(page, 'Exporter « Solo: en Sol » en WAV').click();
  const d1 = await one;
  expect(d1.suggestedFilename()).toMatch(/^\d{4}-\d\d-\d\d Solo en Sol - 96 BPM - Sol\.wav$/);
  const dir = mkdtempSync(join(tmpdir(), 'riffbox-daw-'));
  await d1.saveAs(join(dir, 'one.wav'));
  const w = inspect(join(dir, 'one.wav'));
  expect(w.fmt).toEqual([1, 1, 48000, 144000, 3, 24]); // PCM, mono, 48 kHz, 24-bit
  expect(w.acid).toEqual([2, 67, Math.round((w.seconds * 96) / 60), 4, 4, 96]); // root G, 4/4, 96 BPM
  expect(w.info).toBe('Solo: en Sol');
  expect(w.seconds).toBeGreaterThan(1.5);
  expect(w.peak).toBeGreaterThan(0.01); // raw sound, not silence
  expect(Math.abs(w.crossings_per_s - 196)).toBeLessThan(15); // still the G string

  // Everything at once, from the settings.
  await page.goto('#/reglages');
  const exportBtn = page.getByRole('button', { name: 'Exporter 1 enregistrement (.zip)' });
  const all = page.waitForEvent('download');
  await exportBtn.click();
  const d2 = await all;
  expect(d2.suggestedFilename()).toMatch(/^riffbox-enregistrements-\d{4}-\d\d-\d\d\.zip$/);
  await d2.saveAs(join(dir, 'all.zip'));
  await expect(page.locator('.backup-msg')).toContainText('1 enregistrement téléchargé en WAV');
  const z = inspect(join(dir, 'all.zip'));
  const root = z.names[0].split('/')[0];
  expect(root).toMatch(/^RIFFBOX \d{4}-\d\d-\d\d$/);
  expect(z.names.map((n: string) => n.slice(root.length + 1)).sort()).toEqual(['Carnet/' + d1.suggestedFilename(), 'LISEZMOI.txt', 'index.csv'].sort());
  expect(Object.values(z.wavs)[0]).toEqual(w);
  expect(z.csv.split('\r\n')[0]).toBe('Fichier;Titre;Type;Date;Durée (s);Tempo (BPM);Tonalité;Style;Humeur');
  expect(z.csv).toContain(';Solo: en Sol;Riff;');
  expect(z.csv).toContain(';96;Sol majeur;');
});

test('nothing to export: the button says so', async ({ page }) => {
  await page.goto('#/reglages');
  await expect(page.getByRole('button', { name: 'Aucun enregistrement à exporter' })).toBeDisabled();
});
