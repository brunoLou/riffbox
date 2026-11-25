import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { BackButton, Phone, StatusBar, TabBar } from '../components/Chrome';
import { CHORDPRO_EXT, chordProFileName, exportChordPro, exportSongbook, importChordPro, type ImportedSong } from '../lib/chordpro';
import { dateStamp, shareOrDownload } from '../lib/files';
import { gridChordPro } from '../lib/grids';
import { KEY_FR, parseChordPro } from '../lib/music';
import {
  FEELS, allSongs, fmtDur, songById, hasLyrics, keyChords, materializeGridSong, songMeta, type Setlist, type Song,
} from '../lib/setlists';
import { useGrids, useSetlists, useSongs } from '../lib/hooks';
import { noteFr, noteSci } from '../lib/voice';
import './Morceaux.css';
import { LyricsHelp } from '../components/LyricsHelp';
import { StressView } from '../components/StressView';
import { useDialog } from '../lib/useDialog';
import { looksLikeChordPro, textToChordPro } from '../lib/chordSheet';
import { useDropped } from '../lib/dropped';
import { onlyUrl, searchUrl, takeShare } from '../lib/shared';
import { libraryPdf, sharePdf } from '../lib/songbook';


/** "Setlists | Morceaux" switch at the top of the Live tab. */
export function SceneTabs({ active }: { active: 0 | 1 }) {
  return (
    <div className="seg scene-tabs" style={{ gridTemplateColumns: 'repeat(2,minmax(0,1fr))' }}>
      <Link to="/scene" className={active === 0 ? 'on' : ''} replace>Setlists</Link>
      <Link to="/scene/morceaux" className={active === 1 ? 'on' : ''} replace>Morceaux</Link>
    </div>
  );
}

function status(s: Song) {
  if (hasLyrics(s.chordpro)) return { label: 'Paroles', cls: 'lyrics' };
  if (s.chordpro) return { label: 'Accords', cls: 'chords' };
  return { label: 'À écrire', cls: 'empty' };
}

/* ---------- 08c · Bibliothèque ---------- */

