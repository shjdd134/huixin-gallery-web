/** Website addresses are user supplied and never fetched automatically. */
export function normalizeWebsiteUrl(value: string): string {
  const input = value.trim();
  if (!input) throw new Error('请填写网站地址。');
  if (input.length > 2048 || /[\u0000-\u0020\u007f]/.test(input)) throw new Error('网站地址无效，请检查后重试。');
  const candidate = /^[a-z][a-z0-9+.-]*:/i.test(input) ? input : `https://${input}`;
  let url: URL;
  try { url = new URL(candidate); } catch { throw new Error('请填写有效的网站地址，例如 https://example.com。'); }
  if (!['https:', 'http:'].includes(url.protocol) || !url.hostname || url.username || url.password) throw new Error('仅支持不含登录凭据的 http 或 https 网站地址。');
  if (url.href.length > 2048) throw new Error('网站地址过长。');
  return url.href;
}
export function websiteLink(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try { return normalizeWebsiteUrl(value); } catch { return undefined; }
}
