import { getPosts, getTaxonomies, getSettings } from '@/lib/db';
import { PostFeed } from '@/components/post-feed';
import Link from 'next/link';
import { decodePageSlug } from '@/lib/route-slug';
export const dynamic = 'force-dynamic';
export default async function Category({ params }: { params: Promise<{ slug: string }> }) { const slug = decodePageSlug((await params).slug); const metas = getTaxonomies(); const cat = metas.find(t => t.slug === slug || t.name === slug); return <div className="page-container category-page"><div className="breadcrumb"><Link href="/">首页</Link><span>/</span><span>{cat?.name || slug}</span></div><PostFeed labels={getSettings().labels} posts={getPosts()} taxonomies={metas} initialCategory={cat?.name || slug} /></div>; }
