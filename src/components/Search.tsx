import { useEffect, useMemo, useState } from 'react';
import { MagnifyingGlassIcon } from '@phosphor-icons/react';
import { Modal } from './Modal';
import { matchesSearch, type Collection } from '../data/db';
import { getSpace } from '../data/spaces';
import { useLiveQuery } from 'dexie-react-hooks';
import { getDiscoveryState } from '../features/discovery/store';
import { findActivity } from '../features/discovery/catalog';

// 结果里标注命中来自「什么时候遇见」或「最喜欢的一句话」。
function matchesEncounterFields(item: Collection, query: string) {
  const text = [item.encounterText ?? '', item.quote ?? ''].join(' ').normalize('NFKC').toLocaleLowerCase();
  return query.normalize('NFKC').trim().toLocaleLowerCase().split(/\s+/).filter(Boolean).every(word => text.includes(word));
}

export function Search({ items, initialQuery = '', onQueryChange, onClose, onOpen, onOpenTrial }: { items: Collection[]; initialQuery?: string; onQueryChange?: (query: string) => void; onClose: () => void; onOpen: (item: Collection) => void; onOpenTrial: (id: string) => void }) {
  const [query, setQuery] = useState(initialQuery);
  const [visibleCount, setVisibleCount] = useState(80);
  useEffect(() => { setVisibleCount(80); }, [query]);
  const change = (value: string) => { setQuery(value); onQueryChange?.(value); };
  const results = useMemo(() => query.trim() ? items.filter(item => matchesSearch(item, query)) : [], [items, query]);
  const discovery = useLiveQuery(getDiscoveryState, []);
  const trialResults = useMemo(() => {
    if (!query.trim()) return [];
    const words = query.normalize('NFKC').trim().toLocaleLowerCase().split(/\s+/);
    return (discovery?.trials || []).filter(trial => {
      const text = [trial.label, findActivity(trial.activityId)?.title, trial.attraction, trial.obstacle, trial.next, ...trial.evidence.map(source => source.title)].join(' ').normalize('NFKC').toLocaleLowerCase();
      return words.every(word => text.includes(word));
    });
  }, [discovery, query]);
  return <Modal title="重新找到喜欢" onClose={onClose} className="search-modal">
    <label htmlFor="collection-search" className="field-label">名称、创作者、感受或标签</label>
    <div className="search-input-wrap"><MagnifyingGlassIcon size={22} weight="light" /><input id="collection-search" type="search" value={query} autoFocus data-autofocus placeholder="在所有空间里找一找" onChange={event => change(event.target.value)} autoComplete="off" /></div>
    <p className="search-hint">也能找回体验心得、遇到的阻碍和下一步。</p>
    <div className="search-results" aria-live="polite">{!query.trim() ? <div className="search-empty"><p>每一份喜欢，都有迹可循。</p><span>{items.length ? `在 ${items.length} 件收藏和已保存心得中搜索。` : '添加收藏后，就可以在这里重新找到它们。'}</span></div> : !results.length && !trialResults.length ? <div className="search-empty"><p>{discovery ? '还没有找到这份喜欢。' : '正在查找已保存心得……'}</p><span>换一个名称，或试试你留下的感受。</span></div> : <>
      {results.length > 0 && <><p className="search-result-count">找到 {results.length} 件收藏</p>{results.slice(0, visibleCount).map(item => { const space = getSpace(item.space); const Icon = space.icon; const viaEncounter = matchesEncounterFields(item, query); return <button key={item.id} className="search-result" onClick={() => onOpen(item)}><span className="search-result-icon"><Icon size={24} weight="light" /></span><span><strong>{item.title}</strong><small>{space.title}{item.creator ? ` · ${item.creator}` : ''}{viaEncounter ? ' · 在遇见或引语里找到' : ''}</small></span></button>; })}</>}
      {trialResults.length > 0 && <><p className="search-result-count">找到 {trialResults.length} 条体验记录</p>{trialResults.slice(0, visibleCount).map(trial => <button key={trial.id} className="search-result search-trial" onClick={() => onOpenTrial(trial.id)}><span><strong>{findActivity(trial.activityId)?.title || trial.label}</strong><small>体验心得 · {trial.label} · {new Date(trial.updatedAt).toLocaleDateString('zh-CN')} · {{ planned: '待尝试', tried: '已体验', paused: '暂缓' }[trial.status]}</small><span className="search-excerpt">{[trial.attraction, trial.obstacle, trial.next].filter(Boolean).join(' · ').slice(0, 240)}</span></span></button>)}</>}
      {(results.length > visibleCount || trialResults.length > visibleCount) && <button className="button outline search-more" onClick={() => setVisibleCount(count => count + 80)}>更多搜索结果</button>}
    </>}</div>
  </Modal>;
}

