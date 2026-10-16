import { GlobeSimpleIcon, ArrowSquareOutIcon } from '@phosphor-icons/react';
import { websiteLink } from '../data/websites';
import type { Collection } from '../data/db';
import { getSpace, subtypeLabel } from '../data/spaces';
import { useBlobUrl } from './Image';
import { CollectionCover } from './CollectionCover';

export function CollectionCard({ item, onOpen }: { item: Collection; onOpen: (item: Collection) => void }) {
  const src = useBlobUrl(item.thumbnail || item.cover);
  const space = getSpace(item.space);
  if (item.space === 'website') {
    const href = websiteLink(item.url);
    return <article className="website-card"><button className="website-card-content" onClick={() => onOpen(item)} aria-label={`查看 ${item.title}`}><span className="website-card-icon"><GlobeSimpleIcon size={24} /></span><span className="website-card-heading"><h3>{item.title}</h3><span className="website-address">{href ? new URL(href).host : '尚未填写网址'}</span></span><p className="website-purpose">{item.note || '还没有填写用途，点击补充。'}</p></button><div className="website-card-footer"><div className="website-tags">{item.tags.slice(0, 3).map(tag => <span key={tag}>{tag}</span>)}</div>{href && <a className="website-open" href={href} target="_blank" rel="noopener noreferrer">打开网站<ArrowSquareOutIcon size={16} /></a>}</div></article>;
  }
  return <button className={`collection-card collection-${item.space}`} onClick={() => onOpen(item)} aria-label={`查看 ${item.title}`}>
    <div className={`collection-cover ${src ? '' : 'no-cover'}`}>
      {src ? <img src={src} alt={`${item.title}的封面`} loading="lazy" decoding="async" /> : <CollectionCover item={item} />}
    </div>
    <div className="collection-caption"><p className="collection-meta">{subtypeLabel(item.subtype) || (item.space === 'film' ? '电影' : space.category)}</p><h3>{item.title}</h3>{item.creator && <p className="collection-creator">{item.creator}</p>}{item.note && <p className="collection-note">{item.note}</p>}</div>
  </button>;
}
