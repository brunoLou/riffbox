import { useLayoutEffect, useRef, useState } from 'react';
import { BackButton, Phone, StatusBar, TabBar } from '../components/Chrome';
import { ChordDiagram } from '../components/ChordDiagram';
import { PedalTile } from '../components/PedalTile';
import { TempoKnob } from '../components/TempoKnob';
import { chordType, voicings } from '../lib/chords';
import { TILES } from '../lib/data';
import { fakeWave } from '../lib/ideas';
import { Wave } from '../components/Wave';
import { BADGE } from './Carnet';
import './DesignSystem.css';

/** Colour tokens by role (styles.css holds the values for each theme). */
const TOKENS: { group: string; items: [string, string][] }[] = [
  { group: 'Fonds', items: [['canvas', 'Fond de l’app'], ['surface', 'Écran'], ['surface-2', 'Carte'], ['surface-3', 'Carte en relief, puce'], ['panel', 'Feuille du bas'], ['well', 'Creux (aperçu, note)']] },
  { group: 'Traits', items: [['line', 'Séparateur'], ['line-2', 'Bord de bouton'], ['dash', 'Pointillés'], ['card-border', 'Bord de carte']] },
  { group: 'Texte', items: [['cream', 'Texte, sélection'], ['muted-3', 'Texte secondaire'], ['muted-2', 'Légende'], ['muted', 'Discret'], ['on-cream', 'Texte sur sélection']] },
  { group: 'Accents', items: [['amber', 'Action principale'], ['accent-text', 'Texte d’accent'], ['amber-hi', 'Accent clair'], ['tan', 'Bois, repères'], ['led', 'Voyant allumé'], ['led-off', 'Voyant éteint'], ['warn', 'Attention, suppression']] },
  { group: 'Justesse', items: [['acc-good', 'Juste'], ['acc-close', 'Presque'], ['acc-off', 'Faux']] },
];

const FONTS: { name: string; family: string; role: string; sample: string; cls: string }[] = [
  { name: 'Big Shoulders Display', family: 'var(--f-display)', role: 'Titres d’écran, noms de pédales, notes géantes · 900', sample: 'MON PEDALBOARD', cls: 'ds-font-display' },
  { name: 'Barlow', family: 'var(--f-body)', role: 'Texte, boutons, listes · 500 à 800', sample: 'Riff shuffle en La, 92 BPM', cls: 'ds-font-body' },
  { name: 'Space Mono', family: 'var(--f-mono)', role: 'Chiffres, accords, sur-titres · 400 et 700', sample: 'A7 · D7 · E7 — 4/4', cls: 'ds-font-mono' },
];

const SCALE: { label: string; cls: string; spec: string }[] = [
  { label: 'ACCORDEUR', cls: 'display ds-t-1', spec: 'Titre · Display 32' },
  { label: 'Pensez à sauvegarder', cls: 'ds-t-2', spec: 'Titre de carte · Barlow 800 · 16' },
  { label: 'Vos idées ne sont que sur ce téléphone.', cls: 'ds-t-3', spec: 'Texte · Barlow 500 · 14' },
  { label: 'Routine du jour', cls: 'kicker', spec: 'Sur-titre · Space Mono 11 · capitales' },
  { label: '92 BPM', cls: 'mono ds-t-5', spec: 'Valeur · Space Mono 700 · 15' },
];

