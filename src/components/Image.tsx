import { useEffect, useState } from 'react';

export function useBlobUrl(blob?: Blob) {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    if (!blob) { setUrl(undefined); return; }
    const next = URL.createObjectURL(blob);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [blob]);
  return url;
}

export function Atmosphere({ src, className = '', priority = false }: { src: string; className?: string; priority?: boolean }) {
  const [failed, setFailed] = useState(false);
  return failed ? <div className={`atmosphere image-fallback ${className}`} aria-hidden="true" /> : <img className={`atmosphere ${className}`} src={src} alt="" aria-hidden="true" loading={priority ? 'eager' : 'lazy'} fetchPriority={priority ? 'high' : 'auto'} decoding="async" width="1536" height="1024" onError={() => setFailed(true)} />;
}
