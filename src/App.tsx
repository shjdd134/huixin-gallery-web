import { Component, Suspense, lazy, useEffect, useRef, useState, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { IconContext } from '@phosphor-icons/react';
import { db, storageError, type Collection } from './data/db';
import { isSpaceId, type SpaceId } from './data/spaces';
import { Header, type GalleryRoute } from './components/Header';
import { Editor } from './components/Editor';
import { Detail } from './components/Detail';
import { Search } from './components/Search';
import { IntakePanel, type IntakeSummary } from './features/intake/IntakePanel';
import { MixedIntakePanel, type MixedSummary } from './features/intake/MixedIntakePanel';
import { Home } from './pages/Home';
import { Discovery } from './features/discovery/Discovery';
import { Space } from './pages/Space';
import { Treasure } from './pages/Treasure';
import { requestDraftNavigation } from './components/DraftGuard';

const Settings = lazy(() => import('./components/Settings').then(module => ({ default: module.Settings })));

type Panel = { type: 'mixed-intake'; space?: SpaceId; subtype?: string; summary?: MixedSummary } | { type: 'discovery'; trialId?: string; from?: Panel } | { type: 'add'; space: SpaceId; subtype?: string } | { type: 'edit'; item: Collection } | { type: 'detail'; id: string; from?: Panel } | { type: 'search'; query?: string } | { type: 'settings' } | { type: 'intake'; space: SpaceId; summary?: IntakeSummary } | null;
function routeFromHash(): GalleryRoute | null { const route = location.hash.replace(/^#\/?/, ''); return route === 'treasure' ? route : isSpaceId(route) ? route : null; }
function historyEntryIndex(): number | undefined {
  const index = (window as Window & { navigation?: { currentEntry?: { index?: number } } }).navigation?.currentEntry?.index;
  return typeof index === 'number' && index >= 0 ? index : undefined;
}

export default function App() {
  const [current, setCurrent] = useState<GalleryRoute | null>(routeFromHash);
  const [panel, setPanel] = useState<Panel>(null);
  const [toast, setToast] = useState('');
  const scrollPositions = useRef<Record<string, number>>({});
  const currentRef = useRef(current);
  const savedNavigation = useRef<string | null>(null);
  // 从详情进入编辑时记下来源；保存或取消后回到原来的详情（含搜索返回栈）。
  const editOrigin = useRef<Panel>(null);
  const collections = useLiveQuery(() => db.collections.orderBy('updatedAt').reverse().toArray());
  const items = collections || [];
  const selected = panel?.type === 'detail' ? items.find(item => item.id === panel.id) : undefined;
  const detailSnapshot = useRef<Collection | undefined>(undefined);
  if (selected) detailSnapshot.current = selected;
  const detailItem = selected || (panel?.type === 'detail' && detailSnapshot.current?.id === panel.id ? detailSnapshot.current : undefined);
  useEffect(() => {
    // Hash navigation has already moved the browser's history pointer when the
    // event arrives. Restore that pointer while a draft confirmation is pending,
    // then replay the original navigation only after an explicit discard.
    // Browser entry indexes also identify history created before this version;
    // an application-only tag cannot infer the direction of old entries.
    let activeIndex = historyEntryIndex();
    let restoring = false;
    let allowedHash: string | null = null;
    let afterRestore: (() => void) | null = null;
    function onHashChange(event: HashChangeEvent) {
      const nextIndex = historyEntryIndex();
      const nextHash = location.hash;
      if (restoring && nextIndex === activeIndex) {
        restoring = false;
        const replay = afterRestore; afterRestore = null; replay?.();
        return;
      }
      const next = routeFromHash();
      if (next === currentRef.current) { activeIndex = nextIndex; return; }
      const canRestorePointer = activeIndex !== undefined && nextIndex !== undefined && activeIndex !== nextIndex;
      if (allowedHash === nextHash || savedNavigation.current === nextHash) { allowedHash = null; savedNavigation.current = null; }
      else if (!requestDraftNavigation(() => {
        allowedHash = nextHash;
        const replay = () => { if (canRestorePointer) history.go(nextIndex! - activeIndex!); else location.hash = nextHash; };
        if (restoring) afterRestore = replay; else replay();
      })) {
        if (canRestorePointer) { restoring = true; history.go(activeIndex! - nextIndex!); }
        // Without browser indexes, keep the old URL and draft together using
        // an ordinary history entry; never guess a traversal direction.
        else history.pushState(history.state, '', event.oldURL);
        return;
      }
      scrollPositions.current[currentRef.current || 'home'] = window.scrollY;
      activeIndex = nextIndex;
      currentRef.current = next; setCurrent(next); setPanel(null);
    }
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);
  useEffect(() => { requestAnimationFrame(() => window.scrollTo({ top: scrollPositions.current[current || 'home'] || 0, behavior: 'instant' })); }, [current]);
  useEffect(() => { document.title = current ? `${{ treasure: '珍藏', book: '书房', film: '放映厅', music: '唱片馆', game: '游戏室', person: '人物长廊' }[current]} · 会心馆` : '会心馆 · 会于心者，藏于此间。'; }, [current]);
  useEffect(() => { if (!toast) return; const timeout = window.setTimeout(() => setToast(''), 3200); return () => window.clearTimeout(timeout); }, [toast]);
  useEffect(() => { const listener = (event: KeyboardEvent) => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k' && !panel) { event.preventDefault(); setPanel({ type: 'search' }); } }; window.addEventListener('keydown', listener); return () => window.removeEventListener('keydown', listener); }, [panel]);
  function add(space?: SpaceId, subtype?: string) { setPanel({ type: 'add', space: space || (current && isSpaceId(current) ? current : 'book'), subtype }); }
  function intake(space?: SpaceId) { setPanel({ type: 'intake', space: space || (current && isSpaceId(current) ? current : 'book') }); }
  function saved(item: Collection) {
    setToast('这份喜欢，已经留下。');
    const origin = editOrigin.current;
    editOrigin.current = null;
    if (origin?.type === 'detail') { setPanel({ type: 'detail', id: item.id, from: origin.from }); return; }
    setPanel(null);
    if (current !== 'treasure' && current !== item.space) { savedNavigation.current = `#/${item.space}`; location.hash = `/${item.space}`; }
  }
  function intakeDone(added: Collection[]) {
    setPanel(null);
    setToast(added.length ? `已新增 ${added.length} 件收藏。` : '没有新增收藏。');
    if (current !== 'treasure' && added.length && new Set(added.map(item => item.space)).size === 1 && current !== added[0].space) { savedNavigation.current = `#/${added[0].space}`; location.hash = `/${added[0].space}`; }
  }
  return <IconContext.Provider value={{ weight: 'light' }}><Header current={current} onSearch={() => setPanel({ type: 'search' })} onSettings={() => setPanel({ type: 'settings' })} onAdd={() => add()} /><main id="main-content" key={current || 'home'} tabIndex={-1}>{current === 'treasure' ? <Treasure items={items} loading={!collections} onOpen={item => setPanel({ type: 'detail', id: item.id })} /> : current ? <Space key={current} id={current} items={items} loading={!collections} onAdd={add} onImport={(space, subtype) => setPanel({ type: 'mixed-intake', space, subtype })} onOpen={item => setPanel({ type: 'detail', id: item.id })} /> : <Home onImport={() => setPanel({ type: 'mixed-intake' })} items={items} onAdd={add} onOpen={item => setPanel({ type: 'detail', id: item.id })} />}</main><footer className="site-footer page-width"><a href="#/" className="footer-brand">会心馆</a><p>会于心者，藏于此间。</p><button className="text-button" onClick={() => setPanel({ type: 'settings' })}>馆藏与备份</button></footer>
    {panel?.type === 'mixed-intake' && <MixedIntakePanel initialSpace={panel.space} initialSubtype={panel.subtype} initialSummary={panel.summary} items={items} onClose={() => setPanel(null)} onDone={intakeDone} onOpenItem={(item, summary) => setPanel({ type: 'detail', id: item.id, from: { ...panel, summary } })} />}
    {panel?.type === 'add' && <Editor initialSpace={panel.space} initialSubtype={panel.subtype} onClose={() => setPanel(null)} onSaved={saved} onBatch={() => intake(panel.space)} />}
    {panel?.type === 'edit' && <Editor existing={panel.item} initialSpace={panel.item.space} onClose={() => { const origin = editOrigin.current; editOrigin.current = null; setPanel({ type: 'detail', id: panel.item.id, from: origin?.type === 'detail' ? origin.from : undefined }); }} onSaved={saved} />}
    {panel?.type === 'detail' && detailItem && <Detail removed={!selected} onDiscover={() => setPanel({ type: 'discovery' })} item={detailItem} onClose={() => setPanel(panel.from || null)} onEdit={item => { editOrigin.current = panel; setPanel({ type: 'edit', item }); }} onDeleted={() => { editOrigin.current = null; setPanel(null); setToast('收藏已移除。'); }} />}
    {panel?.type === 'search' && <Search items={items} initialQuery={panel.query} onQueryChange={query => setPanel({ ...panel, query })} onClose={() => setPanel(null)} onOpen={item => setPanel({ type: 'detail', id: item.id, from: { type: 'search', query: panel.query } })} onOpenTrial={trialId => setPanel({ type: 'discovery', trialId, from: { type: 'search', query: panel.query } })} />}
    {panel?.type === 'intake' && <IntakePanel initialSpace={panel.space} items={items} initialSummary={panel.summary} onClose={() => setPanel(null)} onOpenItem={(item, summary) => setPanel({ type: 'detail', id: item.id, from: { type: 'intake', space: panel.space, summary } })} onDone={intakeDone} />}
    {panel?.type === 'discovery' && <Discovery items={items} initialTrialId={panel.trialId} onClose={() => setPanel(panel.from || null)} onOpen={item => setPanel({ type: 'detail', id: item.id, from: panel })} />}
    {panel?.type === 'settings' && <Suspense fallback={<div className="toast visible" role="status">正在打开馆藏与备份</div>}><Settings count={items.length} onClose={() => setPanel(null)} onRestored={() => { setToast('馆藏已完整恢复。'); setPanel(null); }} /></Suspense>}
    <div className={`toast ${toast ? 'visible' : ''}`} role="status" aria-live="polite">{toast}</div>
  </IconContext.Provider>;
}

export class AppBoundary extends Component<{ children: ReactNode }, { error: string }> {
  state = { error: '' };
  static getDerivedStateFromError(error: unknown) { return { error: storageError(error) }; }
  render() { return this.state.error ? <div className="fatal-error"><span className="brand-seal">会</span><h1>暂时无法打开会心馆</h1><p>{this.state.error}</p><p>请检查浏览器的本机存储权限，或重新打开页面。</p><button className="button primary" onClick={() => location.reload()}>重新打开</button></div> : this.props.children; }
}
