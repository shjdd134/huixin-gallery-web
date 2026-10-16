import { useMemo, useState } from 'react';
import { CheckIcon } from '@phosphor-icons/react';
import { Modal } from '../../components/Modal';
import { storageError, type Collection } from '../../data/db';
import { addCollectionsBatch } from '../../data/batch';
import { undoImportedCollections } from '../../data/undo-import';
import { defaultSubtype, getSpace, subtypeLabel, type SpaceId } from '../../data/spaces';
import { classifyMixed, destinationValue, destinations, mixedIncluded, parseMixedList, readDestination, type IntakeGroup, type MixedEntry } from './mixed';
import './mixed.css';

export interface MixedSummary { added: Collection[]; skipped: number; failed: { name: string; reason: string }[]; undone?: boolean; message?: string; draft?: { text: string; groups: IntakeGroup[]; entries: MixedEntry[]; reviewLines: number[] } }
function DestinationOptions() { return <><option value="">待选择类别</option>{destinations.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</>; }
export function MixedIntakePanel({ initialSpace, initialSubtype, items, initialSummary, onClose, onDone, onOpenItem }: {
  initialSpace?: SpaceId; initialSubtype?: string; items: Collection[]; initialSummary?: MixedSummary;
  onClose: () => void; onDone: (added: Collection[]) => void; onOpenItem: (item: Collection, summary: MixedSummary) => void;
}) {
  const fallback = initialSpace ? { space: initialSpace, subtype: initialSubtype ?? defaultSubtype(initialSpace) } : {};
  const [text, setText] = useState(initialSummary?.draft?.text ?? '');
  const [groups, setGroups] = useState<IntakeGroup[]>(initialSummary?.draft?.groups ?? []);
  const [drafts, setDrafts] = useState<MixedEntry[]>(initialSummary?.draft?.entries ?? []);
  const [reviewLines, setReviewLines] = useState<number[]>(initialSummary?.draft?.reviewLines ?? []);
  const [summary, setSummary] = useState(initialSummary);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [undoConfirm, setUndoConfirm] = useState(false);
  const entries = useMemo(() => classifyMixed(drafts, items), [drafts, items]);
  const included = entries.filter(mixedIncluded);
  // Keep rows in their original review section while editing: changing status
  // must not unmount the focused input halfway through a name.
  const questions = entries.filter(e => reviewLines.includes(e.line));
  const ready = entries.filter(e => !reviewLines.includes(e.line));
  function changeText(value: string) {
    const parsed = parseMixedList(value, fallback);
    // Re-pasting preserves edits only for the exact same source line and group.
    const nextGroups = parsed.groups.map(g => groups.find(old => old.id === g.id && old.label === g.label) ?? g);
    setGroups(nextGroups); setText(value); setError('');
    const nextDrafts = parsed.entries.map(e => {
      const group = nextGroups.find(g => g.id === e.group)!;
      const sourceGroup = groups.find(g => g.id === e.group);
      const previous = drafts.find(old => old.line === e.line && old.raw === e.raw && old.group === e.group);
      if (previous && sourceGroup?.label === group.label) return previous;
      return { ...e, name: previous?.name ?? e.name, creator: previous?.creator ?? e.creator, space: group.space, subtype: group.subtype };
    });
    setDrafts(nextDrafts);
    setReviewLines(classifyMixed(nextDrafts, items).filter(e => e.status !== 'ok').map(e => e.line));
  }
  function changeGroup(groupId: string, value: string) {
    const destination = readDestination(value);
    setGroups(groups.map(g => g.id === groupId ? { id: g.id, label: g.label, ...destination } : g));
    setDrafts(drafts.map(e => e.group === groupId ? { ...e, space: destination.space, subtype: destination.subtype, keep: undefined } : e));
  }
  function changeEntry(line: number, patch: Partial<MixedEntry>) { setDrafts(drafts.map(e => e.line === line ? { ...e, ...patch } : e)); }
  async function save() {
    if (busy || !included.length) return;
    setBusy(true); setError('');
    try {
      const result = await addCollectionsBatch(included.map(e => ({ space: e.space!, subtype: e.subtype, title: e.name, creator: e.creator, allowDuplicate: e.status === 'duplicate' ? true : undefined })));
      const failedIndexes = new Set(result.failed.map(f => f.index));
      const handledLines = new Set(included.filter((_, index) => !failedIndexes.has(index)).map(e => e.line));
      const remainingDrafts = drafts.map(e => handledLines.has(e.line) ? { ...e, keep: false } : e);
      setDrafts(remainingDrafts);
      setSummary({ added: result.items, skipped: entries.length - result.added - result.failed.length, failed: result.failed.map(f => ({ name: f.title, reason: f.reason })), draft: { text, groups, entries: remainingDrafts, reviewLines } });
    } catch (reason) { setError(storageError(reason)); }
    finally { setBusy(false); }
  }
  async function undo() {
    if (busy || !summary) return;
    setBusy(true); setError('');
    try {
      const result = await undoImportedCollections(summary.added);
      setSummary({ ...summary, added: summary.added.filter(i => result.retained.includes(i.id)), undone: true, message: `已撤销 ${result.removed.length} 件；保留 ${result.retained.length} 件已改动的收藏。${result.missing.length ? `另有 ${result.missing.length} 件已被移除。` : ''}` });
      setUndoConfirm(false);
    } catch (reason) { setError(storageError(reason)); }
    finally { setBusy(false); }
  }
  const row = (entry: MixedEntry) => <li key={entry.line} className={`mixed-row is-${entry.status}`}>
    <label className="mixed-check"><input type="checkbox" aria-label={`添加第 ${entry.line} 行`} checked={mixedIncluded(entry)} disabled={busy || entry.status === 'invalid' || entry.status === 'unclassified'} onChange={() => changeEntry(entry.line, { keep: !mixedIncluded(entry) })} /><span>第 {entry.line} 行</span></label>
    <div className="mixed-row-fields"><input aria-label={`第 ${entry.line} 行名称`} value={entry.name} maxLength={120} disabled={busy} onChange={event => changeEntry(entry.line, { name: event.target.value, keep: undefined })} />
      <input aria-label={`第 ${entry.line} 行创作者`} value={entry.creator} placeholder="创作者（选填）" maxLength={120} disabled={busy} onChange={event => changeEntry(entry.line, { creator: event.target.value })} />
      <select aria-label={`第 ${entry.line} 行分类`} value={destinationValue(entry)} disabled={busy} onChange={event => changeEntry(entry.line, { space: undefined, subtype: undefined, ...readDestination(event.target.value), keep: undefined })}><DestinationOptions /></select></div>
    {entry.reason ? <p className="mixed-reason">{entry.reason}{entry.status === 'duplicate' ? '；勾选可作为另一件收藏加入。' : ''}</p> : <p className="intake-hint">已明确，可加入。</p>}
  </li>;
  return <Modal title="导入清单" className="mixed-intake-modal" onClose={() => { if (!busy) onClose(); }}>
    {summary ? <>
      <div className="intake-stats" role="status"><strong>{summary.undone ? '撤销结果' : '这份清单已经加入馆藏。'}</strong>{!summary.undone && <span>新增 {summary.added.length} · 跳过 {summary.skipped} · 失败 {summary.failed.length}</span>}{summary.message && <p>{summary.message}</p>}</div>
      {summary.failed.map((f, index) => <p className="inline-error" key={index}>{f.name}：{f.reason}</p>)}
      <div className="intake-added">{summary.added.map(item => <button className="search-result" key={item.id} onClick={() => onOpenItem(item, summary)} disabled={busy}><span className="search-result-icon"><CheckIcon size={22} /></span><span><strong>{item.title}</strong><small>{getSpace(item.space).title} · {subtypeLabel(item.subtype) || '收藏'}</small></span></button>)}</div>
      {!summary.undone && summary.added.length > 0 && <div className="mixed-undo">{undoConfirm ? <><p>仅移除本次新增且尚未改动的收藏。补写过感受、封面或其他内容的收藏会保留。</p><button className="button outline" disabled={busy} onClick={() => void undo()}>确认撤销</button><button className="text-button" disabled={busy} onClick={() => setUndoConfirm(false)}>取消撤销</button></> : <><button className="text-button" disabled={busy} onClick={() => setUndoConfirm(true)}>撤销本次导入</button><small>可在关闭此结果页前撤销。</small></>}</div>}
      <div className="modal-footer"><button className="button outline" disabled={busy} onClick={() => { setSummary(undefined); setUndoConfirm(false); }}>继续导入</button><button className="button primary" disabled={busy} onClick={() => onDone(summary.added)}>完成</button></div>
    </> : <>
      <p className="modal-intro">粘贴书、歌曲、游戏等清单，一行一件。用「书：」「歌曲：」「游戏：」分组，可以一次加入多个空间。</p>
      <label className="form-field"><span>要导入的清单</span><textarea autoFocus data-autofocus rows={7} value={text} disabled={busy} onChange={event => changeText(event.target.value)} placeholder={'书：\n1. 《作品名称》 — 作者\n歌曲：\n歌曲名称 — 歌手\n游戏：\n游戏名称'} /></label>
      {entries.length > 0 && <>
        <div className="mixed-groups">{groups.map(group => <label className="form-field" key={group.id}><span>{group.label} · {entries.filter(e => e.group === group.id).length} 件</span><select aria-label={`分组 ${group.label} 的分类`} value={destinationValue(group)} disabled={busy} onChange={event => changeGroup(group.id, event.target.value)}><DestinationOptions /></select></label>)}</div>
        <p className="intake-count" aria-live="polite">可加入 {included.length} 件 · 重复 {entries.filter(e => e.status === 'duplicate').length} 件 · 待分类 {entries.filter(e => e.status === 'unclassified').length} 件 · 无效 {entries.filter(e => e.status === 'invalid').length} 件</p>
        <p className="intake-hint">类别来自你的分组与选择，不根据作品名猜测。同名默认跳过；创作者可修改，封面和喜欢的理由以后再补。</p>
        {questions.length > 0 && <section className="mixed-questions"><h3>先看这 {questions.length} 件</h3><ul className="mixed-list">{questions.map(row)}</ul></section>}
        {ready.length > 0 && <details className="mixed-ready" open={questions.length === 0}><summary>查看其他 {ready.length} 件，可以改名或取消勾选</summary><ul className="mixed-list">{ready.map(row)}</ul></details>}
      </>}
      <div className="modal-footer"><div className="footer-side"><span>只保存在这台设备</span>{text && <button className="text-button" disabled={busy} onClick={() => { setText(''); setDrafts([]); setGroups([]); setReviewLines([]); setError(''); }}>清空重来</button>}</div><button className="button primary" disabled={busy || included.length === 0} onClick={() => void save()}>{busy ? '正在加入' : `加入 ${included.length} 件收藏`}</button></div>
      {entries.length > included.length && <p className="intake-hint">未勾选、未分类和无效的 {entries.length - included.length} 件不会导入，可在完成后继续处理。</p>}
    </>}
    {error && <p className="inline-error" role="alert">{error}</p>}
  </Modal>;
}
