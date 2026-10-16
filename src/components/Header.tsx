import { useEffect, useRef } from 'react';
import { HouseLineIcon, BookmarkSimpleIcon, MagnifyingGlassIcon, PlusIcon, DownloadSimpleIcon } from '@phosphor-icons/react';
import { spaces, type SpaceId } from '../data/spaces';

export type GalleryRoute = SpaceId | 'treasure';
export function Header({ current, onSearch, onSettings, onAdd }: { current: GalleryRoute | null; onSearch: () => void; onSettings: () => void; onAdd: () => void }) {
  const mobileNav = useRef<HTMLElement>(null);
  useEffect(() => {
    const nav = mobileNav.current, active = nav?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!nav || !active || !nav.clientWidth || nav.scrollWidth <= nav.clientWidth) return;
    const left = active.offsetLeft, right = left + active.offsetWidth;
    if (left < nav.scrollLeft) nav.scrollTo({ left: Math.max(0, left - 8), behavior: 'auto' });
    else if (right > nav.scrollLeft + nav.clientWidth) nav.scrollTo({ left: right - nav.clientWidth + 8, behavior: 'auto' });
  }, [current]);
  return <>
    <a href="#main-content" className="skip-link" onClick={event => { event.preventDefault(); const main = document.getElementById('main-content'); main?.focus(); main?.scrollIntoView({ block: 'start', behavior: 'instant' }); }}>跳到内容</a>
    <header className="site-header"><div className="header-inner page-width">
      <a href="#/" className="brand" aria-label="会心馆首页"><span className="brand-seal" aria-hidden="true">会</span><span className="brand-name">会心馆</span><span className="brand-caption">私人收藏馆</span></a>
      <nav className="desktop-nav" aria-label="空间导航"><a href="#/" className={!current ? 'active' : ''} aria-current={!current ? 'page' : undefined}>我的馆</a><a href="#/treasure" className={current === 'treasure' ? 'active' : ''} aria-current={current === 'treasure' ? 'page' : undefined}>珍藏</a>{spaces.map(space => <a href={`#/${space.id}`} key={space.id} className={current === space.id ? 'active' : ''} aria-current={current === space.id ? 'page' : undefined}>{space.title}</a>)}</nav>
      <div className="header-actions"><button className="icon-button" aria-label="搜索收藏" onClick={onSearch}><MagnifyingGlassIcon weight="light" size={23} /></button><button className="text-button" aria-label="馆的序言与备份" title="馆藏与备份" onClick={onSettings}><DownloadSimpleIcon weight="light" size={20} /><span>备份</span></button><button className="button primary header-add" aria-label="添加收藏" onClick={onAdd}><PlusIcon size={18} weight="light" /><span>添加收藏</span></button></div>
    </div></header>
    <nav ref={mobileNav} className="mobile-nav mobile-nav-expanded" aria-label="手机空间导航">
      <a href="#/" className={!current ? 'active' : ''} aria-current={!current ? 'page' : undefined}><HouseLineIcon size={23} weight={!current ? 'fill' : 'light'} /><span>我的馆</span></a>
      <a href="#/treasure" className={`mobile-nav-treasure ${current === 'treasure' ? 'active' : ''}`} aria-current={current === 'treasure' ? 'page' : undefined}><BookmarkSimpleIcon size={23} weight={current === 'treasure' ? 'fill' : 'light'} /><span>珍藏</span></a>
      {spaces.map(space => { const Icon = space.icon; return <a key={space.id} href={`#/${space.id}`} className={current === space.id ? 'active' : ''} aria-current={current === space.id ? 'page' : undefined}><Icon size={23} weight={current === space.id ? 'fill' : 'light'} /><span>{space.title}</span></a>; })}
    </nav>
  </>;
}

