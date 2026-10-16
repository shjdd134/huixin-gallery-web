import { useState } from 'react';
import { BookmarkSimpleIcon, CaretRightIcon, PlusIcon, SlidersHorizontalIcon } from '@phosphor-icons/react';
import { spaces, type SpaceId } from '../data/spaces';
import type { Collection } from '../data/db';
import { Atmosphere } from '../components/Image';
import { CollectionCard } from '../components/CollectionCard';
import { HomeCurator, useHomeLayout } from '../components/HomeCurator';


export function Home({ items, onAdd, onOpen, onImport }: { onImport: () => void; items: Collection[]; onAdd: (space?: SpaceId) => void; onOpen: (item: Collection) => void }) {
  const { curated, save } = useHomeLayout(items);
  const [managing, setManaging] = useState(false);
  const showCurated = managing || (curated?.length ?? 0) > 0;
  return <>
    <section className="home-hero" aria-labelledby="home-title">
      <div className="hero-image"><Atmosphere src={`${import.meta.env.BASE_URL}images/home.webp`} priority /></div>
      <div className="hero-inner page-width">
        <div className="hero-copy"><p className="hero-eyebrow">一座属于自己的收藏馆</p><h1 id="home-title">会心馆<span className="hero-seal" aria-hidden="true">私藏</span></h1><span className="title-rule" aria-hidden="true" /><p className="hero-motto">会于心者，藏于此间。</p><p className="hero-description">把真正喜欢的世界，慢慢留下来。</p></div>
        <div className="hero-side-note" aria-hidden="true">在偌大的世界里<br />保留一间属于自己的房间</div>
      </div>
    </section>


    <section className="spaces-section page-width" id="spaces" aria-labelledby="spaces-title">
      <div className="section-heading"><div><h2 id="spaces-title">我的五个空间</h2><p>喜欢的事物，各有归处。</p></div><span className="section-metadata">{items.length ? `${items.length} 件收藏，慢慢积累` : '从喜欢开始'}</span></div>
      <div className="space-grid">
        {spaces.map((space, index) => {
          const count = items.filter(item => item.space === space.id).length;
          return <a key={space.id} href={`#/${space.id}`} className={`space-card space-${space.id}`} style={{ '--entry-delay': `${index * 45}ms` } as React.CSSProperties} aria-label={`进入${space.title}`}>
            <Atmosphere src={space.image} priority={index < 2} />
            <div className="space-shade" />
            <div className="space-card-content"><div className="space-card-top"><div><span className="space-english">{space.english}</span><h3>{space.title}</h3><p className="space-category">{space.category}</p></div><span className="door-icon" aria-hidden="true"><CaretRightIcon size={22} weight="light" /></span></div><div className="space-card-bottom"><p>{space.description}</p>{count > 0 && <span className="space-count">{count} 件收藏</span>}</div></div>
          </a>;
        })}
      </div>
    </section>

    <div className="home-collect-strip page-width">
      <div><BookmarkSimpleIcon size={25} weight="light" /><p>收藏让平凡的日子，也有了光。</p></div>
      <div className="home-quick-entries">
        <a className="quick-entry" href="#/treasure"><BookmarkSimpleIcon size={17} weight="light" />我的珍藏<span className="quick-count">{items.length}</span></a>
        <button className="quick-entry" onClick={onImport}>导入清单</button>
        <button className="quick-entry" onClick={() => onAdd()}><PlusIcon size={17} weight="light" />添加收藏</button>
      </div>
    </div>

    {showCurated && <section className="curated-section page-width" id="home-curated" aria-labelledby="curated-title">
      <div className="section-heading"><div><h2 id="curated-title">亲手布置</h2><p>自己挑的收藏，按自己的顺序。</p></div>{!managing && <button className="text-button" onClick={() => setManaging(true)}><SlidersHorizontalIcon size={16} weight="light" />布置首页</button>}</div>
      {managing
        ? <HomeCurator items={items} curated={curated} onSave={save} onDone={() => setManaging(false)} />
        : <div className="collection-grid">{curated!.map(item => <CollectionCard key={item.id} item={item} onOpen={onOpen} />)}</div>}
    </section>}


    {items.length > 0 && !showCurated && <section className="curated-section page-width home-curation-empty" aria-labelledby="home-curation-entry-title">
      <div className="section-heading"><div><h2 id="home-curation-entry-title">亲手布置</h2><p>挑几件收藏，按自己的顺序放在首页。</p></div><button className="text-button" onClick={() => setManaging(true)}><SlidersHorizontalIcon size={16} weight="light" />布置首页</button></div>
    </section>}
  </>;
}

