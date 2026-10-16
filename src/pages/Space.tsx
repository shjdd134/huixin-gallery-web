import { useEffect, useState } from 'react';
import { CaretLeftIcon, PlusIcon, BookmarkSimpleIcon, CaretRightIcon } from '@phosphor-icons/react';
import { getSpace, spaces, type SpaceId, type ViewId } from '../data/spaces';
import type { Collection } from '../data/db';
import { Atmosphere } from '../components/Image';
import { CollectionCard } from '../components/CollectionCard';
import { SongList } from '../components/SongList';

export function Space({ id, items, loading, onAdd, onOpen, onImport }: { onImport: (space: SpaceId, subtype?: string) => void; id: SpaceId; items: Collection[]; loading: boolean; onAdd: (space: SpaceId, subtype?: string) => void; onOpen: (item: Collection) => void }) {
  const space = getSpace(id);
  const [view, setView] = useState<ViewId>(() => {
    const saved = sessionStorage.getItem(`view-${id}`);
    return space.tabs.some(tab => tab.id === saved) ? saved as ViewId : 'all';
  });
  const [filmList, setFilmList] = useState('');
  const [visibleCount, setVisibleCount] = useState(120);
  useEffect(() => { setVisibleCount(120); }, [view, filmList]);
  const own = items.filter(item => item.space === id);
  const lists = [...new Set(own.map(item => item.filmList).filter(Boolean))];
  const activeFilmList = lists.includes(filmList) ? filmList : '';
  const filtered = own.filter(item => ['traditional', 'web', 'light', 'movie', 'series', 'artist', 'song'].includes(view) ? (item.subtype === view || (view === 'movie' && item.subtype === '')) : true).filter(item => !activeFilmList || item.filmList === activeFilmList);
  const selected = space.tabs.find(tab => tab.id === view) ?? space.tabs[0];
  const Icon = space.icon;
  function changeView(next: ViewId) { setView(next); sessionStorage.setItem(`view-${id}`, next); }
  const grid = (list: Collection[]) => <div className={`collection-grid layout-${id}`}>{list.slice(0, visibleCount).map(item => <CollectionCard key={item.id} item={item} onOpen={onOpen} />)}</div>;
  const group = (title: string, list: Collection[]) => list.length ? <div className="display-group"><div className="display-group-head"><h3>{title}</h3><span>{list.length} 件</span></div>{grid(list)}</div> : null;
  // 放映厅「全部影像」里电影与电视剧分组陈列；旧数据 subtype 为空的电影归入电影一组。
  const movies = filtered.filter(item => item.subtype !== 'series');
  const series = filtered.filter(item => item.subtype === 'series');
  // 唱片馆把歌手陈列（方形封面）与歌曲列表（序号行）分开。
  const artists = filtered.filter(item => item.subtype === 'artist');
  const songs = filtered.filter(item => item.subtype === 'song');
  const displayedCount = id === 'film' && view === 'all' ? Math.min(movies.length, visibleCount) + Math.min(series.length, visibleCount)
    : id === 'music' && view === 'all' ? Math.min(artists.length, visibleCount) + Math.min(songs.length, visibleCount) : Math.min(filtered.length, visibleCount);
  return <>
    <section className={`room-hero room-${id}`} aria-labelledby="room-title"><div className="room-hero-image"><Atmosphere src={space.image} priority /></div><div className="room-hero-inner page-width"><a href="#/" className="breadcrumb"><CaretLeftIcon size={15} />会心馆</a><div className="room-hero-copy"><p className="room-english">{space.english}</p><h1 id="room-title">{space.title}</h1><span className="title-rule" aria-hidden="true" /><p className="room-description">{space.description}</p></div></div></section>
    <section className="room-collection page-width" aria-labelledby="collection-title"><div className="room-toolbar"><div className="room-tabs" role="group" aria-label={`${space.title}收藏分类`}>{space.tabs.map(tab => <button key={tab.id} className={`filter-tab ${view === tab.id ? 'selected' : ''}`} aria-pressed={view === tab.id} onClick={() => changeView(tab.id)}>{tab.label}</button>)}</div><div className="room-import-actions"><button className="button outline" onClick={() => onImport(id, ['traditional', 'web', 'light', 'movie', 'series', 'artist', 'song'].includes(view) ? view : undefined)}>导入清单</button><button className="button primary add-room-button" onClick={() => onAdd(id, ['traditional', 'web', 'light', 'movie', 'series', 'artist', 'song'].includes(view) ? view : undefined)}><PlusIcon size={19} weight="light" />添加收藏</button></div></div>
      {id === 'film' && lists.length > 0 && <div className="film-lists"><span>私藏影单</span><button className={`small-filter ${!activeFilmList ? 'selected' : ''}`} onClick={() => setFilmList('')}>全部</button>{lists.map(list => <button key={list} className={`small-filter ${activeFilmList === list ? 'selected' : ''}`} onClick={() => setFilmList(list)}>{list}</button>)}</div>}
      <div className="collection-heading"><h2 id="collection-title">{activeFilmList || selected.label}</h2><span>{filtered.length} 件收藏</span></div>
      {loading ? <div className="collection-grid skeleton-grid" aria-label="正在打开收藏" aria-busy="true">{[0, 1, 2, 3].map(key => <div key={key} className="skeleton-card" />)}</div>
        : !filtered.length ? <div className="empty-gallery"><div className="empty-symbol"><Icon size={43} weight="light" /></div><h3>喜欢，值得被留下。</h3><p>{space.invitation}</p><button className="button outline" onClick={() => onAdd(id, view === 'all' ? undefined : view)}><PlusIcon size={18} />留下第一件收藏</button></div>
        : id === 'film' && view === 'all' ? <>{group('电影', movies)}{group('电视剧', series)}</>
        : id === 'music' && view === 'all' ? <>{group('歌手陈列', artists)}<div className="display-group"><div className="display-group-head"><h3>歌曲列表</h3><span>{songs.length} 首</span></div>{songs.length ? <SongList items={songs.slice(0, visibleCount)} onOpen={onOpen} /> : <p className="display-group-empty">还没有留下的歌曲。</p>}</div></>
        : id === 'music' && view === 'song' ? <SongList items={filtered.slice(0, visibleCount)} onOpen={onOpen} />
        : grid(filtered)}
      {!loading && displayedCount < filtered.length && <div className="collection-more"><p>已显示 {displayedCount} / {filtered.length} 件</p><button className="button outline" onClick={() => setVisibleCount(count => count + 120)}>继续查看收藏</button></div>}
    </section>
    <section className="other-spaces page-width" aria-labelledby="other-spaces-title"><h2 id="other-spaces-title">去别的空间坐坐</h2><div className="other-space-links"><a href="#/treasure"><BookmarkSimpleIcon weight="light" size={22} /><span>珍藏</span><CaretRightIcon size={15} weight="light" /></a>{spaces.filter(other => other.id !== id).map(other => { const OtherIcon = other.icon; return <a key={other.id} href={`#/${other.id}`}><OtherIcon weight="light" size={22} /><span>{other.title}</span><CaretRightIcon size={15} weight="light" /></a>; })}</div></section>
  </>;
}
