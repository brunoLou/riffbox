/**
 * Guitar Pro files (.gp3 to .gp7, .gpx) read with alphaTab (MPL-2.0, loaded only when a file is
 * opened): each bar of a track becomes its strokes and the chord played.
 */
import { barSlots, chordFromNotes, strokesFromOnsets, type StrumBar } from './strum';

export interface GpTrack {
  index: number; name: string;
  /** Share of the played beats that are chords (three notes or more): rhythm guitar tracks first. */
  chordShare: number;
  bars: StrumBar[];
  /** Some notes (triplets, odd lengths) fell between two sixteenths and were rounded. */
  rounded: boolean;
}
export interface GpSong { title: string; artist: string; bpm: number; den: 4 | 8; swing: boolean; tracks: GpTrack[] }

/** alphaTab counts 960 ticks per quarter note: a sixteenth is 240. */
const SLOT = 240;

type AlphaTab = typeof import('@coderline/alphatab/core');
let lib: Promise<AlphaTab> | null = null;
const load = () => (lib ??= import('@coderline/alphatab/core'));

export class GpError extends Error {}

export async function readGuitarPro(bytes: Uint8Array): Promise<GpSong> {
  const at = await load();
  let score;
  try {
    const settings = new at.Settings();
    settings.core.logLevel = at.LogLevel.None; // the app says itself when a file cannot be read
    at.Logger.logLevel = at.LogLevel.None;
    score = at.importer.ScoreLoader.loadScoreFromBytes(bytes, settings);
  } catch {
    throw new GpError('Ce fichier n’est pas un fichier Guitar Pro lisible (formats .gp, .gp3, .gp4, .gp5, .gpx).');
  }
  const first = score.masterBars[0];
  const den: 4 | 8 = first && first.timeSignatureDenominator === 8 ? 8 : 4;
  const BrushType = at.model.BrushType, PickStroke = at.model.PickStroke;
  const tracks: GpTrack[] = [];
  for (const track of score.tracks) {
    const staff = track.staves[0];
    if (!staff || staff.isPercussion) continue;
    let played = 0, chords = 0, rounded = false;
    const bars: StrumBar[] = staff.bars.map((bar, i) => {
      const mb = score.masterBars[i];
      // In 6/8 an eighth is 2 sixteenths: a bar of 6/8 has 12 positions, like 3/4.
      const slots = Math.round((mb.calculateDuration() / SLOT));
      const onsets: { slot: number; dir?: 'D' | 'U' }[] = [];
      let pitches: number[] = [];
      for (const beat of bar.voices[0]?.beats ?? []) {
        const notes = beat.notes.filter(n => !n.isTieDestination);
        if (beat.isRest || !notes.length) continue;
        played++;
        if (beat.notes.length >= 3) chords++;
        const exact = beat.playbackStart / SLOT, slot = Math.round(exact);
        if (Math.abs(exact - slot) > 0.05) rounded = true;
        const dir = beat.brushType === BrushType.BrushDown || beat.pickStroke === PickStroke.Down ? 'D'
          : beat.brushType === BrushType.BrushUp || beat.pickStroke === PickStroke.Up ? 'U' : undefined;
        if (!onsets.some(o => o.slot === slot)) onsets.push({ slot, dir });
        // The bar's chord: its fullest beat (the first one if several).
        if (beat.notes.length > pitches.length) pitches = beat.notes.map(n => n.realValue);
      }
      const chord = chordFromNotes(pitches) ?? undefined;
      return { slots: strokesFromOnsets(onsets, slots || barSlots(4, den)), ...(chord ? { chord } : {}) };
    });
    tracks.push({ index: track.index, name: track.name || `Piste ${track.index + 1}`, chordShare: played ? chords / played : 0, bars, rounded });
  }
  tracks.sort((a, b) => b.chordShare - a.chordShare);
  return {
    title: score.title || 'Sans titre', artist: score.artist || '', bpm: Math.round(score.tempo) || 90, den,
    swing: !!first && first.tripletFeel !== at.model.TripletFeel.NoTripletFeel,
    tracks,
  };
}
