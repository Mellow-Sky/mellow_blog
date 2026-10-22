import Image from 'next/image';
import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowUpRight, Headphones } from 'lucide-react';
import { getPosts, getSettings, getComments } from '@/lib/db';
import { ArticleContent } from '@/components/content';
import { Comments } from '@/components/comments';
import { Reveal } from '@/components/motion';
export const dynamic = 'force-dynamic';
export function generateMetadata(): Metadata { return { title: getSettings().labels.aboutMe }; }
export default function About() {
  const settings = getSettings(), page = getPosts({ type: 'page' }).find(p => p.title.includes('关于') || p.slug === 'about');
  return <div className="page-container about-page">
    <Reveal><header className="about-hero">
      <div><h1>{settings.labels.aboutTitle} {settings.author}</h1>{settings.description && <p>{settings.description}</p>}</div>
      <div className="about-portrait"><Image unoptimized={/^https?:/.test(settings.avatar)} src={settings.avatar || '/avatar.svg'} width={220} height={220} alt={`${settings.author}的头像`} /></div>
    </header></Reveal>
    <section className="about-body">
      {page ? <div className="article-prose"><ArticleContent source={page.content} format={page.format} /></div> : <p>这里记录代码、音乐和生活。</p>}
      <div className="about-links"><Link href="/archives">{settings.labels.postListTitle} <ArrowUpRight size={18} /></Link><Link href="/music">{settings.labels.musicTitle} <Headphones size={18} /></Link><Link href="/feed.xml">{settings.labels.rss} <ArrowUpRight size={18} /></Link></div>
      {page && <Comments labels={settings.labels} postId={page.id} comments={getComments(page.id)} enabled={settings.commentsEnabled && page.allowComment} />}
    </section>
  </div>;
}
