import type { MetadataRoute } from 'next';
import { getSettings } from '@/lib/db';
export const dynamic = 'force-dynamic';
export default function robots(): MetadataRoute.Robots { const site = getSettings().siteUrl; return { rules: { userAgent: '*', allow: '/', disallow: ['/admin', '/api/'] }, ...(site ? { sitemap: `${site.replace(/\/$/, '')}/sitemap.xml` } : {}) }; }