export function MorceauxScreen() {
  const nav = useNavigate();
  const [songs, setSongs] = useSongs();
  const [q, setQ] = useState('');
  /** Songs found in the chosen files, waiting for confirmation. */
  const [found, setFound] = useState<{ song: ImportedSong; dup: boolean; on: boolean }[] | null>(null);
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null);
  const [reading, setReading] = useState(false);
  /** Text being pasted (null: the sheet is closed). */
  const [pasted, setPasted] = useState<string | null>(null);
  const [preview, setPreview] = useState<number | null>(null);
  /** Web search sheet: what is looked for (null: closed). */
  const [finding, setFinding] = useState<{ title: string; artist: string; sent: boolean } | null>(null);
  /** The song looked for on the web, to name what is pasted next. */
  const [hint, setHint] = useState<{ title: string; artist: string } | null>(null);
  const [clipMsg, setClipMsg] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const dlgImport = useDialog(() => setFound(null));
  const dlgPaste = useDialog(() => { setPasted(null); setClipMsg(null); });
  const dlgFind = useDialog(() => setFinding(null));
  const list = allSongs()
    .filter(s => !q.trim() || s.title.toLowerCase().includes(q.trim().toLowerCase()))
    .sort((a, b) => a.title.localeCompare(b.title, 'fr'));

  const create = () => {
    const id = 'song' + Date.now();
    setSongs([...songs, { id, title: 'Nouveau morceau', key: 9, bpm: 90, feel: 'shuffle', capo: 0, duration: 210, chordpro: '' }]);
    nav(`/scene/morceau/${id}`, { state: { fresh: true } });
  };

  /** Outside ChordPro, a song needs at least one chord recognised (else it is just some text). */
  const withChords = (songs: ImportedSong[]) => songs.filter(s => /\[[^\]]+\]/.test(s.chordpro ?? ''));
  /** Songs of a file or a pasted text, whatever its form: ChordPro, chords over lyrics, or a PDF. */
  const songsFrom = async (f: File): Promise<ImportedSong[]> => {
    const title = f.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();
    if (/\.pdf$/i.test(f.name) || f.type === 'application/pdf') {
      const { pdfLines, pdfToChordPro } = await import('../lib/pdfSheet');
      return withChords(importChordPro(pdfToChordPro(await pdfLines(await f.arrayBuffer()), title), f.name));
    }
    const text = await f.text();
    return looksLikeChordPro(text) ? importChordPro(text, f.name) : withChords(importChordPro(textToChordPro(text, title), f.name));
  };
  const offer = (songs: ImportedSong[]) => {
    const titles = new Set(allSongs().map(s => s.title.trim().toLowerCase()));
    // Only songs with something in them: lyrics or chords.
    const out = songs.filter(s => s.chordpro?.trim()).map(song => {
      const dup = titles.has(song.title.trim().toLowerCase());
      return { song, dup, on: !dup };
    });
    if (!out.length) { setMsg({ text: 'Aucun morceau trouvé : pas d’accords reconnus (ni ChordPro, ni accords au-dessus des paroles).', error: true }); return; }
    setFound(out);
  };
  const pickFiles = async (files: FileList | File[] | null) => {
    if (!files?.length) return;
    setMsg(null); setReading(true);
    const all: ImportedSong[] = [];
    const failed: string[] = [];
    for (const f of Array.from(files)) {
      try { all.push(...await songsFrom(f)); } catch { failed.push(f.name); }
    }
    setReading(false);
    if (fileInput.current) fileInput.current.value = '';
    if (failed.length && !all.length) { setMsg({ text: `Fichier illisible : ${failed.join(', ')}. Un PDF scanné (une image) ne contient pas de texte à lire.`, error: true }); return; }
    offer(all);
  };
  const convertPasted = () => {
    if (!pasted?.trim()) return;
    setMsg(null);
    const title = hint?.title.trim() || undefined;
    let songs = looksLikeChordPro(pasted) ? importChordPro(pasted, 'Morceau collé') : withChords(importChordPro(textToChordPro(pasted, title), 'Morceau collé'));
    // The song looked for gives its artist when the text has none.
    if (hint?.artist.trim()) songs = songs.map(x => (x.artist ? x : { ...x, artist: hint.artist.trim().slice(0, 80) }));
    setPasted(null); setClipMsg(null); setHint(null);
    offer(songs);
  };
  /** The text copied on a site, read from the clipboard (after a tap: browsers ask for one). */
  const pasteClipboard = async () => {
    setClipMsg(null);
    try {
      const text = await navigator.clipboard.readText();
      if (!text.trim()) { setPasted(pasted ?? ''); setClipMsg('Le presse-papiers est vide : copiez d’abord la chanson sur le site.'); return; }
      setPasted(text);
    } catch {
      setPasted(pasted ?? '');
      setClipMsg('Le navigateur n’a pas donné le presse-papiers : touchez longuement le cadre, puis « Coller ».');
    }
  };
  // A song shared from another app (Android: « Partager → RIFFBOX »).
  useEffect(() => {
    const shared = takeShare();
    if (!shared) return;
    if (onlyUrl(shared)) {
      setMsg({ text: 'RIFFBOX a reçu l’adresse de la page, pas la chanson : sélectionnez la chanson sur la page (accords et paroles), puis Partager → RIFFBOX.', error: true });
      return;
    }
    setPasted(shared.text);
  }, []);
  // « / » or Ctrl+F (Cmd+F): search the library (on a computer).
  const search = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && e.target.closest('input, textarea, select, [contenteditable]');
      if ((e.key === '/' && !typing && !e.ctrlKey && !e.metaKey) || (e.key.toLowerCase() === 'f' && (e.ctrlKey || e.metaKey))) {
        e.preventDefault(); search.current?.focus(); search.current?.select();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  // Files dropped on the window (a computer) are imported here.
  useDropped('songs', files => void pickFiles(files));
  const confirmImport = () => {
    const chosen = (found ?? []).filter(x => x.on);
    const stamp = Date.now();
    setSongs([...songs, ...chosen.map((x, i) => ({ ...x.song, id: `song${stamp}${i}` }))]);
    setFound(null);
    setMsg({ text: chosen.length === 1 ? '1 morceau importé.' : `${chosen.length} morceaux importés.` });
  };
  const exportAll = async () => {
    const all = allSongs().map(s => songById(s.id) ?? s).sort((a, b) => a.title.localeCompare(b.title, 'fr'));
    const how = await shareOrDownload(`riffbox-morceaux-${dateStamp()}.cho`, new Blob([exportSongbook(all)], { type: 'text/plain' }), 'Morceaux RIFFBOX');
    if (how !== 'cancelled') setMsg({ text: `${all.length} morceaux exportés en ChordPro, dans un seul fichier.` });
  };

  return (
    <Phone label="08c Morceaux">
      <StatusBar />
      <div className="songs-scroll">
        <div className="head">
          <div className="head-titles">
            <span className="kicker">Live</span>
            <h1 className="display" style={{ fontSize: 30 }}>MORCEAUX</h1>
          </div>
          <span className="sets-count mono">{allSongs().length} titres</span>
        </div>
        <SceneTabs active={1} />
        <input ref={search} className="text-input search" type="search" placeholder="Rechercher un titre  ( / )" value={q} onChange={e => setQ(e.target.value)} aria-label="Rechercher un titre" />
        <div className="cp-row">
          <button className="btn-outline cp-btn" onClick={() => fileInput.current?.click()} disabled={reading}>{reading ? 'Lecture…' : 'Importer…'}</button>
          <button className="btn-outline cp-btn" onClick={() => setFinding({ title: q, artist: '', sent: false })}>Chercher…</button>
          <button className="btn-outline cp-btn" onClick={() => setPasted('')}>Coller…</button>
          <button className="btn-outline cp-btn" onClick={exportAll}>Tout exporter</button>
          <button className="btn-outline cp-btn" onClick={() => {
            const all = allSongs().map(x => songById(x.id) ?? x).sort((a, b) => a.title.localeCompare(b.title, 'fr'));
            void sharePdf('Recueil RIFFBOX', libraryPdf(all)).then(how => how !== 'cancelled' && setMsg({ text: `Recueil PDF de ${all.length} morceaux prêt.` }));
          }}>Recueil PDF</button>
          <input ref={fileInput} type="file" multiple hidden accept={[...CHORDPRO_EXT, '.pdf', 'application/pdf'].join(',')} aria-label="Fichiers de morceaux" onChange={e => void pickFiles(e.target.files)} />
        </div>
        {msg && <p className={'cp-msg' + (msg.error ? ' error' : '')} role="status">{msg.text}</p>}
        <p className="help cp-help">Chercher : trouver une grille sur le web, la copier, puis la coller ici. Importer : fichiers ChordPro, PDF ou texte (accords au-dessus des paroles). Coller : le texte d’une grille copiée sur un site.</p>

        {list.map(s => {
          // What the stage will show, including a linked grid's chords.
          const st = status(songById(s.id) ?? s);
          return (
            <button key={s.id} className="lib-row" onClick={() => nav(`/scene/morceau/${s.id}`)}>
              <div className="song-text">
                <span className="song-title">{s.title}</span>
                <span className="song-meta">{s.artist ? `${s.artist} · ` : ''}{songMeta(s)} · {fmtDur(s.duration)}</span>
              </div>
              <span className={'lib-status ' + st.cls}>{st.label}</span>
            </button>
          );
        })}
        {!list.length && <div className="songs-empty">Aucun titre ne correspond.</div>}
      </div>
      <button className="cta" onClick={create}>+ Nouveau morceau</button>
      {found && (
        <div className="sheet-backdrop" onClick={() => setFound(null)}>
          <div className="set-sheet cp-sheet" ref={dlgImport} role="dialog" aria-label="Importer des morceaux" onClick={e => e.stopPropagation()}>
            <div className="set-sheet-head">
              <span className="kicker sheet-kicker">{found.length === 1 ? '1 morceau trouvé' : `${found.length} morceaux trouvés`}</span>
              <button className="player-close" onClick={() => setFound(null)} aria-label="Fermer">✕</button>
            </div>
            {found.map((x, i) => (
              <button key={i} className={'pick-row cp-pick' + (x.on ? ' on' : '')} aria-pressed={x.on}
                onClick={() => setFound(found.map((y, j) => (j === i ? { ...y, on: !y.on } : y)))}>
                <span className="cp-check" aria-hidden>{x.on ? '✓' : ''}</span>
                <div className="song-text">
                  <span className="song-title">{x.song.title}</span>
                  <span className="song-meta">
                    {x.song.artist ? `${x.song.artist} · ` : ''}{songMeta({ ...x.song, id: '' })} · {hasLyrics(x.song.chordpro) ? 'paroles et accords' : x.song.chordpro ? 'accords' : 'sans texte'}
                  </span>
                  {x.dup && <span className="cp-dup">Un titre du même nom existe déjà</span>}
                </div>
              </button>
            )).flatMap((row, i) => [row,
              <button key={'p' + i} className="btn-link cp-preview-btn" onClick={() => setPreview(preview === i ? null : i)} aria-expanded={preview === i}>
                {preview === i ? 'Masquer l’aperçu' : `Aperçu de « ${found[i].song.title} »`}
              </button>,
              preview === i && <SongPreview key={'v' + i} chordpro={found[i].song.chordpro ?? ''} />,
            ])}
            <button className="btn-primary" disabled={!found.some(x => x.on)} onClick={confirmImport}>
              {(() => { const n = found.filter(x => x.on).length; return n > 1 ? `Importer ${n} morceaux` : n === 1 ? 'Importer 1 morceau' : 'Rien à importer'; })()}
            </button>
          </div>
        </div>
      )}
      {pasted !== null && (
        <div className="sheet-backdrop" onClick={() => setPasted(null)}>
          <div className="set-sheet cp-sheet" ref={dlgPaste} role="dialog" aria-label="Coller un morceau" onClick={e => e.stopPropagation()}>
            <div className="set-sheet-head">
              <span className="kicker sheet-kicker">Coller un morceau</span>
              <button className="player-close" onClick={() => setPasted(null)} aria-label="Fermer">✕</button>
            </div>
            <p className="help">Collez une grille copiée sur un site ou dans un document (accords au-dessus des paroles, ou ChordPro). Une page entière copiée marche aussi : RIFFBOX y retrouve la chanson.</p>
            <button className="btn-outline" onClick={() => void pasteClipboard()}>Coller depuis le presse-papiers</button>
            {clipMsg && <p className="cp-msg error" role="status">{clipMsg}</p>}
            {hint && <p className="help cp-hint">Pour : <b>{hint.title}</b>{hint.artist ? ` · ${hint.artist}` : ''}</p>}
            <textarea className="chordpro cp-paste" value={pasted} onChange={e => setPasted(e.target.value)} aria-label="Texte du morceau" spellCheck={false}
              placeholder={'Le titre\n\nG          D         Em\nJ’ai pris la route avant le jour'} />
            <button className="btn-primary" disabled={!pasted.trim()} onClick={convertPasted}>Convertir</button>
          </div>
        </div>
      )}
      {finding && (
        <div className="sheet-backdrop" onClick={() => setFinding(null)}>
          <div className="set-sheet cp-sheet" ref={dlgFind} role="dialog" aria-label="Chercher un morceau sur le web" onClick={e => e.stopPropagation()}>
            <div className="set-sheet-head">
              <span className="kicker sheet-kicker">Chercher sur le web</span>
              <button className="player-close" onClick={() => setFinding(null)} aria-label="Fermer">✕</button>
            </div>
            <input className="text-input" placeholder="Titre" aria-label="Titre du morceau" value={finding.title} autoFocus
              onChange={e => setFinding({ ...finding, title: e.target.value })} />
            <input className="text-input" placeholder="Artiste (facultatif)" aria-label="Artiste" value={finding.artist}
              onChange={e => setFinding({ ...finding, artist: e.target.value })} />
            <button className="btn-primary" disabled={!finding.title.trim()} onClick={() => {
              window.open(searchUrl(finding.title, finding.artist), '_blank', 'noopener');
              setHint({ title: finding.title.trim(), artist: finding.artist.trim() });
              setFinding({ ...finding, sent: true });
            }}>Chercher dans le navigateur</button>
            <ol className="cp-steps">
              <li>Sur la page de la grille, appui long → <b>Tout sélectionner</b> → Copier (ou Partager → RIFFBOX sur Android). Inutile de viser : RIFFBOX retrouve la chanson et laisse de côté menus, pubs et commentaires.</li>
              <li>Revenez ici et touchez « Coller depuis le presse-papiers » : RIFFBOX la convertit en ChordPro, avec un aperçu avant d’enregistrer.</li>
            </ol>
            <button className={finding.sent ? 'btn-primary' : 'btn-outline'} onClick={() => {
              if (!hint && finding.title.trim()) setHint({ title: finding.title.trim(), artist: finding.artist.trim() });
              setFinding(null); void pasteClipboard();
            }}>Coller depuis le presse-papiers</button>
          </div>
        </div>
      )}
      <TabBar active={3} />
    </Phone>
  );
}

