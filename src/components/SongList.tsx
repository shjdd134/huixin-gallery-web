import type { Collection } from '../data/db';
import { useBlobUrl } from './Image';

// 歌曲列表：与歌手的方形陈列分开，按序号排成一列，方便逐行阅读与点按。
export function SongList({ items, onOpen }: { items: Collection[]; onOpen: (item: Collection) => void }) {
  return <ol className="song-list">{items.map((item, index) => <SongRow key={item.id} item={item} index={index} onOpen={onOpen} />)}</ol>;
}

function SongRow({ item, index, onOpen }: { item: Collection; index: number; onOpen: (item: Collection) => void }) {
  const src = useBlobUrl(item.thumbnail || item.cover);
  return <li>
    <button className="song-row" onClick={() => onOpen(item)} aria-label={`查看 ${item.title}`}>
      <span className="song-index" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
      {src && <img className="song-thumb" src={src} alt="" loading="lazy" decoding="async" />}
      <span className="song-main">
        <span className="song-title">{item.title}</span>
        {item.note && <span className="song-note">{item.note}</span>}
      </span>
      {item.creator && <span className="song-artist">{item.creator}</span>}
    </button>
  </li>;
}
