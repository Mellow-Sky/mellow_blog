import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { ArrowLeft, ArrowRight, CalendarDays, Clock3, Eye } from 'lucide-react';
import { getComments, getPost, getPosts, getSettings } from '@/lib/db';
import { ArticleContent } from '@/components/content';
import { ArticleActions, TableOfContents } from '@/components/article-tools';
import { Comments } from '@/components/comments';
import { ReadingProgress, Reveal } from '@/components/motion';
import { PostCover } from '@/components/post-cover';
import { postExcerpt, coverFor, date, postUrl, readTime } from '@/lib/utils';
import { decodePageSlug } from '@/lib/route-slug';
export const dynamic = 'force-dynamic';
type Props = { params: Promise<{ slug: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> { const p = getPost((await params).slug); return p ? { title: p.title, description: postExcerpt(p).slice(0, 155), alternates: { canonical: postUrl(p) }, openGraph: { type: 'article', title: p.title, publishedTime: new Date(p.createdAt * 1000).toISOString(), images: p.cover ? [p.cover] : [] } } : { title: '文章未找到' }; }
export default async function ArticlePage({ params }: Props) {
  const post = getPost(decodePageSlug((await params).slug));
  if (!post || post.type !== 'post') notFound();
  const settings = getSettings(), comments = getComments(post.id);
  const posts = getPosts(), index = posts.findIndex(p => p.id === post.id), next = posts[index + 1], previous = posts[index - 1];
  return <div className="page-container article-page"><ReadingProgress /><div className="breadcrumb"><Link href="/">首页</Link><span>/</span><Link href="/archives">文章</Link><span>/</span><span>{post.category}</span></div><Reveal><header className="article-header"><Link className="article-category" href={`/category/${encodeURIComponent(post.category)}`}>{post.category || '随笔'}</Link><h1>{post.title}</h1><div className="article-meta"><span><Image unoptimized={/^https?:/.test(settings.avatar)} src={settings.avatar || '/avatar.svg'} alt="" width={24} height={24} />{settings.author}</span><time dateTime={new Date(post.createdAt * 1000).toISOString()}><CalendarDays size={13} />{date(post.createdAt)}</time><span><Clock3 size={13} />{readTime(post.content)} 分钟阅读</span><span><Eye size={14} />{post.views}</span></div></header></Reveal><div className="article-cover"><PostCover src={coverFor(post)} id={post.id} priority /></div><div className="article-layout"><article className="article-main"><div className="article-prose"><ArticleContent source={post.content} format={post.format} /></div><p className="article-updated">更新于 {date(post.updatedAt)}</p><div className="article-tags">{post.tags.map(tag => <Link href={`/archives?tag=${encodeURIComponent(tag)}`} key={tag}># {tag}</Link>)}</div><ArticleActions labels={settings.labels} /><nav className="adjacent-posts" aria-label="相邻文章"><div>{previous && <Link href={postUrl(previous)}><small><ArrowLeft size={12} /> {settings.labels.previousPost}</small><span>{previous.title}</span></Link>}</div><div>{next && <Link href={postUrl(next)}><small>{settings.labels.nextPost} <ArrowRight size={12} /></small><span>{next.title}</span></Link>}</div></nav><Comments labels={settings.labels} postId={post.id} comments={comments} enabled={settings.commentsEnabled && post.allowComment} /></article><aside className="article-sidebar"><TableOfContents labels={settings.labels} content={post.content} /></aside></div></div>;
}
