import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { CaretDownIcon, CaretUpIcon, CheckIcon, PlusIcon, XIcon } from '@phosphor-icons/react';
import { storageError, type Collection } from '../data/db';
import { getSpace, subtypeLabel } from '../data/spaces';
import { clearHomeLayout, getHomeLayout, setHomeLayout } from '../data/home';
import { useBlobUrl } from './Image';

export function useHomeLayout(items: Collection[]) {
  // 数据契约推荐模式：实时读取布置，与收藏实时列表在渲染层组合；
  // 已删除收藏的 id 在此自动跳过，不在首页留下失效入口。
  const stored = useLiveQuery(() => getHomeLayout(), []);
  const [override, setOverride] = useState<string[] | null>(null);
  // The local copy is only published after storage commits.
  useEffect(() => { setOverride(null); }, [stored]);
  const exists = useMemo(() => new Set(items.map(item => item.id)), [items]);
  const ids = (override ?? stored)?.filter(id => exists.has(id)) ?? null;
  const curated = ids ? ids.map(id => items.find(item => item.id === id)!).filter(Boolean) : null;
  async function save(next: string[]) {
    const valid = next.filter(id => exists.has(id));
    if (valid.length === 0) await clearHomeLayout(); else await setHomeLayout(valid);
    setOverride(valid);
  }
  return { curated, save };
}

export function HomeCurator({ items, curated, onSave, onDone }: { items: Collection[]; curated: Collection[] | null; onSave: (ids: string[]) => Promise<void>; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [failed, setFailed] = useState<string[] | null>(null);
  const saving = useRef(false);
  const inHome = curated ?? [];
  const inHomeIds = useMemo(() => new Set(inHome.map(item => item.id)), [inHome]);
  const pool = useMemo(() => items.filter(item => !inHomeIds.has(item.id)).sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [items, inHomeIds]);
  async function persist(next: string[]) {
    if (saving.current) return;
    saving.current = true; setBusy(true); setError('');
    try { await onSave(next); setFailed(null); }
    catch (reason) { setError(storageError(reason)); setFailed(next); }
    finally { saving.current = false; setBusy(false); }
  }
  async function move(index: number, delta: number) {
    const next = [...inHome];
    const [moved] = next.splice(index, 1);
    next.splice(index + delta, 0, moved);
    await persist(next.map(item => item.id));
  }
  async function toggle(id: string, add: boolean) {
    await persist(add ? [...inHome.map(item => item.id), id] : inHome.filter(item => item.id !== id).map(item => item.id));
  }
  return <div className="home-curator" aria-busy={busy}>
    <div className="curator-head">
      <div><h3>布置首页</h3><p>挑选首页展示的收藏，调整顺序，或取消展示。布置会留在这个浏览器里。</p></div>
      <button className="button primary" disabled={busy || !!error} onClick={() => { if (!saving.current && !error) onDone(); }}><CheckIcon size={18} weight="light" />完成布置</button>
    </div>
    {busy && <p className="curator-save-status" role="status">正在保存布置……</p>}
    {error && <div className="curator-save-error" role="alert"><p>布置没有保存，首页仍保留原来的顺序。{error}</p><button className="button outline" disabled={busy} onClick={() => { if (failed) void persist(failed); }}>重试保存</button></div>}
    {items.length === 0 ? <p className="curator-empty">馆里还没有收藏。先把喜欢的留下，再回来布置首页。</p> : <>
      <div className="curator-block">
        <h4>已展示（{inHome.length}）</h4>
        {inHome.length ? <ul className="curator-list">
          {inHome.map((item, index) => <CuratorRow key={item.id} item={item} order={index + 1}>
            <button className="icon-button" aria-label={`上移 ${item.title}`} aria-disabled={busy || index === 0} disabled={busy} onClick={() => index > 0 && void move(index, -1)}><CaretUpIcon size={17} weight="light" /></button>
            <button className="icon-button" aria-label={`下移 ${item.title}`} aria-disabled={busy || index === inHome.length - 1} disabled={busy} onClick={() => index < inHome.length - 1 && void move(index, 1)}><CaretDownIcon size={17} weight="light" /></button>
            <button className="icon-button" aria-label={`取消展示 ${item.title}`} disabled={busy} onClick={() => void toggle(item.id, false)}><XIcon size={17} weight="light" /></button>
          </CuratorRow>)}
        </ul> : <p className="curator-empty">首页还没有亲手布置的收藏。从下面挑几件放进来。</p>}
      </div>
      {pool.length > 0 && <div className="curator-block">
        <h4>可放入的收藏（{pool.length}）</h4>
        <ul className="curator-list">
          {pool.map(item => <CuratorRow key={item.id} item={item}>
            <button className="icon-button" aria-label={`放入首页 ${item.title}`} disabled={busy} onClick={() => void toggle(item.id, true)}><PlusIcon size={17} weight="light" /></button>
          </CuratorRow>)}
        </ul>
      </div>}
    </>}
  </div>;
}

function CuratorRow({ item, order, children }: { item: Collection; order?: number; children: ReactNode }) {
  const src = useBlobUrl(item.thumbnail || item.cover);
  const space = getSpace(item.space);
  return <li className="curator-row">
    {order !== undefined && <span className="curator-order" aria-hidden="true">{order}</span>}
    {src ? <img className="curator-thumb" src={src} alt="" loading="lazy" decoding="async" /> : <span className="curator-thumb curator-thumb-blank" aria-hidden="true">{[...item.title.trim()][0] || '藏'}</span>}
    <span className="curator-info"><span className="curator-title">{item.title}</span><span className="curator-space">{space.title}{subtypeLabel(item.subtype) ? ` · ${subtypeLabel(item.subtype)}` : ''}</span></span>
    <span className="curator-actions">{children}</span>
  </li>;
}
