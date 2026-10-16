import { db, type Collection } from './db';

function unchanged(latest: Collection, baseline: Collection) {
  // Imported records have no media. Any subsequent cover addition counts as an edit.
  if (latest.cover || latest.thumbnail || baseline.cover || baseline.thumbnail) return false;
  const keys = [...new Set([...Object.keys(latest), ...Object.keys(baseline)])].sort() as (keyof Collection)[];
  return keys.every(key => JSON.stringify(latest[key]) === JSON.stringify(baseline[key]));
}
export async function undoImportedCollections(snapshots: Collection[]) {
  if (!Array.isArray(snapshots) || snapshots.length > 10000 || new Set(snapshots.map(i => i.id)).size !== snapshots.length) throw new Error('这份导入记录无效。');
  return db.transaction('rw', db.collections, async () => {
    const removed: string[] = [], retained: string[] = [], missing: string[] = [];
    for (const original of snapshots) {
      const latest = await db.collections.get(original.id);
      if (!latest) missing.push(original.id);
      else if (unchanged(latest, original)) removed.push(original.id);
      else retained.push(original.id);
    }
    await db.collections.bulkDelete(removed);
    return { removed, retained, missing };
  });
}
