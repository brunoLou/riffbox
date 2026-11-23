import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { dropKind, offerDrop } from '../lib/dropped';

/**
 * Drag files onto the window: song sheets (PDF, ChordPro, text) go to the song library's import,
 * audio files to « Mes fichiers » of the backing tracks.
 */
export function FileDrop() {
  const nav = useNavigate();
  const loc = useLocation();
  const [over, setOver] = useState(false);
  useEffect(() => {
    let depth = 0;
    const hasFiles = (e: DragEvent) => !!e.dataTransfer && Array.from(e.dataTransfer.types).includes('Files');
    const enter = (e: DragEvent) => { if (!hasFiles(e)) return; depth++; setOver(true); };
    const leave = (e: DragEvent) => { if (!hasFiles(e)) return; depth = Math.max(0, depth - 1); if (!depth) setOver(false); };
    const overFn = (e: DragEvent) => { if (hasFiles(e)) e.preventDefault(); };
    const drop = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth = 0; setOver(false);
      // A file input handles its own drops.
      if ((e.target as HTMLElement)?.closest?.('input[type=file]')) return;
      const files = Array.from(e.dataTransfer!.files);
      const songs = files.filter(f => dropKind(f) === 'songs'), audio = files.filter(f => dropKind(f) === 'audio');
      if (songs.length) {
        offerDrop('songs', songs);
        if (loc.pathname !== '/scene/morceaux') nav('/scene/morceaux');
      } else if (audio.length) {
        offerDrop('audio', audio);
        if (loc.pathname !== '/pratiquer/backing') nav('/pratiquer/backing');
      }
    };
    window.addEventListener('dragenter', enter);
    window.addEventListener('dragleave', leave);
    window.addEventListener('dragover', overFn);
    window.addEventListener('drop', drop);
    return () => {
      window.removeEventListener('dragenter', enter);
      window.removeEventListener('dragleave', leave);
      window.removeEventListener('dragover', overFn);
      window.removeEventListener('drop', drop);
    };
  }, [nav, loc.pathname]);
  return over ? <div className="drop-zone" aria-hidden><span>Déposez ici : PDF ou ChordPro → Morceaux · audio → Backing tracks</span></div> : null;
}
