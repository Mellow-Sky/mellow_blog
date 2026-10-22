'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LoaderCircle, MessageCircle, Reply, Send, X } from 'lucide-react';
import { DEFAULT_LABELS } from '@/lib/site-customization';
import type { SiteLabels, Comment } from '@/lib/types';
import { date } from '@/lib/utils';
export function Comments({ postId, comments, enabled, labels = DEFAULT_LABELS }: { postId: number; comments: Comment[]; enabled: boolean; labels?: SiteLabels }) {
  const router = useRouter();
  const [replyTo, setReplyTo] = useState<Comment | null>(null), [pending, setPending] = useState(false), [message, setMessage] = useState(''), [error, setError] = useState('');
  function renderComment(c: Comment, depth = 0): React.ReactNode {
    return <div className={`comment ${depth ? 'comment-reply' : ''}`} key={c.id} id={`comment-${c.id}`}><div className="comment-avatar">{c.author.slice(0, 1).toUpperCase()}</div><div className="comment-body"><div className="comment-heading"><strong>{c.author}</strong><time dateTime={new Date(c.createdAt * 1000).toISOString()}>{date(c.createdAt)}</time>{enabled && <button onClick={() => { setReplyTo(c); document.getElementById('comment-content')?.focus(); }} aria-label={`${labels.commentReply} ${c.author}`}><Reply size={13} /> {labels.commentReply}</button>}</div><p>{c.content}</p>{depth < 4 && comments.filter(reply => reply.parentId === c.id).map(reply => renderComment(reply, depth + 1))}</div></div>;
  }
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setPending(true); setError(''); setMessage(''); const form = e.currentTarget, data = new FormData(form);
    try { const response = await fetch('/api/comments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ postId, parentId: replyTo?.id || 0, author: data.get('author'), email: data.get('email'), url: data.get('url'), content: data.get('content') }) }); const result = await response.json(); if (!response.ok) throw new Error(result.error || '评论提交失败'); setMessage(result.message || '评论已提交，等待审核。'); form.reset(); setReplyTo(null); router.refresh(); }
    catch (err) { setError(err instanceof Error ? err.message : '提交失败，请重试。'); }
    finally { setPending(false); }
  }
  const ids = new Set(comments.map(c => c.id));
  return <section className="comments-section" id="comments"><div className="comments-title"><h2><MessageCircle size={21} /> {labels.commentsTitle} <span>{comments.length}</span></h2></div>{comments.length ? <div className="comment-list">{comments.filter(c => !c.parentId || !ids.has(c.parentId)).map(c => renderComment(c))}</div> : <div className="no-comments">暂无评论</div>}{enabled ? <form className="comment-form" onSubmit={submit}>{replyTo && <div className="reply-indicator">正在回复 {replyTo.author}<button type="button" onClick={() => setReplyTo(null)} aria-label="取消回复"><X size={14} /></button></div>}<label htmlFor="comment-content" className="sr-only">评论内容</label><textarea id="comment-content" name="content" placeholder="写下评论…" required minLength={1} maxLength={10000} rows={5} /><div className="comment-fields"><label><span>昵称 <small>*</small></span><input name="author" autoComplete="nickname" required maxLength={80} placeholder="昵称" /></label><label><span>邮箱 <small>不会公开</small></span><input name="email" type="email" autoComplete="email" maxLength={150} placeholder="you@example.com" /></label><label><span>个人网站 <small>选填</small></span><input name="url" type="url" maxLength={500} placeholder="https://" /></label></div><div className="comment-form-foot"><button className="button button-primary" type="submit" disabled={pending}>{pending ? <LoaderCircle size={14} className="spin" /> : <Send size={14} />} {pending ? labels.commentSubmitting : labels.commentSubmit}</button></div>{message && <p className="form-message success" role="status">{message}</p>}{error && <p className="form-message error" role="alert">{error}</p>}</form> : <p className="no-comments">评论已关闭</p>}</section>;
}
