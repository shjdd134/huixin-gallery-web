import { useEffect, useRef, useState } from 'react';
import { PencilSimpleIcon, TrashIcon } from '@phosphor-icons/react';
import { db, saveCollection, storageError, type Collection } from '../data/db';
import { getSpace, subtypeLabel } from '../data/spaces';
import { useBlobUrl } from './Image';
import { Modal } from './Modal';
import { CollectionCover } from './CollectionCover';
import { useDraftGuard } from './DraftGuard';
import { Journal } from './Journal';
import { useAutoSizeTextarea } from './useAutoSizeTextarea';

export function Detail({ item, removed = false, onClose, onEdit, onDeleted, onDiscover }: { removed?: boolean; onDiscover: () => void; item: Collection; onClose: () => void; onEdit: (item: Collection) => void; onDeleted: () => void }) {
  const [reasonDraft, setReasonDraft] = useState(() => ({ text: item.note, baseline: item }));
  const [reasonSaved, setReasonSaved] = useState(false);
  const [journalState, setJournalState] = useState({ dirty: false, busy: false });
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState('');
  const [errorScope, setErrorScope] = useState<'reason' | 'delete'>('reason');
  const [busy, setBusy] = useState(false);
  const reasonInput = useAutoSizeTextarea(reasonDraft.text);
  const latestItem = useRef(item);
  latestItem.current = item;
  const reasonDirty = reasonDraft.text !== reasonDraft.baseline.note;
  const locked = busy || journalState.busy;
  const { guard, notice } = useDraftGuard(reasonDirty || journalState.dirty, locked);
  const cover = useBlobUrl(item.cover);
  const space = getSpace(item.space);
  const introduction = item.introduction;
  const introductionLabel = item.space === 'music' && item.subtype === 'artist' ? '歌手简介' : item.space === 'person' ? '人物简介' : '作品简介';

  useEffect(() => {
    setReasonDraft(old => old.text === old.baseline.note ? { text: item.note, baseline: item } : old);
  }, [item]);
  function cancelReason() {
    const cancel = () => { const current = latestItem.current; setReasonDraft({ text: current.note, baseline: current }); setError(''); setReasonSaved(false); requestAnimationFrame(() => reasonInput.current?.focus()); };
    if (reasonDirty) guard(cancel); else cancel();
  }
  async function saveReason() {
    if (locked || removed) return false;
    setErrorScope('reason');
    setBusy(true); setError(''); setReasonSaved(false);
    try {
      const saved = await saveCollection({ ...reasonDraft.baseline, note: reasonDraft.text }, reasonDraft.baseline);
      setReasonDraft({ text: saved.note, baseline: saved }); setReasonSaved(true); return true;
    } catch (reason) { setError(storageError(reason)); return false; }
    finally { setBusy(false); }
  }
  async function discover() {
    if (locked || removed) return;
    if (reasonDirty && !(await saveReason())) return;
    if (journalState.dirty) guard(onDiscover); else onDiscover();
  }
  async function remove() {
    if (locked || removed) return;
    setErrorScope('delete');
    setBusy(true); setError('');
    try { await db.collections.delete(item.id); onDeleted(); }
    catch (reason) { setError(storageError(reason)); setBusy(false); }
  }

  return <Modal title={item.title} hideTitle onClose={() => guard(onClose)} closeNotice={notice} className="detail-modal">
    {removed && <p className="inline-error" role="alert">这件收藏已在另一个页面移除。未保存文字仍留在这里，可以复制后再关闭。</p>}
    <div className="detail-main">
      <div className={`detail-cover ${cover ? '' : 'no-cover'}`}>{cover ? <img src={cover} alt={`${item.title}的封面`} /> : <CollectionCover item={item} />}</div>
      <div className="detail-heading">
        <p className="detail-meta">{space.title} · {subtypeLabel(item.subtype) || (item.space === 'film' ? '电影' : space.category)}</p>
        <h3>{item.title}</h3>
        {item.creator && <p className="detail-creator">{item.creator}</p>}
        <button className="text-button detail-edit" aria-label="编辑收藏" onClick={() => guard(() => onEdit(item))} disabled={locked || removed}><PencilSimpleIcon size={17} /><span>编辑收藏</span></button>
      </div>
      {introduction?.text && <section className="detail-introduction" aria-label={introductionLabel}>
        <h4>{introductionLabel}</h4><p>{introduction.text}</p>
        <div className="introduction-source"><span>{introduction.kind === 'official-summary' ? '据官方资料整理' : '自行编辑'}</span>{introduction.sourceUrl && <a href={introduction.sourceUrl} target="_blank" rel="noopener noreferrer">{introduction.sourceName || '参考来源'} ↗</a>}</div>
      </section>}
    </div>
    <section className="detail-note" aria-label={space.noteLabel}>
      <div className="detail-section-heading"><h4>{space.noteLabel}</h4></div>
      <div className="detail-writing direct-writing">
        <textarea ref={reasonInput} className="personal-note reason-input writing-input" aria-label={space.noteLabel} value={reasonDraft.text} onChange={event => { setReasonDraft(old => ({ ...old, text: event.target.value })); setReasonSaved(false); }} placeholder="写下喜欢的理由，或一个打动你的片段……" rows={2} maxLength={10000} disabled={locked} />
        {reasonDirty && <div className="reason-actions"><button className="button outline" disabled={locked || removed} onClick={() => void saveReason()}>保存理由</button><button className="text-button" disabled={locked} onClick={cancelReason}>取消编辑</button></div>}
      </div>
      {error && errorScope === 'reason' && <p className="inline-error" role="alert">{error}</p>}
      {reasonSaved && <span className="detail-saved" role="status">理由已保存</span>}
      {item.tags.length > 0 && <div className="tags">{item.tags.map(tag => <span key={tag}>{tag}</span>)}</div>}
      {item.filmList && <p className="film-list-note">私藏影单 · {item.filmList}</p>}
      {item.encounterText && <p className="detail-encounter">什么时候遇见 · {item.encounterText}</p>}
      {item.quote && <blockquote className="detail-quote"><p>{item.quote}</p></blockquote>}
      <button className="text-button detail-discovery" onClick={() => void discover()} disabled={locked || removed}>沿着这些理由探索兴趣</button>
    </section>
    <Journal item={item} removed={removed} disabled={locked} guard={guard} onStateChange={setJournalState} />
    {error && errorScope === 'delete' && <p className="inline-error" role="alert">{error}</p>}
    <div className="detail-bottom"><span>加入于 {new Date(item.createdAt).toLocaleDateString('zh-CN')}</span>{confirmDelete ? <div className="delete-confirm"><span>确定移除这份收藏？</span><button className="text-button" disabled={locked} onClick={() => setConfirmDelete(false)}>保留</button><button className="text-button danger" disabled={locked || removed} onClick={() => void remove()}>确认移除</button></div> : <button className="text-button muted" disabled={locked || removed} onClick={() => setConfirmDelete(true)}><TrashIcon size={15} />移除收藏</button>}</div>
  </Modal>;
}

