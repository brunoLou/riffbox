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

/** Launch options for a test file whose microphone plays `wav`. */
export const fakeMic = (wav: string) => ({
  permissions: ['microphone'],
  launchOptions: { args: ['--autoplay-policy=no-user-gesture-required', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-audio-capture=${wav}`] },
});

/* ---------- Small helpers ---------- */

/** A button whose accessible name is exactly `name`. */
export const button = (page: Page, name: string | RegExp) => page.getByRole('button', { name, exact: typeof name === 'string' });
export const texts = (page: Page, selector: string) => page.locator(selector).allTextContents();
