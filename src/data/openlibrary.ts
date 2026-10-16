export interface BookHit {
  title: string;
  author: string;
  coverId?: number;
  key: string;
  firstSentence?: string;
}

export async function searchBooks(query: string): Promise<BookHit[]> {
  const q = query.trim();
  if (!q) return [];
  const url = `https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&limit=6&fields=key,title,author_name,cover_i,first_sentence`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('搜索失败');
  const data = await res.json();
  return (data.docs || []).map((d: any) => ({
    title: d.title || '',
    author: (d.author_name || [])[0] || '',
    coverId: d.cover_i,
    key: d.key,
    firstSentence: Array.isArray(d.first_sentence) ? d.first_sentence[0] : d.first_sentence,
  })).filter((h: BookHit) => h.title);
}

export function coverUrl(coverId?: number) {
  return coverId ? `https://covers.openlibrary.org/b/id/${coverId}-L.jpg` : '';
}

export async function fetchDescription(workKey: string): Promise<string> {
  try {
    const res = await fetch(`https://openlibrary.org${workKey}.json`);
    if (!res.ok) return '';
    const data = await res.json();
    const desc = data.description;
    if (!desc) return '';
    return typeof desc === 'string' ? desc : (desc.value || '');
  } catch {
    return '';
  }
}
