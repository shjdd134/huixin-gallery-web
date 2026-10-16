import { db, newCollection, ENCOUNTER_TEXT_MAX, QUOTE_MAX, type Collection } from './db';
import { isSpaceId, isValidSubtype, defaultSubtype, type SpaceId } from './spaces';
import { canonicalTitle } from './personal';
import { isLoveLevel } from './levels';

export interface BatchItemInput {
  space: SpaceId;
  subtype?: string;
  title: string;
  creator?: string;
  note?: string;
  encounterText?: string;
  quote?: string;
  tags?: string[];
  loveLevel?: Collection['loveLevel'];
  filmList?: string;
  treasure?: boolean;
  revisit?: boolean;
  /**
   * 用户在预览中明确勾选「仍然添加」时置为 true：跳过重复检查，作为一条新收藏写入，
   * 不覆盖已有记录。未勾选的条目一律在提交事务内对照最新馆藏跳过重复。
   */
  allowDuplicate?: boolean;
}

export interface BatchFailure { index: number; title: string; reason: string }
export interface BatchResult {
  /** 输入条数。 */
  requested: number;
  /** 实际写入的条数。 */
  added: number;
  /** 因重复而被跳过的条数。 */
  skipped: number;
  /** 输入校验失败条目，index 是在输入数组中的下标。 */
  failed: BatchFailure[];
  /** 新增收藏的 id，按输入顺序排列。 */
  ids: string[];
  /** 新增的完整记录，与 ids 同序。 */
  items: Collection[];
}

/** 纯输入校验与记录构造；不触碰数据库，抛出的都是可逐条统计的校验错误。 */
function buildBatchRecord(input: BatchItemInput, now: string): Collection {
  const title = typeof input?.title === 'string' ? input.title.trim() : '';
  if (!title) throw new Error('名称不能为空。');
  if (title.length > 120) throw new Error('名称请控制在 120 字以内。');
  if (!isSpaceId(input.space)) throw new Error('请选择有效的收藏空间。');
  const subtype = input.subtype ?? defaultSubtype(input.space);
  if (!isValidSubtype(input.space, subtype)) throw new Error('请选择有效的收藏类别。');
  const note = (input.note || '').trim();
  if (note.length > 10000) throw new Error('喜欢理由请控制在 10000 字以内。');
  const encounterText = (input.encounterText || '').trim();
  if (encounterText.length > ENCOUNTER_TEXT_MAX) throw new Error(`什么时候遇见的，请控制在 ${ENCOUNTER_TEXT_MAX} 字以内。`);
  const quote = (input.quote || '').trim();
  if (quote.length > QUOTE_MAX) throw new Error(`想留下的一句话，请控制在 ${QUOTE_MAX} 字以内。`);
  const creator = (input.creator || '').trim();
  if (creator.length > 120) throw new Error('作者/创作者请控制在 120 字以内。');
  const tags = [...new Set((input.tags || []).map(tag => String(tag).trim()).filter(Boolean))];
  if (tags.length > 12) throw new Error('最多 12 个标签。');
  if (tags.some(tag => tag.length > 600)) throw new Error('单个标签请控制在 600 字以内。');
  const loveLevel = input.loveLevel || 'like';
  if (!isLoveLevel(loveLevel)) throw new Error('珍藏等级无效。');
  const filmList = input.space === 'film' ? (input.filmList || '').trim().slice(0, 80) : '';
  return { ...newCollection(input.space), id: crypto.randomUUID(), subtype, title, creator, note, encounterText, quote, tags, loveLevel, filmList, treasure: !!input.treasure, revisit: !!input.revisit, createdAt: now, updatedAt: now };
}

/**
 * 批量添加收藏。整个调用在同一个读写事务内执行，语义分两类：
 * - 输入校验错误（名称、空间、长度等）：逐条记入 failed，不写入、不中断其他条目；
 * - 数据库写入错误（存储不足等）：不捕获、直接抛出，整个事务回滚，一条都不会留下，
 *   现有馆藏不变。调用方应展示 storageError(reason)。
 * 重复判定在提交事务内对照最新馆藏（含本批次已写入的条目）：同空间且名称规范化一致视为重复，
 * 默认跳过；只有条目自带 allowDuplicate: true（用户明确选择仍然添加）才绕过检查。
 */
export async function addCollectionsBatch(inputs: BatchItemInput[]): Promise<BatchResult> {
  if (!Array.isArray(inputs)) throw new Error('批量添加需要一份收藏列表。');
  if (inputs.length > 10000) throw new Error('一次最多批量添加 10000 件收藏。');
  const now = new Date().toISOString();
  return db.transaction('rw', db.collections, async () => {
    const seen = new Map<string, string>(await db.collections.toArray().then(items => items.map(item => [`${item.space}::${canonicalTitle(item.title)}`, item.id] as const)));
    const result: BatchResult = { requested: inputs.length, added: 0, skipped: 0, failed: [], ids: [], items: [] };
    for (const [index, input] of inputs.entries()) {
      const title = typeof input?.title === 'string' ? input.title.trim() : '';
      let record: Collection;
      try {
        record = buildBatchRecord(input, now);
      } catch (reason) {
        result.failed.push({ index, title, reason: reason instanceof Error ? reason.message : '这条收藏无法添加。' });
        continue;
      }
      const key = `${input.space}::${canonicalTitle(record.title)}`;
      if (!input.allowDuplicate && seen.has(key)) { result.skipped++; continue; }
      // Write errors are deliberately not caught: the transaction aborts and
      // rolls the whole batch back, so a partial commit can never happen.
      await db.collections.put(record);
      seen.set(key, record.id);
      result.ids.push(record.id);
      result.items.push(record);
      result.added++;
    }
    return result;
  });
}
