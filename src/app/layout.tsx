import type { Metadata, Viewport } from 'next';
import type { CSSProperties } from 'react';
import { getPosts, getSettings } from '@/lib/db';
import { SiteShell } from '@/components/site-shell';
import { postExcerpt, postUrl } from '@/lib/utils';
import './globals.css';
export const dynamic = 'force-dynamic';
export function generateMetadata(): Metadata {
  const settings = getSettings();
  return { title: { default: settings.title, template: `%s · ${settings.title}` }, description: settings.description, metadataBase: new URL(settings.siteUrl || 'http://localhost:3000'), alternates: { types: { 'application/rss+xml': '/feed.xml' } }, openGraph: { type: 'website', locale: 'zh_CN', siteName: settings.title, title: settings.title, description: settings.description }, icons: { icon: '/icon.svg' } };
}
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#6cb9cc' };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  const settings = getSettings();
  const entries = getPosts({ type: 'all' }).map(p => ({ title: p.title, url: postUrl(p), category: p.category, excerpt: postExcerpt(p).slice(0, 160) }));
  return <html style={{ '--accent': settings.accentColor } as CSSProperties} lang="zh-CN" suppressHydrationWarning data-scroll-behavior="smooth" data-theme={settings.colorMode === 'dark' ? 'dark' : 'light'}><body><SiteShell settings={settings} entries={entries}>{children}</SiteShell></body></html>;
}
