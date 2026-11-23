import { SPEED, fmtTime, type MyTrack } from '../lib/myBacking';
import type { useFilePlayer } from '../lib/useFilePlayer';

/** Position, speed (pitch kept), loop and back to the start, for a backing track played from a file. */
export function FileControls({ track, player, onUpdate, playButton }: {
  track: MyTrack; player: ReturnType<typeof useFilePlayer>; onUpdate: (patch: Partial<MyTrack>) => void; playButton: React.ReactNode;
}) {
  const here = player.current === track.id;
  const time = here ? player.time : 0;
  const speed = track.speed ?? 1;
  const loop = track.loop ?? true;
  return (
    <>
      <div className="my-seek">
        <span className="mono">{fmtTime(time)}</span>
        <input type="range" min={0} max={Math.max(1, track.duration)} step={0.1} value={Math.min(time, track.duration)} aria-label="Position"
          onChange={e => player.seek(Number(e.target.value))} disabled={!here} />
        <span className="mono">{fmtTime(track.duration)}</span>
      </div>
      <div className="player-ctrls">
        <div className="stepper">
          <button onClick={() => onUpdate({ speed: player.setSpeed(speed - SPEED.step) })} disabled={speed <= SPEED.min} aria-label="Plus lent">−</button>
          <div><span>Vitesse</span><span className="mono">{Math.round(speed * 100)} %</span></div>
          <button onClick={() => onUpdate({ speed: player.setSpeed(speed + SPEED.step) })} disabled={speed >= SPEED.max} aria-label="Plus rapide">+</button>
        </div>
        {playButton}
        <div className="my-side">
          <button className={'my-loop' + (loop ? ' on' : '')} aria-pressed={loop} onClick={() => { player.setLoop(!loop); onUpdate({ loop: !loop }); }}>↻ Boucle</button>
          <button className="my-restart" onClick={player.restart}>⏮ Début</button>
        </div>
      </div>
      {track.bpm && speed !== 1 && <p className="my-note">À cette vitesse : {Math.round(track.bpm * speed)} BPM.</p>}
    </>
  );
}
