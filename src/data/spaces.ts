import { BooksIcon, FilmSlateIcon, VinylRecordIcon, GameControllerIcon, UserCircleIcon, GlobeSimpleIcon } from '@phosphor-icons/react';

export type SpaceId = 'book' | 'film' | 'music' | 'game' | 'person' | 'website';
export type ViewId = 'all' | 'traditional' | 'web' | 'light' | 'movie' | 'series' | 'artist' | 'song';

const allSpaces = [
  { id: 'book', title: '书房', english: 'The library', category: '文学 · 网文 · 轻小说', description: '在书中，与更大的自己相遇。', invitation: '为那些舍不得合上的书，留一个位置。', revisitLabel: '反复重读', icon: BooksIcon, image: `${import.meta.env.BASE_URL}images/book.webp`, tabs: [{ id: 'all', label: '全部藏书' }, { id: 'traditional', label: '传统文学' }, { id: 'web', label: '网文' }, { id: 'light', label: '轻小说' }], creatorLabel: '作者', noteLabel: '为什么喜欢这本书' },
  { id: 'film', title: '放映厅', english: 'The cinema', category: '电影 · 电视剧', description: '有些故事，散场后仍在心里。', invitation: '把那些常常想起的光影，留在这里。', revisitLabel: '常常想起', icon: FilmSlateIcon, image: `${import.meta.env.BASE_URL}images/film.webp`, tabs: [{ id: 'all', label: '全部影像' }, { id: 'movie', label: '电影' }, { id: 'series', label: '电视剧' }], creatorLabel: '导演 / 主创', noteLabel: '为什么喜欢这部作品' },
  { id: 'music', title: '唱片馆', english: 'The listening room', category: '歌手 · 歌曲', description: '让旋律，在日常里继续发光。', invitation: '留住一首歌，也留住听见它的自己。', revisitLabel: '一直循环', icon: VinylRecordIcon, image: `${import.meta.env.BASE_URL}images/music.webp`, tabs: [{ id: 'all', label: '全部收藏' }, { id: 'artist', label: '歌手' }, { id: 'song', label: '歌曲' }], creatorLabel: '歌手 / 创作者', noteLabel: '为什么喜欢' },
  { id: 'game', title: '游戏室', english: 'The game room', category: '游戏', description: '另一个世界，真实地成为我的一部分。', invitation: '记录那些离开之后，仍想回去的世界。', revisitLabel: '反复想起', icon: GameControllerIcon, image: `${import.meta.env.BASE_URL}images/game.webp`, tabs: [{ id: 'all', label: '我喜欢的游戏' }], creatorLabel: '开发者', noteLabel: '为什么喜欢这个世界' },
  { id: 'person', title: '人物长廊', english: 'The portrait gallery', category: '人物', description: '那些照亮过我的人，也让我成为更好的人。', invitation: '在这里，记住一个人带给你的光。', revisitLabel: '一直影响我', icon: UserCircleIcon, image: `${import.meta.env.BASE_URL}images/person.webp`, tabs: [{ id: 'all', label: '我欣赏的人' }], creatorLabel: '身份 / 关系', noteLabel: '为什么欣赏，对我有什么影响' },
  { id: 'website', title: '网站收藏', english: 'The web collection', category: '常用网站 · 工具 · 资料', description: '好用的网站，连同用法一起留下。', invitation: '存下常用的网址，写清它能帮你做什么。', revisitLabel: '经常使用', icon: GlobeSimpleIcon, image: `${import.meta.env.BASE_URL}images/home.webp`, tabs: [{ id: 'all', label: '全部网站' }], creatorLabel: '网站提供方', noteLabel: '网站用途' },
] as const;

export type ActiveSpaceId = Exclude<SpaceId, 'music' | 'game'>;
export const spaces = allSpaces.filter(space => space.id !== 'music' && space.id !== 'game');
export const isActiveSpaceId = (value: string): value is ActiveSpaceId => spaces.some(space => space.id === value);

export const getSpace = (id: SpaceId) => allSpaces.find(space => space.id === id)!;
export const isSpaceId = (value: string): value is SpaceId => allSpaces.some(space => space.id === value);
export const defaultSubtype = (space: SpaceId) => space === 'book' ? 'traditional' : space === 'music' ? 'song' : space === 'film' ? 'movie' : '';
export const subtypeLabel = (value: string) => ({ traditional: '传统文学', web: '网文', light: '轻小说', movie: '电影', series: '电视剧', artist: '歌手', song: '歌曲' })[value as 'traditional'] ?? '';

// Empty film subtype is accepted for v0.1 backups and existing film records.
export const isValidSubtype = (space: SpaceId, subtype: string) => space === 'book' ? ['traditional', 'web', 'light'].includes(subtype) : space === 'music' ? ['artist', 'song'].includes(subtype) : space === 'film' ? ['', 'movie', 'series'].includes(subtype) : subtype === '';