/** The first lines of a song as the stage shows them: chords above their syllables. */
function SongPreview({ chordpro }: { chordpro: string }) {
  const lines = parseChordPro(chordpro, 0).slice(0, 14);
  return (
    <div className="preview cp-preview">
      {lines.map((l, i) => l.kind === 'section' ? <div key={i} className="lyric-section">{l.label}</div> : (
        <div key={i} className={'lyric-line' + (l.segs.every(g => !g.text.trim()) ? ' chords-only' : '')}>
          {l.segs.map((g, j) => (
            <div key={j} className="lyric-seg">
              <span className="lyric-chord" style={{ fontSize: 13 }}>{g.chord}</span>
              <span className="lyric-text" style={{ fontSize: 15 }}>{g.text}</span>
            </div>
          ))}
        </div>
      ))}
      {parseChordPro(chordpro, 0).length > 14 && <div className="cp-more">…</div>}
    </div>
  );
}

/* ---------- 08d · Fiche d'un morceau ---------- */

export function MorceauRoute() {
  const { songId = '' } = useParams();
  // A grid song gets its own record before editing (idempotent).
  const id = songId.startsWith('g:') ? materializeGridSong(songId) : songId;
  if (id !== songId) return <Navigate to={`/scene/morceau/${id}`} replace />;
  return <MorceauEditor key={id} id={id} />;
}

