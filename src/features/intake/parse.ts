import type { Collection } from '../../data/db';
import type { SpaceId } from '../../data/spaces';

export type IntakeStatus = 'ok' | 'duplicate' | 'invalid' | 'blank';

export interface IntakeEntry {
  line: number;
  raw: string;
  name: string;
  status: IntakeStatus;
  reason: string;
  // 用户的明确选择；未设置时按状态决定（可添加，疑似重复默认跳过）。
  keep?: boolean;
}

export const intakeTitleLimit = 120;

// 只有明确的编号标点才剥除；数字加空格可能就是作品名称。
const numbering = /^\s*(?:[（(]\s*[0-9０-９]{1,4}\s*[）)]|[0-9０-９]{1,4}\s*[.。、,，:：)）\-–—]\s*)/;
// 「第1章」这类序号只在后面还有分隔符时剥掉，避免误伤《第二十二条军规》《第八个是铜像》。
const ordinal = /^\s*第\s*[0-9０-９一二三四五六七八九十百]{1,6}\s*[个本部首季话卷章节册张]\s*(?:[：:、.．]|\s)\s*/;
const bullet = /^\s*[-•·*●○◆▸›»]\s+/;

function stripDecoration(value: string): string {
  let text = value.trim();
  for (;;) {
    const before = text;
    text = text.replace(numbering, '').replace(ordinal, '').replace(bullet, '').trim();
    if (text.length >= 2 && text.startsWith('《') && text.endsWith('》')) text = text.slice(1, -1).trim();
    if (text === before) break;
  }
  return text;
}

// 名称合法性独立于解析：预览里改名后按新名称重算（超长→合法、合法→空白等）。
export function validateEntryName(name: string): { status: 'ok' | 'invalid'; reason: string } {
  const trimmed = name.trim();
  if (!trimmed) return { status: 'invalid', reason: '名称不能为空' };
  if (trimmed.length > intakeTitleLimit) return { status: 'invalid', reason: `名称超过 ${intakeTitleLimit} 字` };
  return { status: 'ok', reason: '' };
}

export function parseIntakeLines(text: string): IntakeEntry[] {
  return text.split(/\r\n|\r|\n/).map((raw, index) => {
    const entry: IntakeEntry = { line: index + 1, raw, name: '', status: 'blank', reason: '空行' };
    if (!raw.trim()) return entry;
    const name = stripDecoration(raw);
    if (!name) { entry.status = 'invalid'; entry.reason = '只有编号，没有名称'; return entry; }
    entry.name = name;
    const validity = validateEntryName(name);
    entry.status = validity.status;
    entry.reason = validity.reason;
    return entry;
  });
}

// 与馆藏及同批粘贴按规范化名称比对；重复项默认跳过，用户仍可明确勾选添加。
const canonicalTitle = (title: string) => title.normalize('NFKC').replace(/[\s：:。]/g, '').toLocaleLowerCase();

export function markDuplicates(entries: IntakeEntry[], space: SpaceId, existing: Collection[]) {
  const library = new Set(existing.filter(item => item.space === space).map(item => canonicalTitle(item.title)));
  const batch = new Map<string, string>();
  for (const entry of entries) {
    if (entry.status !== 'ok' && entry.status !== 'duplicate') continue;
    const key = canonicalTitle(entry.name);
    if (library.has(key)) { entry.status = 'duplicate'; entry.reason = '馆藏已有同名，默认跳过'; continue; }
    if (batch.has(key)) { entry.status = 'duplicate'; entry.reason = '与本次粘贴中的另一行重复'; continue; }
    batch.set(key, entry.name);
    entry.status = 'ok';
    entry.reason = '';
  }
  return entries;
}

export const entryIncluded = (entry: IntakeEntry) =>
  (entry.status === 'ok' || entry.status === 'duplicate') && (entry.keep ?? entry.status === 'ok');
