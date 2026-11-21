/** Waveform of a recording as bars; `progress` colours what has played, `live` animates a recording. */
export function Wave({ bars, progress, live }: { bars: number[]; progress?: number; live?: boolean }) {
  return (
    <div className={'wave' + (live ? ' live' : '')} aria-hidden>
      {bars.map((h, i) => (
        <span key={i} style={{ height: `${Math.round(h * 100)}%` }} className={progress != null && i / bars.length < progress ? 'played' : ''} />
      ))}
    </div>
  );
}
