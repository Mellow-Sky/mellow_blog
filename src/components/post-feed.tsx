'use client';
import Link from 'next/link';
import { useState } from 'react';
import { ArrowDown, ArrowUpRight, BookOpen, LayoutGrid, List } from 'lucide-react';
import type { Post, Taxonomy, SiteLabels } from '@/lib/types';
import { DEFAULT_LABELS } from '@/lib/site-customization';
import { postExcerpt, coverFor, date, postUrl, readTime } from '@/lib/utils';
import { Reveal, Tilt } from './motion';
import { PostCover } from './post-cover';

export function PostFeed({ posts, taxonomies, initialCategory = '', labels = DEFAULT_LABELS }: { posts: Post[]; taxonomies: Taxonomy[]; initialCategory?: string; labels?: SiteLabels }) {
  const [category, setCategory] = useState(initialCategory), [limit, setLimit] = useState(6), [view, setView] = useState('');
  const available = taxonomies.filter(t => t.type === 'category' && posts.some(p => (p.categories || [p.category]).includes(t.name)));
  const filtered = posts.filter(p => !category || (p.categories || [p.category]).includes(category));
  return <section className={`post-feed ${view ? `view-${view}` : ''}`} id="journal">
    <div className="section-heading">
      <div><h2>{labels.postListTitle}</h2></div>
      <div className="view-switch" role="group" aria-label="文章显示方式">
        <button onClick={() => setView('grid')} aria-label="卡片视图" aria-pressed={view !== 'list'} className={view !== 'list' ? 'active' : ''}><LayoutGrid size={19} /></button>
        <button onClick={() => setView('list')} aria-label="列表视图" aria-pressed={view === 'list'} className={view === 'list' ? 'active' : ''}><List size={20} /></button>
      </div>
    </div>
    <div className="category-tabs" role="group" aria-label="按分类筛选">
      <button aria-pressed={!category} className={!category ? 'active' : ''} onClick={() => { setCategory(''); setLimit(6); }}>{labels.allCategories} <span>{posts.length}</span></button>
      {available.map(t => <button key={t.id} aria-pressed={category === t.name} className={category === t.name ? 'active' : ''} onClick={() => { setCategory(t.name); setLimit(6); }}>{t.name}</button>)}
    </div>
    <div className="post-grid">{filtered.slice(0, limit).map((post, i) => {
      const excerpt = postExcerpt(post);
      return <Reveal key={post.id} delay={(i % 2) * 0.07}><Tilt className="post-card">
        <Link href={postUrl(post)} className="post-image" aria-label={`阅读：${post.title}`}><PostCover src={coverFor(post)} id={post.id} /><span className="image-category">{post.category || '随笔'}</span><span className="image-arrow"><ArrowUpRight size={20} /></span></Link>
        <div className="post-card-content">
          <div className="post-meta"><time dateTime={new Date(post.createdAt * 1000).toISOString()}>{date(post.createdAt)}</time><span>·</span><span>{readTime(post.content)} 分钟</span>{post.pinned && <span className="pin-tag">置顶</span>}</div>
          <h3><Link href={postUrl(post)}>{post.title}</Link></h3>
          {excerpt && <p>{excerpt.slice(0, 56)}{excerpt.length > 56 ? '…' : ''}</p>}
          {!!post.tags.length && <div className="post-bottom"><span className="post-tags">{post.tags.slice(0, 2).map(tag => <span key={tag}># {tag}</span>)}</span></div>}
        </div>
      </Tilt></Reveal>;
    })}</div>
    {!filtered.length && <div className="empty-state"><BookOpen size={28} /><p>暂无文章</p></div>}
    {filtered.length > limit && <button className="load-more" onClick={() => setLimit(limit + 6)}>{labels.loadMore} <ArrowDown size={18} /></button>}
  </section>;
}
