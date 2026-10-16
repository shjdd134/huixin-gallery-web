import { useEffect, useRef, type ReactNode } from 'react';
import { XIcon } from '@phosphor-icons/react';

export function Modal({ title, children, onClose, className = '', closeNotice, hideTitle = false }: { title: string; children: ReactNode; onClose: () => void; className?: string; closeNotice?: ReactNode; hideTitle?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const dialog = ref.current!;
    const before = document.activeElement as HTMLElement | null;
    dialog.showModal();
    // showModal 默认聚焦第一个可聚焦元素（关闭按钮）；把焦点交给标记了 data-autofocus 的主输入。
    const preferred = dialog.querySelector<HTMLElement>('[data-autofocus]');
    if (preferred) preferred.focus();
    document.documentElement.classList.add('dialog-open');
    return () => { dialog.close(); document.documentElement.classList.remove('dialog-open'); before?.focus(); };
  }, []);
  return <dialog ref={ref} className={`modal ${className}`} aria-labelledby="dialog-title" onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closeRef.current(); } }} onCancel={event => { event.preventDefault(); closeRef.current(); }} onClick={event => { if (event.target === event.currentTarget) { const bounds = event.currentTarget.getBoundingClientRect(); if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onClose(); } }}>
    <div className="modal-heading">{hideTitle ? <span id="dialog-title" className="sr-only">{title}</span> : <h2 id="dialog-title">{title}</h2>}<button className="icon-button" onClick={onClose} aria-label="关闭"><XIcon size={22} weight="light" /></button></div>
    {closeNotice}
    {children}
  </dialog>;
}
