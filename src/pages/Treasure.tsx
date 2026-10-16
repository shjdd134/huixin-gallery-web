import { useEffect, useMemo, useRef, useState } from 'react';
import { CollectionCard } from '../components/CollectionCard';
import { useDraftGuard } from '../components/DraftGuard';
import { storageError, type Collection } from '../data/db';
import { getTreasureLevel, setTreasureLevel, treasureLevels, type TreasureLevel } from '../data/levels';
import { getSpace } from '../data/spaces';

type Filter = 'all' | TreasureLevel;
type Feedback = { id: string; text: string };
const initialLimits = () => ({ interest: 120, like: 120, adore: 120 });
export function Treasure({ items, loading, onOpen }: { items: Collection[]; loading: boolean; onOpen: (item: Collection) => void }) {
  const [filter, setFilter] = useState<Filter>(() => {
    const saved = sessionStorage.getItem('view-treasure');
    return treasureLevels.some(level => level.id === saved) ? saved as TreasureLevel : 'all';
  });
  const [limits, setLimits] = useState(initialLimits);
  const [saving, setSaving] = useState<{ id: string; title: string } | null>(null);
  const [error, setError] = useState<Feedback | null>(null);
  const [message, setMessage] = useState<Feedback | null>(null);
  const inFlight = useRef(false);
  const errorAnchor = useRef<HTMLParagraphElement | null>(null);
  const messageAnchor = useRef<HTMLParagraphElement | null>(null);
  useDraftGuard(false, !!saving);
  const grouped = useMemo(() => {
    const groups: Record<TreasureLevel, Collection[]> = { interest: [], like: [], adore: [] };
    for (const item of items) groups[getTreasureLevel(item)].push(item);
    return groups;
  }, [items]);
  const shownLevels = treasureLevels.filter(level => filter === 'all' ? grouped[level.id].length > 0 : filter === level.id);
  const displayedIds = new Set(shownLevels.flatMap(level => grouped[level.id].slice(0, limits[level.id]).map(item => item.id)));
  const errorVisible = !!error && displayedIds.has(error.id);
  const messageVisible = !!message && displayedIds.has(message.id);
  useEffect(() => { if (error) errorAnchor.current?.scrollIntoView({ block: 'center', behavior: 'auto' }); }, [error, errorVisible]);
  useEffect(() => { if (message) messageAnchor.current?.scrollIntoView({ block: 'center', behavior: 'auto' }); }, [message, messageVisible]);
  function changeFilter(next: Filter) {
    if (next !== filter) setLimits(initialLimits());
    setFilter(next); sessionStorage.setItem('view-treasure', next);
  }
  async function changeLevel(item: Collection, level: TreasureLevel) {
    if (inFlight.current || getTreasureLevel(item) === level) return;
    inFlight.current = true; setSaving({ id: item.id, title: item.title }); setError(null); setMessage(null);
    try { await setTreasureLevel(item, level); setMessage({ id: item.id, text: `「${item.title}」的等级已保存。` }); }
    catch (reason) { setError({ id: item.id, text: `「${item.title}」的等级没有保存。${storageError(reason)}` }); }
    finally { inFlight.current = false; setSaving(null); }
  }
  return <div className="treasure-page page-width" aria-busy={!!saving || loading}>
    <header className="treasure-page-heading">
      <h1 id="treasure-title">我的珍藏</h1>
      <p className="treasure-page-summary">{loading ? '正在打开收藏……' : `${items.length} 件收藏，来自各个收藏空间。`}</p>
    </header>
    <nav className="treasure-page-filters" aria-label="珍藏等级筛选">
      <button type="button" data-filter="all" aria-pressed={filter === 'all'} className={`choice-button ${filter === 'all' ? 'selected' : ''}`} onClick={() => changeFilter('all')}>全部 <span className="treasure-page-count">{items.length}</span></button>
      {treasureLevels.map(level => <button key={level.id} type="button" data-filter={level.id} aria-pressed={filter === level.id} className={`choice-button ${filter === level.id ? 'selected' : ''}`} onClick={() => changeFilter(level.id)}>{level.label} <span className="treasure-page-count">{grouped[level.id].length}</span></button>)}
    </nav>
    {((saving && !displayedIds.has(saving.id)) || (error && !errorVisible) || (message && !messageVisible)) && <div className="treasure-page-feedback">
      {saving && !displayedIds.has(saving.id) && <p role="status">正在保存「{saving.title}」的等级……</p>}
      {error && !errorVisible && <p ref={errorAnchor} className="inline-error" role="alert">{error.text}</p>}
      {!saving && message && !messageVisible && <p ref={messageAnchor} className="success-message" role="status">{message.text}</p>}
    </div>}
    {!loading && !items.length && filter === 'all' && <p className="treasure-page-empty">还没有留下收藏。可以从任一空间添加喜欢的作品。</p>}
    {!loading && shownLevels.map(level => <section key={level.id} className="treasure-page-section" data-level={level.id} aria-labelledby={`treasure-level-${level.id}`}>
      <div className="treasure-page-section-heading"><h2 id={`treasure-level-${level.id}`}>{level.label}</h2><span className="treasure-page-count">{grouped[level.id].length} 件</span></div>
      {grouped[level.id].length ? <div className="treasure-page-grid collection-grid">
        {grouped[level.id].slice(0, limits[level.id]).map(item => <article className="treasure-page-card" key={item.id} data-id={item.id}>
          <CollectionCard item={item} onOpen={() => onOpen(item)} />
          <div className="treasure-page-card-controls"><span className="treasure-page-origin">{getSpace(item.space).title}</span><label><span className="sr-only">{item.title}的等级</span><select className="treasure-page-level" value={getTreasureLevel(item)} disabled={!!saving} aria-describedby={error?.id === item.id ? `treasure-error-${item.id}` : undefined} onChange={event => { void changeLevel(item, event.target.value as TreasureLevel); }}>{treasureLevels.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label></div>
          {saving?.id === item.id && <p className="treasure-page-feedback" role="status">正在保存「{saving.title}」的等级……</p>}
          {error?.id === item.id && <p ref={errorAnchor} className="treasure-page-feedback inline-error" role="alert" id={`treasure-error-${item.id}`}>{error.text}</p>}
          {!saving && message?.id === item.id && <p ref={messageAnchor} className="treasure-page-feedback success-message" role="status">{message.text}</p>}
        </article>)}
      </div> : <p className="treasure-page-empty">还没有放在“{level.label}”的收藏。可以在这里调整每件作品的等级。</p>}
      {grouped[level.id].length > limits[level.id] && <div className="collection-more"><p>已显示 {limits[level.id]} / {grouped[level.id].length} 件</p><button className="button outline" onClick={() => setLimits(current => ({ ...current, [level.id]: current[level.id] + 120 }))}>继续查看收藏</button></div>}
    </section>)}
  </div>;
}
