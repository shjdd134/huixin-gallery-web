import { db, type Collection } from './db';

export type TreasureLevel = 'interest' | 'like' | 'adore';
export const treasureLevels = [
  { id: 'interest', label: '感兴趣' },
  { id: 'like', label: '喜欢' },
  { id: 'adore', label: '热爱' },
] as const;

export function isLoveLevel(value: unknown): value is Collection['loveLevel'] {
  return value === 'interest' || value === 'like' || value === 'love' || value === 'adore';
}

// Preserve the old "very liked" raw value. Reading a page must not rewrite it.
export function getTreasureLevel(item: Pick<Collection, 'loveLevel'>): TreasureLevel {
  return item.loveLevel === 'love' ? 'like' : item.loveLevel;
}

export async function setTreasureLevel(item: Collection, level: TreasureLevel): Promise<Collection> {
  if (!treasureLevels.some(option => option.id === level)) throw new Error('请选择有效的珍藏等级。');
  if (!isLoveLevel(item.loveLevel)) throw new Error('原收藏的等级无效，请重新打开后再调整。');
  const loveLevel = getTreasureLevel(item) === level ? item.loveLevel : level;
  const result = await db.transaction('rw', db.collections, async () => {
    const latest = await db.collections.get(item.id);
    if (!latest) throw new Error('这件收藏已在另一个页面移除，未重新创建。');
    if (latest.loveLevel !== item.loveLevel && latest.loveLevel !== loveLevel) throw new Error('等级已在另一个页面改动。请重新选择等级，再继续调整。');
    if (latest.loveLevel === loveLevel) return latest;
    const updatedAt = new Date().toISOString();
    // A grade operation must not normalize personal text or rewrite a snapshot.
    await db.collections.update(item.id, { loveLevel, updatedAt });
    return { ...latest, loveLevel, updatedAt };
  });
  if (navigator.storage?.persist) void navigator.storage.persist().catch(() => false);
  return result;
}
