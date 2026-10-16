import JSZip from 'jszip';
import { db, ENCOUNTER_TEXT_MAX, QUOTE_MAX, type Collection } from './db';
import { DISCOVERY_KEY, getDiscoveryState } from '../features/discovery/store';
import { emptyDiscovery, validateDiscovery, type DiscoveryState } from '../features/discovery/model';
import { isSpaceId, isValidSubtype } from './spaces';
import { validateIntroduction } from './introduction';
import { isLoveLevel } from './levels';

export interface Backup { items: Collection[]; home?: string[]; discovery?: DiscoveryState }
interface StoredItem extends Omit<Collection, 'cover' | 'thumbnail'> { coverPath?: string; thumbnailPath?: string; coverType?: string; thumbnailType?: string }
const MAX_PACK = 100 * 1024 * 1024;
const MAX_UNPACKED = 250 * 1024 * 1024;
const HOME_IDS_MAX = 1000;
const COLLECTIONS_MAX = 10000;
const JOURNAL_ENTRIES_MAX = 10000;
const imageTypes = ['image/png', 'image/jpeg', 'image/webp'];
const fail = () => { throw new Error('这不是完整有效的会心馆备份，现有收藏没有被修改。'); };
const validDate = (value: unknown) => typeof value === 'string' && Number.isFinite(Date.parse(value));
const validText = (value: unknown, max: number) => typeof value === 'string' && value.length <= max;

export async function createBackup(): Promise<Blob> {
  // Capture all related records together. Blob reads and ZIP compression happen
  // after this short transaction, so other tabs can save without mixing snapshots.
  const { items, home, discovery, exportedAt } = await db.transaction('r', db.collections, db.meta, async () => {
    const [items, layout, discovery] = await Promise.all([
      db.collections.toArray(), db.meta.get('home-layout-v1'), getDiscoveryState(),
    ]);
    return { items, home: layout?.value, discovery, exportedAt: new Date().toISOString() };
  });
  if (items.length > COLLECTIONS_MAX) throw new Error(`当前完整备份支持最多 ${COLLECTIONS_MAX} 件收藏。`);
  if (items.some(item => !isLoveLevel(item.loveLevel))) throw new Error('有收藏的等级无效，未生成无法恢复的备份。现有馆藏没有改变。');
  if (items.some(item => item.journal.length > JOURNAL_ENTRIES_MAX)) throw new Error(`单件收藏的追加记录超过本版备份的 ${JOURNAL_ENTRIES_MAX} 条上限，未生成无法恢复的文件。现有馆藏没有改变。`);
  const imageBytes = items.reduce((sum, item) => sum + (item.cover?.size || 0) + (item.thumbnail?.size || 0), 0);
  if (imageBytes > MAX_UNPACKED - 15 * 1024 * 1024) throw new Error('馆藏图片总量超过本版备份容量，请先移除不需要的大图。现有馆藏没有改变。');
  const zip = new JSZip();
  const entries: StoredItem[] = [];
  for (const item of items) {
    const { cover, thumbnail, ...record } = item;
    const stored: StoredItem = { ...record };
    if (cover) { stored.coverPath = `images/${item.id}/cover`; stored.coverType = cover.type; zip.file(stored.coverPath, await cover.arrayBuffer(), { createFolders: false }); }
    if (thumbnail) { stored.thumbnailPath = `images/${item.id}/thumbnail`; stored.thumbnailType = thumbnail.type; zip.file(stored.thumbnailPath, await thumbnail.arrayBuffer(), { createFolders: false }); }
    entries.push(stored);
  }
  let homeIds: unknown = [];
  if (home) { try { homeIds = JSON.parse(home); } catch { homeIds = []; } }
  // Only the new interest value needs v5. Older APKs must reject it rather than
  // silently losing a level; unchanged collections remain exportable as v4.
  const version = items.some(item => item.loveLevel === 'interest') ? 5 : 4;
  const metadata = JSON.stringify({ format: 'huixin-gallery', version, discovery, exportedAt, collections: entries, home: Array.isArray(homeIds) ? homeIds : [] });
  if (new Blob([metadata]).size > 15 * 1024 * 1024) throw new Error('记录文字超过本版备份容量，暂时无法生成完整包。现有馆藏没有改变。');
  zip.file('huixin.json', metadata);
  const archive = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 4 } });
  if (archive.size > MAX_PACK) throw new Error('完整备份超过本版 100 MB 上限，未下载无法恢复的文件。请先移除不需要的大图，现有馆藏没有改变。');
  return archive;
}

