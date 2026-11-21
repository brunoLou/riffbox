import { useCallback, useRef } from 'react';

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Keyboard and screen-reader behaviour of a bottom sheet (role="dialog"): focus moves into it on
 * opening (unless the sheet focused something itself), Tab stays inside, Escape closes it, and
 * focus goes back to what opened it. Use the returned callback as the dialog element's ref.
 */
export function useDialog(onClose: () => void) {
  const close = useRef(onClose);
  close.current = onClose;
  const cleanup = useRef<(() => void) | null>(null);

  return useCallback((el: HTMLElement | null) => {
    cleanup.current?.();
    cleanup.current = null;
    if (!el) return;
    const opener = document.activeElement as HTMLElement | null;
    const focusables = () => [...el.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(x => x.getClientRects().length > 0);
    if (!el.hasAttribute('tabindex')) el.tabIndex = -1;
    el.setAttribute('aria-modal', 'true');
    const raf = requestAnimationFrame(() => { if (!el.contains(document.activeElement)) (focusables()[0] ?? el).focus(); });

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close.current(); return; }
      if (e.key !== 'Tab') return;
      const f = focusables();
      if (!f.length) { e.preventDefault(); return; }
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === el)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    el.addEventListener('keydown', onKey);
    cleanup.current = () => {
      cancelAnimationFrame(raf);
      el.removeEventListener('keydown', onKey);
      // Back to the button that opened the sheet, if it is still there and nothing else took focus.
      if (opener && document.contains(opener) && (!document.activeElement || document.activeElement === document.body || el.contains(document.activeElement))) {
        opener.focus();
      }
    };
  }, []);
}

/** True while a modal sheet is open (keyboard shortcuts such as the pedal pause meanwhile). */
export const modalOpen = () => !!document.querySelector('[aria-modal="true"]');
