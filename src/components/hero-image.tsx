'use client';

import Image from 'next/image';
import { useState } from 'react';
import { DEFAULT_HERO_IMAGE, DEFAULT_HERO_IMAGE_ALT, isBrandingImageSource } from '@/lib/branding';

export function HeroImage({ src, alt }: { src: string; alt: string }) {
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const requestedSource = isBrandingImageSource(src) ? src : DEFAULT_HERO_IMAGE;
  const useFallback = failedSource === requestedSource;
  const imageSource = useFallback ? DEFAULT_HERO_IMAGE : requestedSource;
  return <Image
    src={imageSource}
    alt={useFallback ? DEFAULT_HERO_IMAGE_ALT : alt}
    fill
    sizes="(max-width: 760px) 100vw, 48vw"
    preload
    unoptimized={/^https:\/\//i.test(imageSource)}
    onError={() => setFailedSource(requestedSource)}
  />;
}
