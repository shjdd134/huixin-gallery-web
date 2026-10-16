import { useEffect, useRef, useState } from 'react';
import { PlusIcon } from '@phosphor-icons/react';
import { appendJournal, updateJournal, removeJournal, restoreJournal, storageError, type Collection, type JournalEntry } from '../data/db';
import { useAutoSizeTextarea } from './useAutoSizeTextarea';
type Writing = { text: string; entry?: JournalEntry };
export function Journal({ item, removed, disabled, guard, onStateChange }: {
  item: Collection; removed: boolean; disabled: boolean; guard: (action: () => void) => void;
  onStateChange: (state: { dirty: boolean; busy: boolean }) => void;
}) {
  const [writing, setWriting] = useState<Writing>({ text: '' }), [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState<string>(), [undo, setUndo] = useState<{ entry: JournalEntry; index: number }>();
  const [error, setError] = useState<{ text: string; id?: string; writing?: boolean }>();
  const [message, setMessage] = useState<{ text: string; id?: string }>();
  const entryMissing = !!writing?.entry && !item.journal.some(entry => entry.id === writing.entry!.id);
  const input = useAutoSizeTextarea(writing.text, `${writing.entry?.id ?? 'new'}:${entryMissing ? 'missing' : 'present'}`), undoButton = useRef<HTMLButtonElement>(null);
  const [focusTarget, setFocusTarget] = useState<string>();
  const errorRef = useRef<HTMLParagraphElement>(null);
  const dirty = writing.entry ? writing.text !== writing.entry.text : !!writing.text.trim();
  const locked = busy || disabled;
  useEffect(() => { onStateChange({ dirty, busy }); }, [dirty, busy, onStateChange]);
  useEffect(() => { if (writing.entry) input.current?.focus(); }, [writing.entry?.id]);
  useEffect(() => {
    if (focusTarget && item.journal.some(entry => entry.id === focusTarget)) {
      const id = focusTarget; setFocusTarget(undefined);
      requestAnimationFrame(() => { const row = document.getElementById(`journal-${id}`); row?.focus({ preventScroll: true }); row?.scrollIntoView({ block: 'start' }); });
    }
  }, [focusTarget, item.journal]);
  useEffect(() => { if (error) { errorRef.current?.scrollIntoView({ block: 'nearest' }); errorRef.current?.focus({ preventScroll: true }); } }, [error]);
  useEffect(() => {
    if (writing?.entry && !dirty) {
      const current = item.journal.find(entry => entry.id === writing.entry!.id);
      if (current && current !== writing.entry) setWriting({ text: current.text, entry: current });
    }
  }, [item.journal]);
  function locate(id: string) { setFocusTarget(id); }
  function cancel() {
    const action = () => { const id = writing.entry?.id; setWriting({ text: '' }); setError(undefined); requestAnimationFrame(() => { if (id) locate(id); else input.current?.focus(); }); };
    if (dirty) guard(action); else action();
  }
  async function save() {
    if (!writing || locked || removed || entryMissing || !writing.text.trim()) return;
    setBusy(true); setError(undefined); setMessage(undefined);
    try {
      const saved = writing.entry ? await updateJournal(item.id, writing.entry, writing.text) : await appendJournal(item.id, writing.text);
      setWriting({ text: '' }); setMessage({ text: writing.entry ? '手记修改已保存' : '手记已保存', id: saved.id }); locate(saved.id);
    } catch (reason) { setError({ text: storageError(reason), writing: true }); }
    finally { setBusy(false); }
  }
  async function remove(entry: JournalEntry, index: number) {
    if (locked || removed) return;
    setBusy(true); setError(undefined);
    try {
      await removeJournal(item.id, entry); setDeleting(undefined); setUndo({ entry, index }); setMessage({ text: '手记已删除，本次关闭详情前可以撤销最近一次删除。' });
      requestAnimationFrame(() => { undoButton.current?.focus(); undoButton.current?.scrollIntoView({ block: 'nearest' }); });
    } catch (reason) { setError({ text: storageError(reason), id: entry.id }); }
    finally { setBusy(false); }
  }
  async function restore() {
    if (!undo || locked || removed) return;
    setBusy(true); setError(undefined);
    try { await restoreJournal(item.id, undo.entry, undo.index); setUndo(undefined); setMessage({ text: '手记已恢复', id: undo.entry.id }); locate(undo.entry.id); }
    catch (reason) { setError({ text: storageError(reason) }); }
    finally { setBusy(false); }
  }
  const editor = <div className={`detail-writing direct-writing ${writing.entry ? 'journal-editing' : 'journal-composer'}`}>
    {entryMissing && <p className="inline-error" role="alert">原手记已在另一个页面删除，输入仍保留，可以复制后再关闭。</p>}
    <label className="form-field"><span className="sr-only">{writing.entry ? '修改这则手记' : '追加感受'}</span><textarea ref={input} className="writing-input" value={writing.text} onChange={event => setWriting({ ...writing, text: event.target.value })} rows={2} maxLength={10000} placeholder={writing.entry ? undefined : '留下此刻新的感受……'} disabled={locked} /></label>
    {(dirty || writing.entry) && <div className="reason-actions"><button className="button outline" disabled={locked || removed || entryMissing || !writing.text.trim() || !dirty} onClick={() => void save()}>{!writing.entry && <PlusIcon size={16} />}{writing.entry ? '保存手记' : '追加记录'}</button><button className="text-button" disabled={locked} onClick={cancel}>取消手记</button></div>}
    {error?.writing && <p ref={errorRef} tabIndex={-1} className="inline-error" role="alert">{error.text}</p>}
  </div>;
  return <section className="journal" aria-label={item.space === 'game' ? '我的游戏手记' : '后来，我又想起'}>
    <div className="detail-section-heading"><h4>{item.space === 'game' ? '我的游戏手记' : '后来，我又想起'}</h4></div>
    {(!writing.entry || entryMissing) && editor}
    {(undo || message && !message.id) && <div className="journal-feedback"><span role="status">{message && !message.id ? message.text : '已删除一则手记，本次关闭详情前可以撤销最近一次删除。'}</span>{undo && <button ref={undoButton} className="text-button" disabled={locked || removed} onClick={() => void restore()}>撤销删除手记</button>}</div>}
    {error && !error.writing && (!error.id || !item.journal.some(entry => entry.id === error.id)) && <p ref={errorRef} tabIndex={-1} className="inline-error" role="alert">{error.text}</p>}
    {item.journal.map((entry, index) => <div className="journal-entry" key={entry.id} id={`journal-${entry.id}`} tabIndex={-1}>
      <div className="journal-entry-heading"><time dateTime={entry.date}>{new Date(entry.date).toLocaleDateString('zh-CN')}</time><div><button className="text-button" disabled={locked || removed || dirty || !!writing.entry} onClick={() => { setDeleting(undefined); setError(undefined); setMessage(undefined); setWriting({ entry, text: entry.text }); }}>编辑手记</button><button className="text-button muted" disabled={locked || removed || dirty || !!writing.entry} onClick={() => { setError(undefined); setDeleting(entry.id); }}>删除手记</button></div></div>
      {message?.id === entry.id && <span className="detail-saved" role="status">{message.text}</span>}
      {writing?.entry?.id === entry.id ? editor : <p>{entry.text}</p>}
      {deleting === entry.id && <div className="journal-delete-confirm"><span>只删除这则手记？</span><div><button className="text-button" disabled={locked} onClick={() => setDeleting(undefined)}>保留手记</button><button className="text-button danger" disabled={locked || removed} onClick={() => void remove(entry, index)}>确认删除手记</button></div></div>}
      {error?.id === entry.id && <p ref={errorRef} tabIndex={-1} className="inline-error" role="alert">{error.text}</p>}
    </div>)}
  </section>;
}