export async function readBackup(file: Blob): Promise<Backup> {
  if (file.size > MAX_PACK) throw new Error('备份包超过 100 MB，请先在原设备减少不需要的大图。');
  let zip: JSZip;
  try { zip = await JSZip.loadAsync(await file.arrayBuffer(), { checkCRC32: false }); }
  catch { return fail(); }
  let total = 0;
  // Older exports contain one image directory per item plus the root directory.
  // Accept those at the same 10000-item limit, without allowing extra payloads.
  const entries = Object.values(zip.files);
  if (entries.length > COLLECTIONS_MAX * 3 + 2 || entries.filter(entry => !entry.dir).length > COLLECTIONS_MAX * 2 + 1) return fail();
  for (const entry of Object.values(zip.files)) {
    if (entry.dir) continue;
    const size = (entry as unknown as { _data: { uncompressedSize: number } })._data?.uncompressedSize;
    if (!Number.isFinite(size) || size < 0) return fail();
    total += size;
    if (total > MAX_UNPACKED || size > 15 * 1024 * 1024) return fail();
  }
  // Check CRC only after expansion limits, so a damaged ZIP never replaces data.
  try { zip = await JSZip.loadAsync(await file.arrayBuffer(), { checkCRC32: true }); }
  catch { return fail(); }
  const metadata = zip.file('huixin.json');
  if (!metadata) return fail();
  let parsed: { format?: unknown; version?: unknown; collections?: unknown; home?: unknown; discovery?: unknown };
  try { parsed = JSON.parse(await metadata.async('string')); }
  catch { return fail(); }
  if (parsed.format !== 'huixin-gallery' || typeof parsed.version !== 'number' || !Number.isInteger(parsed.version) || parsed.version < 1 || parsed.version > 5 || !Array.isArray(parsed.collections) || parsed.collections.length > COLLECTIONS_MAX) return fail();
  const version = parsed.version as 1 | 2 | 3 | 4 | 5;
  // version 2 added encounterText/quote and the home layout. v1 backups keep restoring with
  // defaults; a v2 backup is rejected outright by pre-v2 programs instead of silently losing fields.
  let home: string[] | undefined;
  if (version >= 2) {
    const raw = parsed.home;
    if (raw === undefined) home = undefined;
    else if (!Array.isArray(raw) || raw.length > HOME_IDS_MAX || !raw.every(id => typeof id === 'string' && /^[a-zA-Z0-9-]{1,80}$/.test(id)) || new Set(raw).size !== raw.length) return fail();
    else home = [...raw] as string[];
  }
  let discovery = emptyDiscovery();
  if (version >= 3) { try { discovery = validateDiscovery(parsed.discovery); } catch { return fail(); } }
  const ids = new Set<string>();
  const result: Collection[] = [];
  for (const data of parsed.collections) {
    if (!data || typeof data !== 'object') return fail();
    const item = data as StoredItem;
    if (typeof item.id !== 'string' || !/^[a-zA-Z0-9-]{1,80}$/.test(item.id) || ids.has(item.id) || !isSpaceId(item.space) || !validText(item.title, 120) || !item.title.trim() || !validText(item.creator, 120) || !validText(item.note, 10000) || !validText(item.filmList, 80) || typeof item.treasure !== 'boolean' || typeof item.revisit !== 'boolean' || !isLoveLevel(item.loveLevel) || (version < 5 && item.loveLevel === 'interest') || !validDate(item.createdAt) || !validDate(item.updatedAt)) return fail();
    if (version >= 2 && (!validText(item.encounterText, ENCOUNTER_TEXT_MAX) || !validText(item.quote, QUOTE_MAX))) return fail();
    const encounterText = validText(item.encounterText, ENCOUNTER_TEXT_MAX) ? item.encounterText : '';
    const quote = validText(item.quote, QUOTE_MAX) ? item.quote : '';
    let introduction;
    if (version >= 4) { try { introduction = validateIntroduction(item.introduction); } catch { return fail(); } }
    if (!isValidSubtype(item.space, item.subtype)) return fail();
    if (!Array.isArray(item.tags) || item.tags.length > 12 || !item.tags.every(tag => validText(tag, 600)) || !Array.isArray(item.journal) || item.journal.length > JOURNAL_ENTRIES_MAX || !item.journal.every(note => note && typeof note.id === 'string' && note.id.length <= 80 && validText(note.text, 10000) && validDate(note.date))) return fail();
    ids.add(item.id);
    async function readImage(path: string | undefined, mime: string | undefined, kind: string) {
      if (path === undefined && mime === undefined) return undefined;
      if (path !== `images/${item.id}/${kind}` || !mime || !imageTypes.includes(mime)) return fail();
      const entry = zip.file(path);
      if (!entry) return fail();
      const image = new Blob([await entry.async('arraybuffer')], { type: mime });
      try { const decoded = await createImageBitmap(image); decoded.close(); }
      catch { return fail(); }
      return image;
    }
    const cover = await readImage(item.coverPath, item.coverType, 'cover');
    const thumbnail = await readImage(item.thumbnailPath, item.thumbnailType, 'thumbnail');
    // Construct known fields explicitly; never restore arbitrary properties from a file.
    result.push({ id: item.id, space: item.space, subtype: item.subtype, title: item.title, creator: item.creator, introduction, loveLevel: item.loveLevel, note: item.note, encounterText, quote, tags: [...new Set(item.tags)], filmList: item.filmList, treasure: item.treasure, revisit: item.revisit, journal: item.journal.map(note => ({ id: note.id, text: note.text, date: note.date })), createdAt: item.createdAt, updatedAt: item.updatedAt, cover, thumbnail });
  }
  return { items: result, home, discovery };
}

export async function restoreBackup(backup: Backup) {
  const discovery = validateDiscovery(backup.discovery || emptyDiscovery());
  await db.transaction('rw', db.collections, db.meta, async () => {
    await db.collections.clear();
    await db.collections.bulkAdd(backup.items);
    // A v2 backup carries the saved home layout; a v1 backup has none, so the old
    // layout could reference collections that no longer exist and is reset instead.
    if (backup.home) await db.meta.put({ key: 'home-layout-v1', value: JSON.stringify(backup.home) });
    else await db.meta.delete('home-layout-v1');
    await db.meta.put({ key: DISCOVERY_KEY, value: JSON.stringify(discovery) });
  });
}
