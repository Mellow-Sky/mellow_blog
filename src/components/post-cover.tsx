'use client';
import Image from 'next/image';
import { useState } from 'react';
import { coverFallbacks } from '@/lib/utils';
export function PostCover({ src, id, priority = false }: { src: string; id: number; priority?: boolean }) {
  const [failed, setFailed] = useState(false);
  const fallback = coverFallbacks[id % coverFallbacks.length];
  return <Image src={failed ? fallback : src || fallback} alt="" fill sizes="(max-width: 600px) 100vw, (max-width: 1000px) 50vw, 600px" priority={priority} unoptimized={/^https?:/.test(src) && !failed} onError={() => setFailed(true)} />;
}
