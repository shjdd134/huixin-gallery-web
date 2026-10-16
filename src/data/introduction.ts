export interface Introduction {
  text: string;
  sourceName: string;
  sourceUrl: string;
  kind: 'official-summary' | 'edited';
}
export const INTRODUCTION_MAX = 2000;

export function validateIntroduction(value: unknown): Introduction | undefined {
  if (value === undefined) return undefined;
  if (!value || typeof value !== 'object') throw new Error('简介格式无效。');
  const item = value as Introduction;
  if (typeof item.text !== 'string' || item.text.length > INTRODUCTION_MAX
    || typeof item.sourceName !== 'string' || item.sourceName.length > 120
    || typeof item.sourceUrl !== 'string' || item.sourceUrl.length > 2048
    || !['official-summary', 'edited'].includes(item.kind)) throw new Error('简介格式无效。');
  if (item.sourceUrl) {
    let url: URL;
    try { url = new URL(item.sourceUrl); } catch { throw new Error('简介出处链接无效。'); }
    if (url.protocol !== 'https:' || url.username || url.password) throw new Error('简介出处须为有效的 HTTPS 链接。');
  }
  if (item.kind === 'official-summary' && (!item.text.trim() || !item.sourceName.trim() || !item.sourceUrl)) throw new Error('官方资料整理须保留内容和出处。');
  return { text: item.text, sourceName: item.sourceName, sourceUrl: item.sourceUrl, kind: item.kind };
}
