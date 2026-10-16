import Dexie, { type EntityTable } from 'dexie';
import { defaultSubtype, isSpaceId, isValidSubtype, type SpaceId } from './spaces';
import { validateIntroduction, type Introduction } from './introduction';
import { isLoveLevel } from './levels';

export interface JournalEntry { id: string; text: string; date: string }
export interface Collection {
  id: string;
  space: SpaceId;
  subtype: string;
  title: string;
  creator: string;
  /** 作品/人物介绍与出处；与个人喜欢理由分开。旧记录可缺省。 */
  introduction?: Introduction;
  cover?: Blob;
  thumbnail?: Blob;
  loveLevel: 'interest' | 'like' | 'love' | 'adore';
  note: string;
  /** 这份喜欢是什么时候遇见的，自由文本，最多 2000 字。 */
  encounterText: string;
  /** 想留下的一句话，最多 500 字。 */
  quote: string;
  tags: string[];
  filmList: string;
  journal: JournalEntry[];
  treasure: boolean;
  revisit: boolean;
  createdAt: string;
  updatedAt: string;
}

export const ENCOUNTER_TEXT_MAX = 2000;
export const QUOTE_MAX = 500;

export const db = new Dexie('huixin-gallery') as Dexie & { collections: EntityTable<Collection, 'id'>; meta: EntityTable<{ key: string; value: string }, 'key'> };
db.version(1).stores({ collections: 'id, space, subtype, createdAt, updatedAt, *tags, filmList' });
db.version(2).stores({ collections: 'id, space, subtype, createdAt, updatedAt, *tags, filmList', meta: 'key' });
db.version(3).stores({ collections: 'id, space, subtype, createdAt, updatedAt, *tags, filmList', meta: 'key' })
  .upgrade(async transaction => {
    // v2 records predate encounterText/quote; fill defaults once so stored data stays uniform.
    await transaction.table('collections').toCollection().modify(item => {
      if (typeof item.encounterText !== 'string') item.encounterText = '';
      if (typeof item.quote !== 'string') item.quote = '';
    });
  });

export function newCollection(space: SpaceId): Collection {
  const now = new Date().toISOString();
  return { id: crypto.randomUUID(), space, subtype: defaultSubtype(space), title: '', creator: '', loveLevel: 'like', note: '', encounterText: '', quote: '', tags: [], filmList: '', journal: [], treasure: false, revisit: false, createdAt: now, updatedAt: now };
}

async function sameValue(left: unknown, right: unknown): Promise<boolean> {
  if (left === right) return true;
  if (left instanceof Blob && right instanceof Blob) {
    if (left.size !== right.size || left.type !== right.type) return false;
    const [a, b] = await Promise.all([left.arrayBuffer(), right.arrayBuffer()]);
    const bytesA = new Uint8Array(a), bytesB = new Uint8Array(b);
    return bytesA.every((byte, index) => byte === bytesB[index]);
  }
  if (Array.isArray(left) && Array.isArray(right)) return JSON.stringify(left) === JSON.stringify(right);
  if (left && right && typeof left === 'object' && typeof right === 'object') return JSON.stringify(left) === JSON.stringify(right);
  return false;
}

export async function saveCollection(item: Collection, baseline?: Collection) {
  const title = item.title.trim();
  if (!title) throw new Error('先写一个名称，就可以留下它。');
  if (title.length > 120) throw new Error('名称请控制在 120 字以内。');
  if (!isSpaceId(item.space)) throw new Error('请选择有效的收藏空间。');
  if (!isValidSubtype(item.space, item.subtype)) throw new Error('请选择有效的收藏类别。');
  if (!isLoveLevel(item.loveLevel)) throw new Error('请选择有效的珍藏等级。');
  const encounterText = (item.encounterText || '').trim();
  if (encounterText.length > ENCOUNTER_TEXT_MAX) throw new Error(`什么时候遇见的，请控制在 ${ENCOUNTER_TEXT_MAX} 字以内。`);
  const quote = (item.quote || '').trim();
  if (quote.length > QUOTE_MAX) throw new Error(`想留下的一句话，请控制在 ${QUOTE_MAX} 字以内。`);
  const introduction = validateIntroduction(item.introduction);
  const normalized = { ...item, introduction, title, creator: item.creator.trim(), encounterText, quote, tags: [...new Set(item.tags.map(tag => tag.trim()).filter(Boolean))].slice(0, 12), updatedAt: new Date().toISOString() };
  const stored = await db.transaction('rw', db.collections, async () => {
    const latest = await db.collections.get(item.id);
    if (baseline && !latest) throw new Error('这件收藏已在另一个页面移除，未重新创建。请关闭编辑后查看馆藏。');
    if (baseline && latest) {
      const edited: Collection = { ...latest, updatedAt: normalized.updatedAt };
      const fields = ['space', 'subtype', 'title', 'creator', 'introduction', 'cover', 'thumbnail', 'loveLevel', 'note', 'encounterText', 'quote', 'tags', 'filmList', 'treasure', 'revisit'] as const;
      for (const field of fields) {
        const before = field === 'tags' || field === 'introduction' ? JSON.stringify(baseline[field]) : baseline[field];
        const next = field === 'tags' || field === 'introduction' ? JSON.stringify(normalized[field]) : normalized[field];
        if (before !== next) {
          // Reject overlapping edits; independent changes (such as new notes) survive.
          // Blob reads use Dexie.waitFor to keep the transaction alive across awaits.
          const equalToBase = await Dexie.waitFor(sameValue(latest[field], baseline[field]));
          const equalToNext = equalToBase || await Dexie.waitFor(sameValue(latest[field], normalized[field]));
          if (!equalToBase && !equalToNext) throw new Error('这项内容已在另一个页面改动。请关闭并重新打开收藏，再继续编辑。');
          Object.assign(edited, { [field]: normalized[field] });
        }
      }
      if (!['book', 'music', 'film'].includes(edited.space)) edited.subtype = '';
      if (!isValidSubtype(edited.space, edited.subtype)) throw new Error('收藏空间已在另一个页面改变，请重新打开收藏再编辑。');
      if (edited.space !== 'film') edited.filmList = '';
      // The editor cannot edit journal entries: preserve the latest ones across tabs.
      await db.collections.put(edited);
      return edited;
    } else {
      const entries = new Map((latest?.journal || []).map(entry => [entry.id, entry]));
      for (const entry of item.journal) if (!entries.has(entry.id)) entries.set(entry.id, entry);
      const record = { ...normalized, createdAt: latest?.createdAt || normalized.createdAt, journal: [...entries.values()] };
      await db.collections.put(record);
      return record;
    }
  });
  // This remains a local database. Persistence reduces browser eviction where supported.
  if (navigator.storage?.persist) void navigator.storage.persist().catch(() => false);
  return stored;
}

