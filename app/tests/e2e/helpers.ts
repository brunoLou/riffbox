import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test as base, expect, type Page } from '@playwright/test';

/** Every test fails if the page throws or logs an error. */
export const test = base.extend<{ errors: string[] }>({
  errors: [async ({ page }, use) => {
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await use(errors);
    expect(errors, 'errors in the page').toEqual([]);
  }, { auto: true }],
});
export { expect };

/* ---------- Fake microphone: generated WAV files ---------- */

const DIR = join(tmpdir(), 'riffbox-tests');
const SR = 48000;

function writeWav(name: string, secs: number, sample: (t: number) => number): string {
  mkdirSync(DIR, { recursive: true });
  const n = secs * SR;
  const buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write('WAVE', 8);
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
  buf.write('data', 36); buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, sample(i / SR))) * 32767), 44 + i * 2);
  const path = join(DIR, name + '.wav');
  writeFileSync(path, buf);
  return path;
}

/** A plucked guitar string, re-plucked every 3 s. `cents` detunes it. */
export function guitarString(name: string, hz: number, cents = 0): string {
  const f = hz * 2 ** (cents / 1200);
  return writeWav(name, 12, t => {
    const env = Math.exp(-(t % 3) * 0.6);
    let v = 0;
    for (let k = 1; k <= 5; k++) v += (0.6 / k) * Math.sin(2 * Math.PI * f * k * t);
    return v * env * 0.5;
  });
}

/** A steady sung note. */
export function sungNote(name: string, hz: number, cents = 0): string {
  const f = hz * 2 ** (cents / 1200);
  return writeWav(name, 40, t => {
    let v = 0;
    for (let k = 1; k <= 4; k++) v += (0.5 / k) * Math.sin(2 * Math.PI * f * k * t);
    return v * 0.45;
  });
}

/**
 * A guitar strumming a chord sequence: each chord (MIDI notes, low to high) lasts `secs`, strummed
 * at its start and again halfway, strings 15 ms apart, with harmonics and a natural decay.
 */
export function strummedChords(name: string, chords: number[][], secs = 1.6, pick = false): string {
  const freqs = chords.map(c => c.map(m => 440 * 2 ** ((m - 69) / 12)));
  // A pick's attack: a short burst of noise on each string, as a real strum has (optional).
  const noise = (t: number) => (Math.sin(t * 91234.567) * 43758.5453) % 1;
  return writeWav(name, Math.ceil(chords.length * secs) + 1, t => {
    const i = Math.min(chords.length - 1, Math.floor(t / secs));
    const local = t - i * secs;
    const since = local % (secs / 2);
    let v = 0;
    freqs[i].forEach((f, s) => {
      const dt = since - s * 0.015;
      if (dt < 0) return;
      for (let k = 1; k <= 6; k++) v += (1 / k ** 1.3) * Math.exp(-dt * (1.2 + k * 0.4)) * Math.sin(2 * Math.PI * f * k * dt);
      if (pick && dt < 0.008) v += noise(t + s) * 1.5 * (1 - dt / 0.008);
    });
    return v * 0.12;
  });
}

/** Launch options for a test file whose microphone plays `wav`. */
export const fakeMic = (wav: string) => ({
  permissions: ['microphone'],
  launchOptions: { args: ['--autoplay-policy=no-user-gesture-required', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-audio-capture=${wav}`] },
});

/* ---------- Small helpers ---------- */

/** A button whose accessible name is exactly `name`. */
export const button = (page: Page, name: string | RegExp) => page.getByRole('button', { name, exact: typeof name === 'string' });
export const texts = (page: Page, selector: string) => page.locator(selector).allTextContents();

/* ---------- Audio files ---------- */

/** Reads a ZIP or WAV file in Python (its own zipfile / RIFF parsing), independently of the app. */
export const inspectAudio = (file: string) => JSON.parse(execFileSync('python3', ['-c', `
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
            rate = out['fmt'][2]
            out['frames'] = len(s)
            out['seconds'] = round(len(s) / rate, 2)
            mid = s[len(s)//4: len(s)//4 + rate // 2]
            out['peak'] = max(abs(x) for x in s) / 8388608
            out['crossings_per_s'] = sum(1 for a, c in zip(mid, mid[1:]) if a < 0 <= c) * 2
        i += 8 + size + (size & 1)
    return out
p = sys.argv[1]
if p.endswith('.zip'):
    z = zipfile.ZipFile(p); assert z.testzip() is None
    csv = [n for n in z.namelist() if n.endswith('index.csv')]
    print(json.dumps({'names': z.namelist(), 'csv': z.read(csv[0]).decode('utf-8-sig') if csv else None,
      'wavs': {n: wav_info(z.read(n)) for n in z.namelist() if n.endswith('.wav')}}))
else:
    print(json.dumps(wav_info(open(p, 'rb').read())))
`, file]).toString());