function Swatch({ name, role, theme }: { name: string; role: string; theme: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [hex, setHex] = useState('');
  useLayoutEffect(() => { if (ref.current) setHex(getComputedStyle(ref.current).getPropertyValue(`--${name}`).trim()); }, [name, theme]);
  return (
    <div className="ds-swatch" ref={ref} data-token={name}>
      <span className="ds-chip" style={{ background: `var(--${name})` }} />
      <span className="ds-swatch-text">
        <code>--{name}</code>
        <span>{role}</span>
      </span>
      <span className="ds-hex mono">{hex}</span>
    </div>
  );
}

/**
 * Mini design system: colours, type and the app's own components (the real ones, so the page
 * never drifts from the app), previewed in either theme.
 */
export default function DesignSystem() {
  const [theme, setTheme] = useState<'dark' | 'light'>(() => (document.documentElement.dataset.theme === 'light' ? 'light' : 'dark'));
  const [bpm, setBpm] = useState(92);
  const [sw, setSw] = useState(true);
  const [sel, setSel] = useState(1);
  const C = voicings(0, chordType('maj'))[0];
  // Two LEDs lit, as when those tools were used today.
  const tiles = ['tuner', 'metro', 'carnet', 'grilles', 'backing'].map(id => ({ ...TILES.find(t => t.id === id)!, on: id === 'tuner' || id === 'metro' }));
  const noop = () => {};

  return (
    <Phone label="10 Design system">
      <StatusBar />
      <div className="ds-scroll" data-theme={theme}>
        <div className="head">
          <div className="head-l">
            <BackButton fallback="/reglages" />
            <div className="head-titles">
              <span className="kicker">Réglages</span>
              <h1 className="display" style={{ fontSize: 28 }}>DESIGN SYSTEM</h1>
            </div>
          </div>
        </div>
        <p className="ds-intro">
          Un atelier de musicien : bois, crème et ambre, des outils dessinés comme des pédales d’effet.
          Ce sont les vrais composants de l’app, avec ses vrais styles.
        </p>
        <div className="seg" style={{ gridTemplateColumns: 'repeat(2,minmax(0,1fr))' }} role="group" aria-label="Thème de l’aperçu">
          <button className={theme === 'dark' ? 'on' : ''} aria-pressed={theme === 'dark'} onClick={() => setTheme('dark')}>Sombre</button>
          <button className={theme === 'light' ? 'on' : ''} aria-pressed={theme === 'light'} onClick={() => setTheme('light')}>Clair</button>
        </div>

        <h2 className="ds-h">Couleurs</h2>
        {TOKENS.map(g => (
          <section key={g.group} className="ds-card" aria-label={g.group}>
            <span className="kicker">{g.group}</span>
            {g.items.map(([n, r]) => <Swatch key={n} name={n} role={r} theme={theme} />)}
          </section>
        ))}
        <p className="ds-note">
          Les éléments « physiques » (pédales, manche, diagrammes, bois de l’accordeur) restent sombres
          dans les deux thèmes, comme le prompteur live.
        </p>

        <h2 className="ds-h">Typographies</h2>
        {FONTS.map(f => (
          <section key={f.name} className="ds-card ds-font" aria-label={f.name}>
            <span className={f.cls}>{f.sample}</span>
            <span className="ds-font-name">{f.name}</span>
            <span className="ds-font-role">{f.role}</span>
          </section>
        ))}
        <section className="ds-card" aria-label="Échelle">
          <span className="kicker">Échelle</span>
          {SCALE.map(x => (
            <div key={x.spec} className="ds-scale-row">
              <span className={x.cls}>{x.label}</span>
              <span className="ds-spec mono">{x.spec}</span>
            </div>
          ))}
        </section>

        <h2 className="ds-h">Composants</h2>

        <section className="ds-card" aria-label="Tuile-pédale">
          <span className="kicker">Tuile-pédale</span>
          <p className="ds-desc">Un outil de l’accueil : voyant (allumé si l’outil a servi aujourd’hui), deux boutons décoratifs, nom, résumé en direct, footswitch. Petite ou large.</p>
          <div className="pedal-grid ds-pedals" data-theme="dark">
            {tiles.map(t => (
              <PedalTile key={t.id} t={t} wide={!!t.wide} edit={false} lifted={false}
                onOpen={noop} onRemove={noop} onResize={noop} onGrip={noop} onGripKey={noop} />
            ))}
          </div>
        </section>

        <section className="ds-card" aria-label="Bouton rotatif">
          <span className="kicker">Bouton rotatif</span>
          <p className="ds-desc">Glisser vers le haut ou le bas, molette, flèches du clavier. Ici : {bpm} BPM.</p>
          <div className="ds-center"><TempoKnob value={bpm} min={40} max={240} onChange={setBpm} /></div>
        </section>

        <section className="ds-card" aria-label="Interrupteur et voyants">
          <span className="kicker">Interrupteur et voyants</span>
          <button className="ds-row" onClick={() => setSw(!sw)} aria-pressed={sw}>
            <span>Interrupteur</span>
            <span className={'switch' + (sw ? ' on' : '')}><span /></span>
          </button>
          <div className="ds-row">
            <span>Voyant</span>
            <span className="ds-leds"><span className="led on" /><span className="led" /></span>
          </div>
        </section>

        <section className="ds-card" aria-label="Carte d’idée">
          <span className="kicker">Carte d’idée</span>
          <div className="idea">
            <div className="idea-top">
              <span className="idea-badge riff">{BADGE.riff}</span>
              <div className="idea-titles">
                <span className="idea-title">Riff shuffle en La</span>
                <span className="idea-meta">Riff · aujourd’hui · 0:10</span>
              </div>
              <span className="idea-play">▶</span>
            </div>
            <Wave bars={fakeWave('ds')} progress={0.4} />
            <div className="idea-tags"><span className="tag key">La</span><span className="tag">92 BPM</span><span className="tag">Blues</span><span className="tag">Nostalgique</span></div>
          </div>
        </section>

        <section className="ds-card" aria-label="Diagramme d’accord">
          <span className="kicker">Diagramme d’accord</span>
          <p className="ds-desc">Fondamentale en ambre, cordes à vide ○, étouffées ×, barré, notes ou doigts sur les points.</p>
          <div className="ds-diagrams" data-theme="dark">
            <ChordDiagram v={C} root={0} type={chordType('maj')} labels="notes" />
            <ChordDiagram v={voicings(5, chordType('maj')).find(v => v.shape === 'E')!} root={5} type={chordType('maj')} labels="fingers" />
          </div>
        </section>

        <section className="ds-card" aria-label="Commandes">
          <span className="kicker">Commandes</span>
          <button className="cta ds-static">▶  Action principale</button>
          <div className="confirm-row">
            <button className="btn-primary">Valider</button>
            <button className="btn-outline">Secondaire</button>
          </div>
          <div className="seg" style={{ gridTemplateColumns: 'repeat(3,minmax(0,1fr))' }}>
            {['Couplet', 'Refrain', 'Pont'].map((l, i) => <button key={l} className={sel === i ? 'on' : ''} onClick={() => setSel(i)}>{l}</button>)}
          </div>
          <div className="ds-chips">
            <button className="chip key-chip on-amber">La</button><button className="chip type-chip word on-cream">Majeur</button>
            <button className="chip type-chip word">Mineur</button><button className="chip type-chip">7</button>
          </div>
          <div className="mini-stepper ds-stepper"><button aria-label="Moins">−</button><span className="mono">92 BPM</span><button aria-label="Plus">+</button></div>
        </section>
      </div>
      <TabBar active={0} />
    </Phone>
  );
}