export async function toggleMarker(id: string, field: 'treasure' | 'revisit') {
  await db.transaction('rw', db.collections, async () => {
    const latest = await db.collections.get(id);
    if (!latest) throw new Error('这件收藏已经被移除。');
    const updatedAt = new Date().toISOString();
    await db.collections.update(id, field === 'treasure' ? { treasure: !latest.treasure, updatedAt } : { revisit: !latest.revisit, updatedAt });
  });
}

export async function appendJournal(id: string, text: string) {
  if (!text.trim() || text.length > 10000) throw new Error('记录请控制在 1-10000 字。');
  const entry: JournalEntry = { id: crypto.randomUUID(), text: text.trim(), date: new Date().toISOString() };
  await db.transaction('rw', db.collections, async () => {
    const latest = await db.collections.get(id);
    if (!latest) throw new Error('这件收藏已经被移除。');
    await db.collections.update(id, { journal: [...latest.journal, entry], updatedAt: new Date().toISOString() });
  });
  return entry;
}

function checkJournal(current: JournalEntry | undefined, baseline: JournalEntry) {
  if (!current || current.text !== baseline.text || current.date !== baseline.date) throw new Error('这则手记已在另一个页面修改或删除。你的输入仍保留，请核对最新记录后再继续。');
}

export async function updateJournal(id: string, baseline: JournalEntry, text: string): Promise<JournalEntry> {
  if (!text.trim() || text.length > 10000) throw new Error('记录请控制在 1-10000 字。');
  const edited = { ...baseline, text: text.trim() };
  await db.transaction('rw', db.collections, async () => {
    const latest = await db.collections.get(id);
    if (!latest) throw new Error('这件收藏已经被移除，手记没有重新创建。');
    checkJournal(latest.journal.find(entry => entry.id === baseline.id), baseline);
    await db.collections.update(id, { journal: latest.journal.map(entry => entry.id === baseline.id ? edited : entry), updatedAt: new Date().toISOString() });
  });
  return edited;
}

export async function removeJournal(id: string, baseline: JournalEntry) {
  await db.transaction('rw', db.collections, async () => {
    const latest = await db.collections.get(id);
    if (!latest) throw new Error('这件收藏已经被移除。');
    checkJournal(latest.journal.find(entry => entry.id === baseline.id), baseline);
    await db.collections.update(id, { journal: latest.journal.filter(entry => entry.id !== baseline.id), updatedAt: new Date().toISOString() });
  });
}

export async function restoreJournal(id: string, entry: JournalEntry, index: number) {
  await db.transaction('rw', db.collections, async () => {
    const latest = await db.collections.get(id);
    if (!latest) throw new Error('这件收藏已经被移除，无法撤销手记删除。');
    if (latest.journal.some(current => current.id === entry.id)) throw new Error('这则手记已恢复，请核对最新记录。');
    const journal = [...latest.journal]; journal.splice(Math.max(0, Math.min(index, journal.length)), 0, entry);
    await db.collections.update(id, { journal, updatedAt: new Date().toISOString() });
  });
}

export function matchesSearch(item: Collection, query: string) {
  const text = [item.title, item.creator, item.note, item.encounterText || '', item.quote || '', ...item.tags, item.filmList, ...item.journal.map(entry => entry.text)].join(' ').normalize('NFKC').toLocaleLowerCase();
  return query.normalize('NFKC').trim().toLocaleLowerCase().split(/\s+/).every(word => text.includes(word));
}

export const storageError = (error: unknown) => error instanceof DOMException && error.name === 'QuotaExceededError' ? '本机存储空间不足。请先导出备份，再清理不需要的封面。' : error instanceof Error && error.name === 'DatabaseClosedError' ? '无法打开本机收藏。请检查浏览器是否允许本地存储。' : error instanceof Error ? error.message : '这次没能保存，请稍后再试。';
