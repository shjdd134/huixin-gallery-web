import { useMemo, useState } from 'react';
import { CheckIcon } from '@phosphor-icons/react';
import { Modal } from '../../components/Modal';
import { storageError, type Collection } from '../../data/db';
import { addCollectionsBatch } from '../../data/batch';
import { defaultSubtype, getSpace, spaces, type SpaceId } from '../../data/spaces';
import { entryIncluded, intakeTitleLimit, markDuplicates, parseIntakeLines, validateEntryName, type IntakeEntry } from './parse';

const subtypeOptions: Partial<Record<SpaceId, { value: string; label: string }[]>> = {
  book: [{ value: 'traditional', label: '传统文学' }, { value: 'web', label: '网文' }, { value: 'light', label: '轻小说' }],
  film: [{ value: 'movie', label: '电影' }, { value: 'series', label: '电视剧' }],
  music: [{ value: 'song', label: '歌曲' }, { value: 'artist', label: '歌手' }],
};

function statusLabel(entry: IntakeEntry) {
  if (entry.status === 'blank') return '空行';
  if (entry.status === 'invalid') return entry.reason;
  if (entry.status === 'duplicate') return '疑似重复';
  return '可添加';
}

export interface IntakeSummary { added: Collection[]; skipped: number; failed: { name: string; reason: string }[]; space: SpaceId; subtype?: string }

