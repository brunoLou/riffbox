import { describe, expect, it } from 'vitest';
import { addCols, emptyTab, isEmptyTab, setCell, tabNotes, tabToText, trimTab } from '../../src/lib/tab';

describe('tablature', () => {
  it('a riff written cell by cell, as text with high e on top', () => {
    let t = emptyTab(8);
    expect(isEmptyTab(t)).toBe(true);
    t = setCell(t, 0, 0, 0);   // low E open
    t = setCell(t, 1, 0, 3);
    t = setCell(t, 2, 1, 2);   // A, fret 2
    t = setCell(t, 3, 1, 12);
    t = setCell(t, 4, 5, -1);  // muted high e
    expect(isEmptyTab(t)).toBe(false);
    expect(tabToText(t)).toBe([
      'e|--------------x-|',
      'B|----------------|',
      'G|----------------|',
      'D|----------------|',
      'A|-------2--12----|',
      'E|-0--3-----------|',
    ].join('\n'));
  });

  it('notes to play, column by column (muted ones silent), chords together', () => {
    let t = emptyTab(4);
    t = setCell(t, 0, 0, 5);
    t = setCell(t, 1, 3, 2); t = setCell(t, 1, 4, 3); // two notes together
    t = setCell(t, 2, 2, -1);
    expect(tabNotes(t)).toEqual([[45], [57, 62], []]);
  });

  it('columns added, empty ones at the end trimmed, cleared cells', () => {
    let t = addCols(emptyTab(4), 8);
    expect(t.cols).toHaveLength(12);
    t = setCell(t, 2, 1, 7);
    expect(trimTab(t).cols).toHaveLength(3);
    expect(trimTab(setCell(t, 2, 1, null)).cols).toHaveLength(1);
  });
});
