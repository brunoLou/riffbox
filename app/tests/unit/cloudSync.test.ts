import { beforeEach, describe, expect, it } from 'vitest';
import '../../src/lib/ideas';
import { referencedAudio, syncOnce, type LocalAudio, type SyncRemote } from '../../src/lib/cloudSync';
import { clearAllStored, readStored, withoutWriteHooks, writeStored } from '../../src/lib/store';
import { installSync } from '../../src/lib/sync';
import { INITIAL_SONGS } from '../../src/lib/setlists';
import { INITIAL_GRIDS } from '../../src/lib/grids';

installSync();
beforeEach(() => clearAllStored());

/** A remote store in memory (the Drive). */
function memRemote() {
  const r = { data: null as Record<string, unknown> | null, audio: new Map<string, Blob>(), puts: 0 };
  const remote: SyncRemote = {
    getData: async () => (r.data ? JSON.parse(JSON.stringify(r.data)) : null),
    putData: async d => { r.data = JSON.parse(JSON.stringify(d)); r.puts++; },
    audioIds: async () => new Set(r.audio.keys()),
    getAudio: async id => r.audio.get(id) ?? null,
    putAudio: async (id, b) => { r.audio.set(id, b); },
  };
  return { r, remote };
}
/** One device's recordings. */
const memAudio = (init: Record<string, string> = {}) => {
  const m = new Map(Object.entries(init).map(([k, v]) => [k, new Blob([v])]));
  const a: LocalAudio = { ids: async () => [...m.keys()], get: async id => m.get(id), put: async (id, b) => m.set(id, b) };
  return { m, a };
};
const song = (id: string, title: string) => ({ id, title, key: 0, bpm: 90, feel: 'rock', capo: 0, duration: 200 });
const titles = () => readStored<{ title: string }[]>('songs', []).map(s => s.title).sort();

