import type { Collection } from '../data/db';
import { getSpace, subtypeLabel } from '../data/spaces';

export function CollectionCover({ item }: { item: Collection }) {
  const hash = [...item.title].reduce((sum, letter) => sum + letter.charCodeAt(0), 0);
  const label = subtypeLabel(item.subtype) || getSpace(item.space).category;
  const monogram = item.space === 'person' ? [...item.title.trim()][0] : undefined;
  return <div className={`editorial-cover editorial-${item.space} cover-tone-${hash % 4}`} aria-hidden="true">
    <span className="cover-edition">会心馆 · {label}</span>
    {monogram ? <span className="cover-monogram">{monogram}</span> : <div className="cover-art" />}
    <span className={`cover-title ${item.title.length > 14 ? 'long-title' : ''}`}>{item.title}</span>
    <span className="cover-imprint">会于心者，藏于此间。</span>
  </div>;
}
