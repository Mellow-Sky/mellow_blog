import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowUpRight, Search } from 'lucide-react';
import { getPosts, getTaxonomies, getSettings } from '@/lib/db';
import { date, postUrl, readTime } from '@/lib/utils';
import { Reveal } from '@/components/motion';
export function generateMetadata(): Metadata { return { title: getSettings().labels.archiveTitle, description: '按时间与分类浏览文章。' }; }
export const dynamic = 'force-dynamic';
export default async function Archives({ searchParams }: { searchParams: Promise<{ tag?: string; q?: string; category?: string }> }) {
  const { tag, q, category } = await searchParams;
  const all = getPosts(), taxonomies = getTaxonomies(), labels = getSettings().labels;
  const tagName = taxonomies.find(t => t.type === 'tag' && t.slug === tag)?.name || tag;
  const categoryName = taxonomies.find(t => t.type === 'category' && t.slug === category)?.name || category;
  const posts = all.filter(p => (!tagName || p.tags.includes(tagName)) && (!categoryName || (p.categories || [p.category]).includes(categoryName)) && (!q || `${p.title} ${p.content}`.toLowerCase().includes(q.toLowerCase())));
  const groups = posts.reduce<Record<string, typeof posts>>((acc, p) => { const year = new Date(p.createdAt * 1000).getFullYear().toString(); (acc[year] ||= []).push(p); return acc; }, {});
  return <div className="page-container archive-page"><Reveal><header className="page-heading"><h1>{labels.archiveTitle}</h1></header></Reveal><div className="archive-toolbar"><form action="/archives" className="archive-search"><Search size={16} /><input name="q" aria-label="搜索归档" placeholder={labels.searchPlaceholder} defaultValue={q || ''} /><button type="submit">{labels.search}</button></form><span>{posts.length} 篇</span></div><div className="archive-filters"><Link href="/archives" className={!tag && !category ? 'active' : ''}>{labels.allCategories}</Link>{taxonomies.filter(t => t.type === 'tag').map(t => <Link key={t.id} className={tag === t.name ? 'active' : ''} href={`/archives?tag=${encodeURIComponent(t.name)}`}># {t.name}</Link>)}</div><div className="archive-layout"><div>{Object.keys(groups).sort().reverse().map(year => <section key={year} className="archive-year"><h2>{year}<span>{groups[year].length} 篇</span></h2><div className="timeline">{groups[year].map(p => <Link className="timeline-entry" key={p.id} href={postUrl(p)}><time dateTime={new Date(p.createdAt * 1000).toISOString()}>{date(p.createdAt, true)}</time><span><strong>{p.title}</strong><small>{p.category}<span>·</span>{readTime(p.content)} 分钟阅读</small></span><ArrowUpRight size={18} /></Link>)}</div></section>)}{!posts.length && <div className="empty-state">没有找到相关文章</div>}</div><aside className="archive-sidebar"><h2>分类</h2>{taxonomies.filter(t => t.type === 'category').map(t => <Link key={t.id} className={category === t.name ? 'active' : ''} href={`/archives?category=${encodeURIComponent(t.name)}`}><span>{t.name}</span><small>{all.filter(p => (p.categories || [p.category]).includes(t.name)).length}</small></Link>)}</aside></div></div>;
}
