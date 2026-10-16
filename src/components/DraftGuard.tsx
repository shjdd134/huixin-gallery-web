import { useEffect, useRef, useState } from 'react';

const draftNavigationEvent = 'huixin:leave-draft';
export function requestDraftNavigation(continueNavigation: () => void) {
  return window.dispatchEvent(new CustomEvent(draftNavigationEvent, { cancelable: true, detail: continueNavigation }));
}

/** Protect unsaved writing without treating a draft as a saved collection. */
export function useDraftGuard(dirty: boolean, busy = false) {
  const [pending, setPending] = useState<{ run: () => void } | null>(null);
  useEffect(() => {
    if (!dirty) { setPending(null); return; }
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  useEffect(() => {
    if (!dirty && !busy) return;
    const protect = (event: Event) => {
      event.preventDefault();
      if (!busy) setPending({ run: (event as CustomEvent<() => void>).detail });
    };
    window.addEventListener(draftNavigationEvent, protect);
    return () => window.removeEventListener(draftNavigationEvent, protect);
  }, [dirty, busy]);
  function guard(action: () => void) {
    if (busy) return;
    if (dirty) setPending({ run: action }); else action();
  }
  const notice = pending ? <DraftNotice
    onContinue={() => setPending(null)}
    onDiscard={() => { if (!busy) { setPending(null); pending.run(); } }}
    busy={busy}
  /> : null;
  return { guard, notice };
}

function DraftNotice({ onContinue, onDiscard, busy }: { onContinue: () => void; onDiscard: () => void; busy: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.scrollIntoView({ block: 'nearest' });
    ref.current?.querySelector<HTMLButtonElement>('button')?.focus();
    return () => { if (previous?.isConnected) previous.focus(); };
  }, []);
  return <div ref={ref} className="draft-notice" role="alert">
    <p>这次输入还没有保存。</p>
    <span>继续填写并保存，或明确放弃这次输入。</span>
    <div><button type="button" className="button outline" onClick={onContinue}>继续填写</button>
      <button type="button" className="text-button danger" disabled={busy} onClick={onDiscard}>放弃输入并继续</button></div>
  </div>;
}
