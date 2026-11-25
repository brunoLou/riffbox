import { Component, type ReactNode } from 'react';

/**
 * When a screen fails, a message instead of a blank page: what happened (to copy and send),
 * and a way out (reload, or back to the home screen). Reset when the address changes.
 */
export class ErrorBoundary extends Component<{ children: ReactNode; resetKey: string }, { error: Error | null; copied: boolean }> {
  state = { error: null as Error | null, copied: false };
  static getDerivedStateFromError(error: Error) { return { error, copied: false }; }
  componentDidUpdate(prev: { resetKey: string }) { if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null }); }
  componentDidCatch(error: Error) { console.error('RIFFBOX', error); }
  render() {
    const e = this.state.error;
    if (!e) return this.props.children;
    const detail = `${e.name}: ${e.message}\n${(e.stack ?? '').split('\n').slice(1, 6).join('\n')}\n${location.hash} · ${navigator.userAgent}`;
    return (
      <main className="phone crash" role="alert">
        <h1 className="display">OUPS</h1>
        <p>Cet écran n’a pas pu s’afficher. Vos données ne sont pas touchées.</p>
        <div className="crash-actions">
          <button className="btn-primary" onClick={() => location.reload()}>Recharger</button>
          <button className="btn-outline" onClick={() => { location.hash = '#/'; }}>Revenir à l’accueil</button>
        </div>
        <details>
          <summary>Détail de l’erreur (à envoyer pour la corriger)</summary>
          <pre className="crash-detail">{detail}</pre>
          <button className="btn-link" onClick={() => void navigator.clipboard?.writeText(detail).then(() => this.setState({ copied: true }))}>
            {this.state.copied ? 'Copié ✓' : 'Copier le détail'}
          </button>
        </details>
      </main>
    );
  }
}
