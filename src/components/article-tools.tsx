'use client';
import { useEffect, useState } from 'react';
import { Check, Copy, List, MessageCircle } from 'lucide-react';
import { DEFAULT_LABELS, type SiteLabels } from '@/lib/site-customization';
import { headingId } from '@/lib/utils';
export function TableOfContents({ content, labels = DEFAULT_LABELS }: { content: string; labels?: SiteLabels }) {
  const headings = [...content.replace(/```[\s\S]*?```/g, '').matchAll(/^(#{1,3})\s+(.+)$/gm)].map(m => ({ text: m[2].replace(/[*`]/g, ''), id: headingId(m[2].replace(/[*`]/g, '')), level: m[1].length }));
  const [active, setActive] = useState('');
  useEffect(() => {
    const observer = new IntersectionObserver(entries => { for (const e of entries) if (e.isIntersecting) setActive(e.target.id); }, { rootMargin: '-5% 0px -75% 0px' });
    document.querySelectorAll('.article-prose h1,.article-prose h2,.article-prose h3').forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, [content]);
  if (!headings.length) return null;
  return <nav className="toc" aria-label={labels.tableOfContents}><h2><List size={16} /> {labels.tableOfContents}</h2>{headings.map((h, i) => <a key={`${h.id}-${i}`} href={`#${h.id}`} className={`${active === h.id ? 'active' : ''} toc-level-${h.level}`} aria-current={active === h.id ? 'location' : undefined}>{h.text}</a>)}</nav>;
}
export function ArticleActions({ labels = DEFAULT_LABELS }: { labels?: SiteLabels }) {
  const [copied, setCopied] = useState(false);
  async function copy() { try { await navigator.clipboard.writeText(window.location.href); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch {} }
  return <div className="article-actions"><a href="#comments"><MessageCircle size={15} /> {labels.commentsTitle}</a><button onClick={copy}>{copied ? <Check size={15} /> : <Copy size={15} />}{copied ? labels.linkCopied : labels.copyLink}</button></div>;
}