const MELODY_NOTES = Array.from({ length: 49 }, (_, i) => 36 + i); // C2–C6

const HELP = 'Écrivez chaque accord entre crochets juste avant la syllabe où il tombe : [A]J’ai pris la route [D7]avant le jour. Une ligne {c:Refrain} ouvre une section.';

function MorceauEditor({ id }: { id: string }) {
  const nav = useNavigate();
  const loc = useLocation();
  const [songs, setSongs] = useSongs();
  const [, setSets] = useSetlists();
  const [grids, setGrids] = useGrids();
  const [tab, setTab] = useState<'edit' | 'preview' | 'rhymes' | 'beats'>('edit');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const area = useRef<HTMLTextAreaElement>(null);
  // Caret to restore right after an insertion re-renders the textarea (before the next keystroke).
  const caret = useRef<number | null>(null);
  useLayoutEffect(() => {
    const el = area.current;
    if (el && caret.current !== null) { el.focus(); el.selectionStart = el.selectionEnd = caret.current; caret.current = null; }
  });
  const song = songs.find(s => s.id === id);
  const fresh = !!(loc.state as { fresh?: boolean } | null)?.fresh;
  const addTo = (loc.state as { addToSet?: string } | null)?.addToSet;

  const lines = useMemo(() => parseChordPro(song?.chordpro ?? '', 0), [song?.chordpro]);
  if (!song) return <Navigate to="/scene/morceaux" replace />;

  const grid = grids.find(g => g.songId === id);
  const update = (patch: Partial<Song>) => setSongs(all => all.map(s => (s.id === id ? { ...s, ...patch } : s)));

  /** Insert text at the cursor (or at the start of the current line for a section). */
  const insert = (text: string, atLineStart = false) => {
    const el = area.current;
    const src = song.chordpro ?? '';
    let start = el ? el.selectionStart : src.length;
    let end = el ? el.selectionEnd : src.length;
    if (atLineStart) {
      start = end = src.lastIndexOf('\n', start - 1) + 1;
      text = (start > 0 && src[start - 1] !== '\n' ? '\n' : '') + text + '\n';
    }
    const next = src.slice(0, start) + text + src.slice(end);
    caret.current = start + text.length;
    update({ chordpro: next });
  };


  const remove = () => {
    setSongs(all => all.filter(s => s.id !== id));
    setSets(all => all.map((s: Setlist) => ({ ...s, songIds: s.songIds.filter(x => x !== id) })));
    // A linked grid stays; it becomes its own song again.
    if (grid) setGrids(all => all.map(x => (x.id === grid.id ? { ...x, songId: undefined } : x)));
    nav('/scene/morceaux', { replace: true });
  };

  const done = () => {
    if (addTo) {
      setSets(all => all.map(s => (s.id === addTo && !s.songIds.includes(id) ? { ...s, songIds: [...s.songIds, id] } : s)));
      nav(`/scene/${addTo}`, { replace: true });
    } else nav(-1);
  };

  const chords = keyChords(song.key, song.minor);

  return (
    <Phone label="08d Morceau">
      <StatusBar />
      <div className="songs-scroll editor">
        <h1 className="sr-only">Morceau : {song.title}</h1>
        <div className="head">
          <div className="head-l">
            <BackButton fallback="/scene/morceaux" />
            <div className="head-titles">
              <span className="kicker">Morceau</span>
              <span className="display set-title">{song.title.toUpperCase() || 'SANS TITRE'}</span>
            </div>
          </div>
          <button className="edit-btn on" onClick={done}>{addTo ? 'Ajouter' : 'OK'}</button>
        </div>

        <div className="form-card">
          <label className="sheet-field">
            <span>Titre</span>
            <input className="text-input" value={song.title} maxLength={60} autoFocus={fresh}
              onFocus={e => fresh && e.target.select()}
              onChange={e => update({ title: e.target.value })}
              onBlur={e => !e.target.value.trim() && update({ title: 'Sans titre' })} />
          </label>
          <div className="form-grid">
            <label className="sheet-field">
              <span>Ton</span>
              <select className="text-input" value={song.key} onChange={e => update({ key: Number(e.target.value) })}>
                {KEY_FR.map((k, i) => <option key={i} value={i}>{k}</option>)}
              </select>
            </label>
            <button className="detect-link" onClick={() => nav('/outils/ton', { state: { songId: id } })}>Détecter le ton à l’écoute ›</button>
            <label className="sheet-field">
              <span>Mode</span>
              <select className="text-input" value={song.minor ? 'm' : 'M'} onChange={e => update({ minor: e.target.value === 'm' || undefined })}>
                <option value="M">majeur</option>
                <option value="m">mineur</option>
              </select>
            </label>
            <div className="sheet-field">
              <span>Tempo</span>
              <div className="mini-stepper">
                <button onClick={() => update({ bpm: Math.max(40, song.bpm - 2) })} aria-label="Ralentir">−</button>
                <span className="mono">{song.bpm}</span>
                <button onClick={() => update({ bpm: Math.min(240, song.bpm + 2) })} aria-label="Accélérer">+</button>
              </div>
            </div>
            <div className="sheet-field">
              <span>Capo</span>
              <div className="mini-stepper">
                <button onClick={() => update({ capo: Math.max(0, song.capo - 1) })} aria-label="Capo plus bas">−</button>
                <span className="mono">{song.capo}</span>
                <button onClick={() => update({ capo: Math.min(12, song.capo + 1) })} aria-label="Capo plus haut">+</button>
              </div>
            </div>
            <label className="sheet-field">
              <span>Style</span>
              <select className="text-input" value={FEELS.includes(song.feel) ? song.feel : 'autre'} onChange={e => update({ feel: e.target.value })}>
                {FEELS.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </label>
            <div className="sheet-field">
              <span>Durée</span>
              <div className="mini-stepper">
                <button onClick={() => update({ duration: Math.max(30, song.duration - 15) })} aria-label="Plus court">−</button>
                <span className="mono">{fmtDur(song.duration)}</span>
                <button onClick={() => update({ duration: Math.min(1200, song.duration + 15) })} aria-label="Plus long">+</button>
              </div>
            </div>
            {(['melodyLow', 'melodyHigh'] as const).map(f => (
              <label key={f} className="sheet-field">
                <span>{f === 'melodyLow' ? 'Mélodie : note grave' : 'Mélodie : note aiguë'}</span>
                <select className="text-input" value={song[f] ?? ''} onChange={e => update({ [f]: e.target.value === '' ? undefined : Number(e.target.value) })}>
                  <option value="">—</option>
                  {MELODY_NOTES.map(m => <option key={m} value={m}>{noteFr(m)} ({noteSci(m)})</option>)}
                </select>
              </label>
            ))}
          </div>
          <p className="help">L’étendue de la mélodie sert à « Trouver ma tonalité » (Pratiquer › Justesse vocale).</p>
        </div>

        <div className="lyrics-head">
          <span className="kicker">Paroles et accords</span>
          <div className="mini-seg">
            <button className={tab === 'edit' ? 'on' : ''} onClick={() => setTab('edit')}>Écrire</button>
            <button className={tab === 'preview' ? 'on' : ''} onClick={() => setTab('preview')}>Aperçu</button>
            <button className={tab === 'rhymes' ? 'on' : ''} onClick={() => setTab('rhymes')}>Rimes</button>
            <button className={tab === 'beats' ? 'on' : ''} onClick={() => setTab('beats')}>Temps</button>
          </div>
        </div>

        {tab === 'edit' ? (
          <>
            <div className="hscroll chord-bar" role="toolbar" aria-label="Insérer">
              {['Couplet', 'Refrain', 'Pont'].map(sec => (
                <button key={sec} className="ins sec" onMouseDown={e => e.preventDefault()} onClick={() => insert(`{c:${sec}}`, true)}>{sec}</button>
              ))}
              {chords.map(c => (
                <button key={c} className="ins" onMouseDown={e => e.preventDefault()} onClick={() => insert(`[${c}]`)}>{c}</button>
              ))}
            </div>
            <textarea
              ref={area}
              className="chordpro"
              value={song.chordpro ?? ''}
              onChange={e => update({ chordpro: e.target.value })}
              placeholder={'{c:Couplet}\n[A]J’ai pris la route [D7]avant le jour\n…'}
              spellCheck={false}
              aria-label="Paroles au format ChordPro"
            />
            <p className="help">{HELP}</p>
          </>
        ) : tab === 'rhymes' ? (
          <LyricsHelp chordpro={song.chordpro ?? ''} />
        ) : tab === 'beats' ? (
          <StressView chordpro={song.chordpro ?? ''} onChange={chordpro => update({ chordpro })} />
        ) : (
          <div className="preview">
            {lines.some(l => l.kind === 'line' && l.segs.length) ? lines.map((l, i) =>
              l.kind === 'section' ? <div key={i} className="lyric-section">{l.label}</div> : (
                <div key={i} className={'lyric-line' + (l.segs.every(g => !g.text.trim()) ? ' chords-only' : '')}>
                  {l.segs.map((g, j) => (
                    <div key={j} className="lyric-seg">
                      <span className="lyric-chord" style={{ fontSize: 18 }}>{g.chord}</span>
                      <span className="lyric-text" style={{ fontSize: 22 }}>{g.text}</span>
                    </div>
                  ))}
                </div>
              )) : <p className="help">Rien à afficher pour l’instant.</p>}
          </div>
        )}

        {grid && (
          <div className="grid-link">
            <span>Grille reliée : <b>{grid.title}</b></span>
            <div className="grid-link-btns">
              <button className="btn-outline" onClick={() => nav(`/composer/grille/${grid.id}`)}>Ouvrir ›</button>
              <button className="btn-outline" onClick={() => update({ chordpro: (song.chordpro ? song.chordpro.replace(/\s*$/, '\n') : '') + gridChordPro(grid) })}>
                Insérer ses accords
              </button>
            </div>
          </div>
        )}

        <button className="btn-outline" onClick={() => {
          const s = songById(id) ?? song;
          void shareOrDownload(chordProFileName(s.title), new Blob([exportChordPro(s)], { type: 'text/plain' }), s.title);
        }}>Exporter en ChordPro</button>

        {confirmDelete ? (
          <div className="confirm-row">
            <button className="btn-outline" onClick={() => setConfirmDelete(false)}>Annuler</button>
            <button className="btn-danger" onClick={remove}>Supprimer</button>
          </div>
        ) : (
          <button className="btn-outline danger" onClick={() => setConfirmDelete(true)}>Supprimer le morceau…</button>
        )}
      </div>
      <TabBar active={3} />
    </Phone>
  );
}
