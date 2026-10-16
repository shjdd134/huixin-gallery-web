export async function compressCover(file: File): Promise<{ cover: Blob; thumbnail: Blob }> {
  if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'].includes(file.type)) throw new Error('请选择 JPG、PNG、WebP、GIF 或 AVIF 图片。');
  if (file.size > 12 * 1024 * 1024) throw new Error('图片请小于 12 MB。');
  let bitmap: ImageBitmap;
  try { bitmap = await createImageBitmap(file); }
  catch { throw new Error('这张图片无法读取，请换一张。'); }
  try {
    async function resize(max: number, quality: number) {
      const ratio = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(bitmap.width * ratio));
      canvas.height = Math.max(1, Math.round(bitmap.height * ratio));
      const context = canvas.getContext('2d');
      if (!context) throw new Error('当前浏览器暂不支持图片处理。');
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      return new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('图片处理失败，请换一张。')), 'image/webp', quality));
    }
    return { cover: await resize(1440, .86), thumbnail: await resize(480, .78) };
  } finally { bitmap.close(); }
}
