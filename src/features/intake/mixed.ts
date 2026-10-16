import type { Collection } from '../../data/db';
import { isValidSubtype, type SpaceId } from '../../data/spaces';
import { parseIntakeLines, validateEntryName, type IntakeEntry } from './parse';

export interface Destination { space?: SpaceId; subtype?: string }
export interface IntakeGroup extends Destination { id: string; label: string }
export interface MixedEntry extends Omit<IntakeEntry, 'status'>, Destination {
  group: string;
  creator: string;
  status: IntakeEntry['status'] | 'unclassified';
}
export const destinations = [
  ['book:traditional', '书 · 传统文学'], ['book:web', '书 · 网文'], ['book:light', '书 · 轻小说'],
  ['film:movie', '电影'], ['film:series', '电视剧'], ['music:song', '歌曲'], ['music:artist', '歌手'],
  ['game:', '游戏'], ['person:', '人物'],
] as const;
export function destinationValue(item: Destination) {
  return item.space && isValidSubtype(item.space, item.subtype ?? '') ? `${item.space}:${item.subtype ?? ''}` : '';
}
export function readDestination(value: string): Destination {
  const found = destinations.find(([key]) => key === value);
  if (!found) return {};
  const [space, subtype] = found[0].split(':');
  return { space: space as SpaceId, subtype };
}
const headings: Record<string, Destination> = {
  书: { space: 'book' }, 书籍: { space: 'book' }, 书单: { space: 'book' }, 书房: { space: 'book' }, 小说: { space: 'book' },
  传统文学: { space: 'book', subtype: 'traditional' }, 网文: { space: 'book', subtype: 'web' }, 轻小说: { space: 'book', subtype: 'light' },
  电影: { space: 'film', subtype: 'movie' }, 片单: { space: 'film' }, 放映厅: { space: 'film' }, 电视剧: { space: 'film', subtype: 'series' },
  歌曲: { space: 'music', subtype: 'song' }, 歌单: { space: 'music', subtype: 'song' }, 歌手: { space: 'music', subtype: 'artist' }, 音乐: { space: 'music' }, 唱片馆: { space: 'music' },
  游戏: { space: 'game', subtype: '' }, 游戏室: { space: 'game', subtype: '' }, 人物: { space: 'person', subtype: '' }, 人物长廊: { space: 'person', subtype: '' },
};
export function parseMixedList(text: string, fallback: Destination = {}) {
  const groups: IntakeGroup[] = [{ id: 'root', label: '未分组', ...fallback }];
  const entries: MixedEntry[] = [];
  let group = groups[0];
  for (const entry of parseIntakeLines(text)) {
    // Only explicitly marked headings carry classification. A bare title never does.
    const marked = entry.raw.trim().match(/^(?:#{1,6}\s+(.+?)\s*[:：]?|(.+?)\s*[:：])$/);
    const heading = (marked?.[1] ?? marked?.[2] ?? '').replace(/[:：]$/, '').trim();
    if (heading && headings[heading]) {
      group = { id: `group-${entry.line}`, label: heading, ...headings[heading] };
      groups.push(group); continue;
    }
    if (entry.status === 'blank') continue;
    const split = entry.name.match(/^(.+?)\s+[—–-]\s+(.+)$/) ?? entry.name.match(/^(《[^》]+》)\s*[—–-]\s*(.+)$/);
    const name = split ? parseIntakeLines(split[1])[0].name : entry.name;
    entries.push({ ...entry, name, creator: split?.[2].trim() ?? '', group: group.id, space: group.space, subtype: group.subtype });
  }
  return { groups: groups.filter(g => entries.some(e => e.group === g.id)), entries };
}
const canonical = (title: string) => title.normalize('NFKC').replace(/[\s：:。]/g, '').toLocaleLowerCase();
export function classifyMixed(entries: MixedEntry[], existing: Collection[]): MixedEntry[] {
  const library = new Set(existing.map(item => `${item.space}::${canonical(item.title)}`));
  const seen = new Set<string>();
  return entries.map(original => {
    const entry = { ...original };
    const valid = validateEntryName(entry.name);
    if (valid.status === 'invalid' || entry.creator.length > 120) {
      entry.status = 'invalid'; entry.reason = entry.creator.length > 120 ? '创作者超过 120 字' : valid.reason; return entry;
    }
    if (!destinationValue(entry)) { entry.status = 'unclassified'; entry.reason = '待选择类别'; return entry; }
    const key = `${entry.space}::${canonical(entry.name)}`;
    entry.status = library.has(key) || seen.has(key) ? 'duplicate' : 'ok';
    entry.reason = library.has(key) ? '馆藏已有同名，默认跳过' : seen.has(key) ? '本次清单中同名，默认跳过' : '';
    seen.add(key);
    return entry;
  });
}
export const mixedIncluded = (entry: MixedEntry) => (entry.status === 'ok' || entry.status === 'duplicate') && (entry.keep ?? entry.status === 'ok');
