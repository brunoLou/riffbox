import { createContext, useContext, useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { QuickCapture } from './QuickCapture';

/** The 390×844 device: full screen on phones and tablets, framed on a computer (presentation). */
/** On a tablet the screen is a centred column, or the whole width with `wide` (stage, grid). */
/**
 * A screen shown as one side of a two-pane layout (a computer's wide window): no tabs, no status bar,
 * no back button (the other pane is the way back).
 */
export const PaneContext = createContext<'left' | 'right' | null>(null);

export function Phone({ children, bg, column, label, theme, wide }: { children: ReactNode; bg?: string; column?: boolean; label: string; theme?: 'dark' | 'light'; wide?: boolean }) {
  const style: CSSProperties = { background: bg };
  const pane = useContext(PaneContext);
  if (pane) return <section className={`pane pane-${pane}` + (column ? ' phone-col' : '')} style={style} data-screen-label={label} aria-label={label}>{children}</section>;
  return (
    <main className={'phone' + (column ? ' phone-col' : '') + (wide ? ' phone-wide' : '')} style={style} data-screen-label={label} data-theme={theme}>
      {children}
    </main>
  );
}

/** Mock status bar. Shown only in the desktop frame; on a phone it is an empty spacer. */
export function StatusBar({ stage }: { stage?: boolean }) {
  if (useContext(PaneContext)) return null;
  return (
    <div className={'statusbar' + (stage ? ' statusbar-stage' : '')} aria-hidden>
      <span>9:41</span>
      <span className="statusbar-right">{stage ? '87%' : '5G · 87%'}</span>
    </div>
  );
}

const TABS = [
  { label: 'Accueil', to: '/' },
  { label: 'Composer', to: '/composer' },
  { label: 'Pratiquer', to: '/pratiquer' },
  { label: 'Live', to: '/scene' },
];

/** Bottom tabs, with « + Idée » in the middle (the quick capture, on every screen with tabs). */
export function TabBar({ active }: { active: number }) {
  const pane = useContext(PaneContext);
  const tab = (t: (typeof TABS)[number], i: number) => (
    <Link key={t.to} to={t.to} className={'tab' + (i === active ? ' on' : '')} aria-current={i === active ? 'page' : undefined}>
      {t.label}
    </Link>
  );
  if (pane) return null;
  return (
    <QuickCapture>
      {idea => <nav className="tabbar" aria-label="Onglets">{TABS.slice(0, 2).map(tab)}{idea}{TABS.slice(2).map((t, i) => tab(t, i + 2))}</nav>}
    </QuickCapture>
  );
}

/** Go back in history, or to `fallback` when the screen was opened directly. */
export function useBack(fallback: string) {
  const nav = useNavigate();
  const loc = useLocation();
  return () => (loc.key === 'default' ? nav(fallback) : nav(-1));
}

export function BackButton({ fallback }: { fallback: string }) {
  const back = useBack(fallback);
  if (useContext(PaneContext)) return null;
  return <button className="back-btn" onClick={back} aria-label="Retour">‹</button>;
}

/** A computer's wide window (a mouse, and room for two panes). */
const WIDE = '(min-width: 1200px) and (hover: hover) and (pointer: fine)';
export function useWideDesktop() {
  const [wide, setWide] = useState(() => typeof matchMedia !== 'undefined' && matchMedia(WIDE).matches);
  useEffect(() => {
    const m = matchMedia(WIDE);
    const on = () => setWide(m.matches);
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, []);
  return wide;
}

/** Two screens side by side: a list on the left, what is chosen on the right. */
export function SplitView({ label, tab, left, right }: { label: string; tab: number; left: ReactNode; right: ReactNode }) {
  return (
    <main className="phone phone-wide phone-split" data-screen-label={label}>
      <div className="split">
        <PaneContext.Provider value="left">{left}</PaneContext.Provider>
        <PaneContext.Provider value="right">{right}</PaneContext.Provider>
      </div>
      <TabBar active={tab} />
    </main>
  );
}

/** The right pane before anything is chosen. */
export function PaneEmpty({ text }: { text: string }) {
  return <section className="pane pane-right pane-empty"><p>{text}</p></section>;
}
