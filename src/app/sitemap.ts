import type { MetadataRoute } from 'next';
import { getPosts, getSettings } from '@/lib/db';
import { postUrl } from '@/lib/utils';
export const dynamic = 'force-dynamic';
export default function sitemap(): MetadataRoute.Sitemap { const settings = getSettings(); const site = (settings.siteUrl || 'http://localhost:3000').replace(/\/$/, ''); return [...['','/about','/archives','/music',...(settings.bangumiEnabled?['/bangumi']:[])].map(p => ({ url: `${site}${p}`, changeFrequency: 'weekly' as const })), ...getPosts({type:'all'}).map(p => ({ url: site + postUrl(p), lastModified: new Date(p.updatedAt * 1000), changeFrequency: 'monthly' as const }))]; }
