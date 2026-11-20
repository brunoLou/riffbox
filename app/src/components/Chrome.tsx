import type { CSSProperties, ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

/** The 390×844 device. Full-bleed on real phones, framed on desktop. */
export function Phone({ children, bg, column, label }: { children: ReactNode; bg?: string; column?: boolean; label: string }) {
  const style: CSSProperties = { background: bg };
  return (
    <div className={'phone' + (column ? ' phone-col' : '')} style={style} data-screen-label={label}>
      {children}
    </div>
  );
}

/** Mock status bar. Shown only in the desktop frame; on a phone it is an empty spacer. */
export function StatusBar({ stage }: { stage?: boolean }) {
  return (
    <div className={'statusbar' + (stage ? ' statusbar-stage' : '')}>
      <span>9:41</span>
      <span className="statusbar-right">{stage ? '87%' : '5G · 87%'}</span>
    </div>
  );
}

const TABS = [
  { label: 'Accueil', to: '/' },
  { label: 'Composer', to: '/composer' },
  { label: 'Pratiquer', to: '/pratiquer' },
  { label: 'Scène', to: '/scene' },
];

export function TabBar({ active }: { active: number }) {
  return (
    <nav className="tabbar">
      {TABS.map((t, i) => (
        <Link key={t.to} to={t.to} className={'tab' + (i === active ? ' on' : '')} aria-current={i === active ? 'page' : undefined}>
          {t.label}
        </Link>
      ))}
    </nav>
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
  return <button className="back-btn" onClick={back} aria-label="Retour">‹</button>;
}