export function IntakePanel({ initialSpace, items, initialSummary, onClose, onOpenItem, onDone }: {
  initialSpace: SpaceId;
  items: Collection[];
  initialSummary?: IntakeSummary | null;
  onClose: () => void;
  onOpenItem: (item: Collection, summary: IntakeSummary) => void;
  onDone: (added: Collection[]) => void;
}) {
  // 返回摘要（从详情关闭后）时按摘要里保存的实际空间/分类恢复，而不是入口的 initialSpace。
  const [space, setSpace] = useState<SpaceId>(initialSummary?.space ?? initialSpace);
  const [subtype, setSubtype] = useState(initialSummary?.subtype ?? defaultSubtype(initialSummary?.space ?? initialSpace));
  const [text, setText] = useState('');
  const [entries, setEntries] = useState<IntakeEntry[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [summary, setSummary] = useState<IntakeSummary | null>(initialSummary ?? null);
  const spaceMeta = getSpace(space);
  const options = subtypeOptions[space];

  // 重新解析时保留用户改过的名称和勾选：原始行相同就沿用之前的编辑，并按新名称重算合法性。
  function rebuild(nextText: string, nextSpace: SpaceId, previous: IntakeEntry[]) {
    const merged = parseIntakeLines(nextText).map((entry, index) => {
      const before = previous[index];
      if (!before || before.raw !== entry.raw || entry.status === 'blank' || !before.name) return entry;
      const validity = validateEntryName(before.name);
      return { ...entry, name: before.name, status: validity.status, reason: validity.reason, keep: before.keep };
    });
    return markDuplicates(merged, nextSpace, items);
  }
  function changeText(value: string) { setText(value); setEntries(rebuild(value, space, entries)); }
  function changeSpace(next: SpaceId) { setSpace(next); setSubtype(defaultSubtype(next)); setEntries(rebuild(text, next, entries)); }
  function changeName(index: number, name: string) {
    setEntries(markDuplicates(entries.map((entry, i) => {
      if (i !== index || entry.status === 'blank') return entry;
      const validity = validateEntryName(name);
      return { ...entry, name, status: validity.status, reason: validity.reason };
    }), space, items));
  }
  function toggle(index: number) {
    setEntries(entries.map((entry, i) => (i === index ? { ...entry, keep: !entryIncluded(entry) } : entry)));
  }
  function reset() { setText(''); setEntries([]); setError(''); }

  const stats = useMemo(() => ({
    total: entries.length,
    included: entries.filter(entryIncluded).length,
    duplicate: entries.filter(entry => entry.status === 'duplicate').length,
    invalid: entries.filter(entry => entry.status === 'invalid').length,
    blank: entries.filter(entry => entry.status === 'blank').length,
  }), [entries]);

  async function save() {
    if (busy || stats.included === 0) return;
    setBusy(true); setError('');
    const targets = entries.filter(entryIncluded);
    try {
      // 走数据契约的批量接口：一个事务内写入。重复保护在提交时对照最新馆藏：
      // 只有用户在预览中明确勾选「仍然添加」的疑似重复条目（allowDuplicate）才作为新收藏写入，
      // 其余重复一律跳过；预览之后馆藏里新出现的同名条目同样会被拦下，不会强行添加。
      const result = await addCollectionsBatch(
        targets.map(entry => ({ space, subtype: options ? subtype : undefined, title: entry.name.trim(), allowDuplicate: entry.status === 'duplicate' ? true : undefined })),
      );
      const failed = result.failed.map(item => ({ name: item.title || `第 ${targets[item.index].line} 行`, reason: item.reason }));
      // 摘要携带保存时实际选择的空间/分类：返回摘要与继续录入都按它恢复，而不是入口空间。
      setSummary({ added: result.items, failed, skipped: entries.length - result.added - failed.length, space, subtype: options ? subtype : undefined });
    } catch (reason) {
      // 数据库级错误会让整个批次回滚，现有馆藏不变。
      setError(storageError(reason));
    }
    setBusy(false);
  }

  return <Modal title="批量录入" onClose={() => { if (!busy) onClose(); }} className="intake-modal">
    {summary ? <>
      <div className="intake-stats" role="status">
        <strong>已把 {summary.added.length} 件收藏放进{spaceMeta.title}。</strong>
        <span>新增 {summary.added.length} · 跳过 {summary.skipped} · 失败 {summary.failed.length}</span>
      </div>
      {summary.failed.length > 0 && <div className="intake-failed">{summary.failed.map(item => <p key={item.name}>{item.name}：{item.reason}</p>)}</div>}
      {summary.added.length > 0 && <>
        <p className="intake-count">新增的收藏，点击可直接查看：</p>
        <div className="intake-added">
          {summary.added.map(item => <button key={item.id} className="search-result" onClick={() => onOpenItem(item, summary)}>
            <span className="search-result-icon"><CheckIcon size={22} weight="light" /></span>
            <span><strong>{item.title}</strong><small>{spaceMeta.title}{options ? ` · ${subtypeOptions[space]?.find(option => option.value === item.subtype)?.label ?? ''}` : ''}</small></span>
          </button>)}
        </div>
      </>}
      {error && <p className="inline-error" role="alert">{error}</p>}
      <div className="modal-footer"><div className="footer-side"><span>只保存在这台设备</span></div>
        <div className="intake-done-actions">
          <button type="button" className="button outline" disabled={busy} onClick={() => { setSummary(null); setEntries(rebuild(text, space, entries)); }}>继续录入</button>
          <button type="button" className="button primary" disabled={busy} onClick={() => onDone(summary.added)}><CheckIcon size={19} weight="light" />完成</button>
        </div>
      </div>
    </> : <>
      <p className="modal-intro">粘贴书单、片单或想收藏的名称，一行一件，支持常见编号。只填名称，其余以后慢慢补。</p>
      <div className="form-row intake-options">
        <label className="form-field"><span>放进哪个空间</span><select value={space} onChange={event => changeSpace(event.target.value as SpaceId)}>{spaces.filter(option => option.id !== 'website').map(option => <option key={option.id} value={option.id}>{option.title}</option>)}</select></label>
        {options && <label className="form-field"><span>类别</span><select value={subtype} onChange={event => setSubtype(event.target.value)}>{options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>}
      </div>
      <label className="form-field"><span>书单、片单或名称列表</span><textarea autoFocus data-autofocus className="intake-textarea" value={text} onChange={event => changeText(event.target.value)} placeholder={'例如：\n1. 某件作品\n2、某件作品\n（3）某件作品\n- 深空彼岸'} /></label>
      {entries.length > 0 && <>
        <p className="intake-hint">预览里可以直接改名。疑似重复默认跳过，勾选后仍会作为新收藏添加，不会覆盖已有收藏。</p>
        <p className="intake-count" aria-live="polite">共 {stats.total} 行：可添加 {stats.included} 件 · 疑似重复 {stats.duplicate} 项 · 无效 {stats.invalid} 项 · 空行 {stats.blank} 项</p>
        <ul className="intake-preview">
          {entries.map((entry, index) => <li key={entry.line} className={`intake-row is-${entry.status}`}>
            <label><input type="checkbox" checked={entryIncluded(entry)} disabled={entry.status === 'invalid' || entry.status === 'blank'} aria-label={`添加第 ${entry.line} 行`} onChange={() => toggle(index)} /></label>
            <input value={entry.name} disabled={entry.status === 'blank'} maxLength={intakeTitleLimit} aria-label={`第 ${entry.line} 行名称`} placeholder={entry.status === 'blank' ? '（空行）' : ''} onChange={event => changeName(index, event.target.value)} />
            <span className="intake-status" title={entry.reason}>{statusLabel(entry)}</span>
          </li>)}
        </ul>
      </>}
      {error && <p className="inline-error" role="alert">{error}</p>}
      <div className="modal-footer">
        <div className="footer-side"><span>只保存在这台设备</span>{text && <button type="button" className="text-button" onClick={reset}>清空重来</button>}</div>
        <button type="button" className="button primary" disabled={busy || stats.included === 0} onClick={() => void save()}><CheckIcon size={19} weight="light" />{busy ? '正在保存' : `保存 ${stats.included} 件`}</button>
      </div>
    </>}
  </Modal>;
}
