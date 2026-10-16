import { useLayoutEffect, useRef } from 'react';

// Grow ordinary notes to their content; keep very long drafts scrollable.
// Width observation also measures the textarea after its dialog becomes visible.
export function useAutoSizeTextarea(value: string, position?: string) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const resize = () => {
    const input = ref.current;
    if (!input || !input.clientWidth) return;
    const modal = input.closest('dialog');
    const modalScroll = modal?.scrollTop;
    const inputScroll = input.scrollTop;
    input.style.height = '0px';
    input.style.height = `${Math.max(56, Math.min(input.scrollHeight, 280))}px`;
    input.scrollTop = inputScroll;
    if (modal && modalScroll !== undefined) modal.scrollTop = modalScroll;
  };
  useLayoutEffect(resize, [value, position]);
  useLayoutEffect(() => {
    const input = ref.current;
    if (!input) return;
    let width = -1;
    let active = true;
    const observer = new ResizeObserver(entries => {
      const nextWidth = entries[0]?.contentRect.width ?? 0;
      if (Math.abs(nextWidth - width) > .5) { width = nextWidth; resize(); }
    });
    observer.observe(input);
    void document.fonts.ready.then(() => { if (active) resize(); });
    return () => { active = false; observer.disconnect(); };
  }, [position]);
  return ref;
}
