/**
 * « Exporter pour un logiciel de musique »: every recording (notebook ideas, vocal takes) as a
 * 24-bit 48 kHz WAV with its tempo and key, in one ZIP with an index, ready for FL Studio, Reaper,
 * Ableton Live, Logic, Cubase…
 */
import { getBlob } from './blobs';
import { dateStamp } from './files';
import { INITIAL_IDEAS, KIND_LABEL, type Idea } from './ideas';
import { readStored } from './store';
import { TAKES_KEY, pieceById, type Take } from './voice';
import { decodeRecording, encodeWav } from './wav';
import { makeZip, type ZipEntry } from './zip';

/** Key names that are safe in file names on every system (no ♯/♭). */
const KEY_ASCII = ['Do', 'Do#', 'Re', 'Mib', 'Mi', 'Fa', 'Fa#', 'Sol', 'Lab', 'La', 'Sib', 'Si'];
const KEY_FR = ['Do', 'Do♯', 'Ré', 'Mi♭', 'Mi', 'Fa', 'Fa♯', 'Sol', 'La♭', 'La', 'Si♭', 'Si'];

export interface Recording {
  id: string; folder: 'Carnet' | 'Voix'; title: string; kind: string; date: Date;
  bpm?: number; key?: number; minor?: boolean; style?: string; mood?: string;
}

/** The recordings that have audio, newest first. */
export function listRecordings(): Recording[] {
  const ideas = readStored<Idea[]>('ideas', INITIAL_IDEAS).filter(i => i.hasAudio)
    .map((i): Recording => ({ id: i.id, folder: 'Carnet', title: i.title, kind: KIND_LABEL[i.kind], date: new Date(i.created), bpm: i.bpm, key: i.key, minor: i.minor, style: i.style, mood: i.mood }));
  const takes = readStored<Take[]>(TAKES_KEY, []).filter(t => t.hasAudio)
    .map((t): Recording => ({ id: t.id, folder: 'Voix', title: t.title, kind: 'Prise vocale', date: new Date(t.date), bpm: pieceById(t.pieceId)?.bpm, key: ((t.tonic % 12) + 12) % 12 }));
  return [...ideas, ...takes].sort((a, b) => b.date.getTime() - a.date.getTime());
}

const clean = (s: string) => s.replace(/[\\/:*?"<>|\u0000-\u001f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80) || 'Sans titre';
const keyAscii = (r: Recording) => (r.key === undefined ? '' : KEY_ASCII[r.key] + (r.minor ? 'm' : ''));
export const keyLabelFr = (r: Recording) => (r.key === undefined ? '' : `${KEY_FR[r.key]} ${r.minor ? 'mineur' : 'majeur'}`);

/** « 2026-11-22 Riff shuffle - 92 BPM - La.wav » */
export function wavName(r: Recording): string {
  return [`${dateStamp(r.date)} ${clean(r.title)}`, r.bpm ? `${r.bpm} BPM` : '', keyAscii(r)].filter(Boolean).join(' - ') + '.wav';
}

/** One recording as a WAV file, with its length (null when its audio is missing or cannot be read). */
export async function recordingWav(r: Recording): Promise<{ wav: Blob; seconds: number } | null> {
  const blob = await getBlob(r.id);
  if (!blob) return null;
  try {
    const { channels, sampleRate } = await decodeRecording(blob);
    const comment = [r.kind, keyLabelFr(r), r.bpm ? `${r.bpm} BPM` : '', r.style, r.mood].filter(Boolean).join(' · ');
    // A minor key's root is its own tonic (La mineur → A).
    const wav = encodeWav(channels, sampleRate, { title: r.title, comment, date: dateStamp(r.date), bpm: r.bpm, root: r.key });
    return { wav, seconds: (channels[0]?.length ?? 0) / sampleRate };
  } catch { return null; }
}

const csvCell = (s: string | number | undefined) => { const v = String(s ?? ''); return /[;"\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v; };

/** Every recording in a ZIP: Carnet/ and Voix/ folders, an index (CSV) and a short guide. */
export async function exportForDaw(onProgress?: (done: number, total: number) => void): Promise<{ zip: Blob; name: string; count: number; failed: string[] }> {
  const recs = listRecordings();
  const root = `RIFFBOX ${dateStamp()}`;
  const entries: ZipEntry[] = [];
  const used = new Set<string>();
  const failed: string[] = [];
  const rows = [['Fichier', 'Titre', 'Type', 'Date', 'Durée (s)', 'Tempo (BPM)', 'Tonalité', 'Style', 'Humeur'].join(';')];
  let done = 0;
  for (const r of recs) {
    onProgress?.(done, recs.length);
    const res = await recordingWav(r);
    done++;
    if (!res) { failed.push(r.title); continue; }
    let name = `${r.folder}/${wavName(r)}`;
    for (let n = 2; used.has(name); n++) name = `${r.folder}/${wavName(r).replace(/\.wav$/, ` (${n}).wav`)}`;
    used.add(name);
    entries.push({ name: `${root}/${name}`, data: new Uint8Array(await res.wav.arrayBuffer()), date: r.date });
    const secs = Math.round(res.seconds * 10) / 10;
    rows.push([name, r.title, r.kind, dateStamp(r.date), secs, r.bpm, keyLabelFr(r), r.style, r.mood].map(csvCell).join(';'));
  }
  onProgress?.(recs.length, recs.length);
  const enc = new TextEncoder();
  entries.push({ name: `${root}/index.csv`, data: enc.encode('﻿' + rows.join('\r\n') + '\r\n') });
  entries.push({ name: `${root}/LISEZMOI.txt`, data: enc.encode(README.replace(/\n/g, '\r\n')) });
  return { zip: makeZip(entries), name: `riffbox-enregistrements-${dateStamp()}.zip`, count: entries.length - 2, failed };
}

const README = `Enregistrements RIFFBOX

Format : WAV 24 bits, 48 kHz, non compressé. Il s'ouvre dans tous les logiciels de musique
(FL Studio, Reaper, Ableton Live, Logic, Cubase, Studio One, GarageBand, Audacity…).

Dossiers : Carnet (riffs et mémos), Voix (prises des exercices vocaux).
Noms : date, titre, tempo et tonalité (# = dièse, b = bémol, m = mineur).
index.csv : la liste avec la durée, le tempo, la tonalité, le style et l'humeur (s'ouvre dans un tableur).

Tempo et tonalité sont aussi inscrits dans chaque fichier :
- Ableton Live et FL Studio lisent le tempo (et la note de base) inscrit dans le fichier ;
- Reaper affiche le titre et le commentaire dans l'explorateur de médias.

Les enregistrements ne suivent pas un clic : calez le début sur la grille du projet,
puis réglez le tempo du projet sur celui du nom de fichier.
`;
