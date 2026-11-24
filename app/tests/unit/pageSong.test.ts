import { describe, expect, it } from 'vitest';
import { extractSong, textToChordPro } from '../../src/lib/chordSheet';

/** What « Tout sélectionner » then Copier gives on a chord page of Ultimate Guitar (made-up song). */
const PAGE = `ULTIMATE GUITAR
Log in
Sign up
Tabs
Courses
Explore
Fil d'argent Chords by Les Cordes
Difficulty: novice
Tuning: E A D G B E
Key: Em
Capo: 2nd fret
Author jeanpaul 1.2K
Last edit on Mar 03, 2024
View official tab
Chords
Em C G D
Strumming
D DU UDU
X
[Intro]
Em  C  G  D

[Verse 1]
Em           C
Sur la route au petit jour
G              D
Je reviens chanter l'amour
Em            C
Les néons s'éteignent un à un

[Chorus]
G         D        Em
Fil d'argent, fil d'argent
C            G          D
Tu me ramènes à demain
Et la nuit s'en va au loin

X
Autoscroll
Transpose
-1
+1
Simplify
Last update: Mar 03, 2024
Rating
4.8
Comments
super tab merci !!
Related tabs
Fil d'argent (ver 2) Chords
Welcome offer`;

describe('a whole page copied from a chord site', () => {
  it('keeps the song alone, with the title, artist, key and capo shown by the page', () => {
    const song = extractSong(PAGE)!;
    expect(song).toMatchObject({ title: 'Fil d’argent'.replace('’', "'"), artist: 'Les Cordes', key: 'Em', capo: '2' });
    expect(song.body.split('\n')[0]).toBe('[Intro]');
    expect(song.body).toContain('Et la nuit s\'en va au loin'); // the end of the verse, without chords
    for (const junk of ['ULTIMATE GUITAR', 'Strumming', 'Autoscroll', 'Comments', 'Welcome offer', 'D DU UDU', 'Em C G D\n']) {
      expect(song.body).not.toContain(junk);
    }
  });

  it('becomes a clean ChordPro song', () => {
    const cp = textToChordPro(PAGE);
    expect(cp).toMatch(/^\{title: Fil d'argent\}\n\{artist: Les Cordes\}\n\{key: Em\}\n\{capo: 2\}/);
    expect(cp).toContain('{c:Verse 1}');
    expect(cp).toContain('[Em]Sur la route [C]au petit jour');
    expect(cp).toContain('{c:Chorus}');
    expect(cp).not.toMatch(/Log in|Transpose|Rating|Related/);
  });

  it('a song pasted alone keeps the usual import (title on the first line)', () => {
    const alone = "Fil d'argent\n\nEm           C\nSur la route au petit jour";
    expect(extractSong(alone)).toBeNull();
    expect(textToChordPro(alone)).toMatch(/^\{title: Fil d'argent\}/);
  });
});
