import type { Collection } from '../data/db';
import { getSpace, subtypeLabel } from '../data/spaces';
import { useBlobUrl } from './Image';
import { CollectionCover } from './CollectionCover';

export function CollectionCard({ item, onOpen }: { item: Collection; onOpen: (item: Collection) => void }) {
  const src = useBlobUrl(item.thumbnail || item.cover);
  const space = getSpace(item.space);
  return <button className={`collection-card collection-${item.space}`} onClick={() => onOpen(item)} aria-label={`查看 ${item.title}`}>
    <div className={`collection-cover ${src ? '' : 'no-cover'}`}>
      {src ? <img src={src} alt={`${item.title}的封面`} loading="lazy" decoding="async" /> : <CollectionCover item={item} />}
    </div>
    <div className="collection-caption"><p className="collection-meta">{subtypeLabel(item.subtype) || (item.space === 'film' ? '电影' : space.category)}</p><h3>{item.title}</h3>{item.creator && <p className="collection-creator">{item.creator}</p>}{item.note && <p className="collection-note">{item.note}</p>}</div>
  </button>;
}
