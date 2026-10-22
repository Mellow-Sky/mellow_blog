'use client';
import { useState } from 'react';
import { ImageOff } from 'lucide-react';
export function ContentImage({ src, alt }: { src?: string; alt?: string }) {
  const [failed, setFailed] = useState(false);
  if (!src) return null;
  if (failed) return <span className="missing-article-image" role="img" aria-label={`图片暂不可用：${alt || '文章插图'}`}><ImageOff size={23} aria-hidden /><span>{alt || '图片暂时无法显示'}</span></span>;
  return <img src={src} alt={alt || '文章插图'} loading="lazy" decoding="async" onError={() => setFailed(true)} />;
}
