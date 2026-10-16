import { db, type Collection } from './db';

// Home curation lives in the meta table, separate from collections, so it
// survives collection edits and is carried inside complete backups (v2+).
export const HOME_LAYOUT_KEY = 'home-layout-v1';
export const HOME_LAYOUT_MAX = 1000;

/** Ordered collection ids shown on the home page. Empty array means "not curated". */
export async function getHomeLayout(): Promise<string[]> {
  const row = await db.meta.get(HOME_LAYOUT_KEY);
  if (!row?.value) return [];
  try {
    const parsed = JSON.parse(row.value);
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
  } catch { return []; }
}

/**
 * Persist the home page selection and display order (array order = display order).
 * One atomic put: last writer wins, there is no merge. Ids that reference
 * collections deleted later are simply skipped by consumers — do not throw for them.
 */
export async function setHomeLayout(ids: string[]): Promise<void> {
  if (!Array.isArray(ids)) throw new Error('首页布置需要一份收藏列表。');
  if (ids.length > HOME_LAYOUT_MAX) throw new Error(`首页布置最多选择 ${HOME_LAYOUT_MAX} 件收藏。`);
  const cleaned = [...new Set(ids.map(id => {
    if (typeof id !== 'string' || !/^[a-zA-Z0-9-]{1,80}$/.test(id)) throw new Error('首页布置里有无法识别的收藏编号。');
    return id;
  }))];
  await db.meta.put({ key: HOME_LAYOUT_KEY, value: JSON.stringify(cleaned) });
}

/** Remove the curation entirely (home falls back to its default presentation). */
export async function clearHomeLayout(): Promise<void> {
  await db.meta.delete(HOME_LAYOUT_KEY);
}

/** Resolve saved ids to collection records in saved order; unknown ids are skipped. */
export async function resolveHomeItems(ids: string[]): Promise<Collection[]> {
  const records = await db.collections.bulkGet(ids);
  const byId = new Map(records.filter(Boolean).map(record => [record!.id, record!] as const));
  return [...new Set(ids)].filter(id => byId.has(id)).map(id => byId.get(id)!);
}