describe('sync through the Drive', () => {
  it('two devices end up with each other’s songs, recordings included, and only send what changed', async () => {
    const { r, remote } = memRemote();
    // Phone: a song and a recorded idea.
    writeStored('songs', [song('a', 'Du téléphone')]);
    writeStored('ideas', [{ id: 'i1', kind: 'memo', title: 'Mémo', created: 1, hasAudio: true }]);
    const phone = memAudio({ i1: 'son du téléphone' });
    const first = await syncOnce(remote, phone.a);
    expect(first).toMatchObject({ sent: true, audioUp: 1, audioDown: 0 });
    expect(r.audio.has('i1')).toBe(true);

    // Computer: another song. It receives the phone's, and the recording.
    clearAllStored();
    writeStored('songs', [song('b', 'De l’ordinateur')]);
    const computer = memAudio();
    const second = await syncOnce(remote, computer.a);
    expect(titles()).toEqual(['De l’ordinateur', 'Du téléphone']);
    expect(second.received.added).toBeGreaterThanOrEqual(1);
    expect(second.audioDown).toBe(1);
    expect(await computer.m.get('i1')!.text()).toBe('son du téléphone');
    expect((r.data!.songs as { title: string }[]).map(s => s.title).sort()).toEqual(['De l’ordinateur', 'Du téléphone']);

    // Nothing changed: nothing is sent again.
    const puts = r.puts;
    const third = await syncOnce(remote, computer.a);
    expect(third.sent).toBe(false);
    expect(r.puts).toBe(puts);
  });

  it('a deletion on one device reaches the other', async () => {
    const { remote } = memRemote();
    writeStored('songs', [song('a', 'A'), song('b', 'B')]);
    await syncOnce(remote, memAudio().a);
    writeStored('songs', [song('a', 'A')]); // B deleted here (remembered)
    await syncOnce(remote, memAudio().a);
    clearAllStored();
    // The other device still has its older copy of B (from before the deletion).
    withoutWriteHooks(() => writeStored('songs', [{ ...song('a', 'A'), updated: 1 }, { ...song('b', 'B'), updated: 1 }]));
    await syncOnce(remote, memAudio().a);
    expect(titles()).toEqual(['A']);
  });

  it('an example edited on the phone is not replaced by the untouched example of a computer launched later', async () => {
    const { r, remote } = memRemote();
    const t = (x: number) => 1_700_000_000_000 + x * 86_400_000;
    // Phone, day 1: the example song s3 and the example grid get the player's changes.
    withoutWriteHooks(() => {
      writeStored('songs', INITIAL_SONGS.map(s => (s.id === 's3' ? { ...s, chordpro: '[A7]Ma version', updated: t(1) } : s)));
      writeStored('grids', INITIAL_GRIDS.map((g, i) => (i === 0 ? { ...g, title: 'Ma grille', updated: t(1) } : g)));
    });
    await syncOnce(remote, memAudio().a);

    // Computer, launched days later: its untouched examples carry later dates (first save, launch).
    clearAllStored();
    withoutWriteHooks(() => {
      writeStored('songs', INITIAL_SONGS.map(s => ({ ...s, updated: t(5) })));
      writeStored('grids', INITIAL_GRIDS.map(g => ({ ...g, created: t(5), updated: t(5) })));
    });
    await syncOnce(remote, memAudio().a);
    // The computer gets the phone's versions…
    expect(readStored<{ id: string; chordpro?: string }[]>('songs', []).find(s => s.id === 's3')!.chordpro).toBe('[A7]Ma version');
    expect(readStored<{ title: string }[]>('grids', [])[0].title).toBe('Ma grille');
    // …and the Drive keeps them (the phone will not get the example back).
    expect((r.data!.songs as { id: string; chordpro?: string }[]).find(s => s.id === 's3')!.chordpro).toBe('[A7]Ma version');
    expect((r.data!.grids as { title: string }[])[0].title).toBe('Ma grille');
  });

  it('the home board (pedals, order, size) is the same on every device', async () => {
    const { remote } = memRemote();
    // Computer: the player adds the Looper and the Coach.
    writeStored('home.layout', [{ id: 'tuner', wide: false }, { id: 'looper', wide: false }, { id: 'coach', wide: true }]);
    await syncOnce(remote, memAudio().a);
    // Phone, with the board it started with: it gets the computer's.
    clearAllStored();
    withoutWriteHooks(() => writeStored('home.layout', [{ id: 'tuner', wide: false }]));
    await syncOnce(remote, memAudio().a);
    expect(readStored<{ id: string }[]>('home.layout', []).map(s => s.id)).toEqual(['tuner', 'looper', 'coach']);
  });

  it('boards set up before they were synced (no date): the one with more pedals ends up everywhere', async () => {
    const { remote } = memRemote();
    const board = (ids: string[]) => ids.map(id => ({ id, wide: false }));
    // Computer first, with the starting board; then the phone, where pedals were added long ago.
    withoutWriteHooks(() => writeStored('home.layout', board(['tuner', 'metro'])));
    await syncOnce(remote, memAudio().a);
    clearAllStored();
    withoutWriteHooks(() => writeStored('home.layout', board(['tuner', 'metro', 'looper', 'coach'])));
    await syncOnce(remote, memAudio().a);
    expect(readStored<{ id: string }[]>('home.layout', []).map(s => s.id)).toEqual(['tuner', 'metro', 'looper', 'coach']);
    // Back on the computer: it gets the phone's board.
    clearAllStored();
    withoutWriteHooks(() => writeStored('home.layout', board(['tuner', 'metro'])));
    await syncOnce(remote, memAudio().a);
    expect(readStored<{ id: string }[]>('home.layout', []).map(s => s.id)).toEqual(['tuner', 'metro', 'looper', 'coach']);
  });

  it('preferences (tempo, a song\u2019s transposition, lyrics size) follow the latest change, on every device', async () => {
    const { r, remote } = memRemote();
    // Phone: its own settings, sent.
    writeStored('metro.bpm', 92);
    writeStored('stage.trans.s3', 0);
    writeStored('settings.stageFontSize', 26);
    await syncOnce(remote, memAudio().a);
    const phone = JSON.parse(JSON.stringify(r.data));

    // Computer, later: different settings, changed after the phone's.
    clearAllStored();
    await new Promise(res => setTimeout(res, 5));
    writeStored('metro.bpm', 120);
    writeStored('stage.trans.s3', -2);
    writeStored('settings.stageFontSize', 32);
    await syncOnce(remote, memAudio().a);
    expect(readStored('metro.bpm', 0)).toBe(120); // its own, more recent, stays

    // Back on the phone (its earlier values): it takes the computer's.
    clearAllStored();
    withoutWriteHooks(() => { for (const [k, v] of Object.entries(phone)) writeStored(k, v); });
    await syncOnce(remote, memAudio().a);
    expect(readStored('metro.bpm', 0)).toBe(120);
    expect(readStored('stage.trans.s3', 0)).toBe(-2);
    expect(readStored('settings.stageFontSize', 0)).toBe(32);
  });

  it('device settings stay on each device', async () => {
    const { r, remote } = memRemote();
    writeStored('settings.theme', 'light');
    writeStored('pedal.keys', { right: 'PageDown' });
    await syncOnce(remote, memAudio().a);
    expect(r.data!['settings.theme']).toBeUndefined();
    expect(r.data!['pedal.keys']).toBeUndefined();
  });

  it('only recordings that the data refers to travel', () => {
    expect([...referencedAudio({
      ideas: [{ id: 'i1', hasAudio: true }, { id: 'i2' }],
      'voice.takes': [{ id: 't1', hasAudio: true }],
      'backing.mine': [{ id: 'bt1' }],
    })].sort()).toEqual(['bt1', 'i1', 't1']);
  });
});
