import { notFound, redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { getComments, getPost, getSettings } from '@/lib/db';
import { ArticleContent } from '@/components/content';
import { Comments } from '@/components/comments';
import { ReadingProgress } from '@/components/motion';
import Link from 'next/link';
import { decodePageSlug } from '@/lib/route-slug';
export const dynamic = 'force-dynamic';
type Props = { params: Promise<{ slug: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> { const post = getPost((await params).slug); return { title: post?.title || '页面未找到' }; }
export default async function Page({ params }: Props) {
  const post = getPost(decodePageSlug((await params).slug));
  if (!post || post.type !== 'page') notFound();
  if (post.slug === 'music') redirect('/music');
  const settings = getSettings();
  return <div className="page-container simple-page"><ReadingProgress /><div className="breadcrumb"><Link href="/">首页</Link><span>/</span><span>{post.title}</span></div><header className="page-heading"><h1>{post.title}</h1></header><article className="article-prose"><ArticleContent source={post.content} format={post.format} /></article><Comments labels={settings.labels} postId={post.id} comments={getComments(post.id)} enabled={post.allowComment && settings.commentsEnabled} /></div>;
}
