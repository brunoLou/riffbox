/** Songbook PDFs from the library: a setlist (running order first) or every song. */
import { shareOrDownload } from './files';
import { DEFAULT_GAP, fmtClock, fmtDur, setDateLabel, setTimeline, songById, songKey, type Setlist, type Song } from './setlists';
import { songbookPdf, type BookSong } from './songbookPdf';
import { readStored } from './store';

/** A song as on stage: transposed like in the prompter, with its memo for this set. */
function bookSong(s: Song, memo?: string): BookSong {
  const trans = readStored(`stage.trans.${s.id}`, 0);
  const info = [songKey(s, trans), `${s.bpm} BPM`, s.feel, s.capo ? `capo ${s.capo}` : '', trans ? `transposé ${trans > 0 ? '+' : ''}${trans}` : ''].filter(Boolean).join(' · ');
  return { title: s.title, artist: s.artist, info, memo, chordpro: s.chordpro ?? '', transpose: trans };
}
const fileName = (name: string) => name.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'recueil';
const hm = (sec: number) => { const m = Math.round(sec / 60); return m >= 60 ? `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}` : `${m} min`; };

export function setlistPdf(set: Setlist): Uint8Array {
  const songs = set.songIds.map(id => songById(id)).filter((s): s is Song => !!s);
  const { starts, total } = setTimeline(songs.map(s => s.duration), set.gap ?? DEFAULT_GAP);
  return songbookPdf(set.name, songs.map(s => bookSong(s, set.memos?.[s.id])), {
    name: set.name, when: set.date !== undefined ? setDateLabel(set) : undefined, total: hm(total),
    rows: songs.map((s, i) => ({ n: i + 1, title: s.title, dur: fmtDur(s.duration), memo: set.memos?.[s.id], at: set.date !== undefined ? fmtClock(set.date + starts[i] * 1000) : undefined })),
  });
}
export const libraryPdf = (songs: Song[]) => songbookPdf('Recueil RIFFBOX', songs.map(s => bookSong(s)));

export const sharePdf = (name: string, bytes: Uint8Array) =>
  shareOrDownload(`${fileName(name)}.pdf`, new Blob([bytes], { type: 'application/pdf' }), name);
