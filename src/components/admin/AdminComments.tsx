'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Check, ChevronLeft, ChevronRight, Clock3, LoaderCircle, MessageSquare, Reply, Search, Send, ShieldAlert, Trash2, X } from 'lucide-react';
import type { Comment, Post } from '@/lib/types';
import { adminApi, dateLabel, type Notify } from './api';

export default function AdminComments({ comments, posts, refresh, notify }: { comments: Comment[]; posts: Post[]; refresh: () => Promise<void>; notify: Notify }) {
  const [status, setStatus] = useState('all');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState<number | null>(null);
  const [replyId, setReplyId] = useState<number | null>(null);
  const [reply, setReply] = useState('');
  const titles = useMemo(() => new Map(posts.map(post => [post.id, post.title])), [posts]);
  const filtered = useMemo(() => comments.filter(comment => (status === 'all' || comment.status === status) && `${comment.author} ${comment.content} ${titles.get(comment.postId) || ''}`.toLowerCase().includes(query.toLowerCase())).sort((a, b) => b.createdAt - a.createdAt), [comments, status, query, titles]);
  useEffect(() => setPage(current => Math.min(current, Math.max(1, Math.ceil(filtered.length / 12)))), [filtered.length]);
  async function update(comment: Comment, next: Comment['status']) {
    setBusy(comment.id);
    try { await adminApi(`/api/admin/comments/${comment.id}`, 'PATCH', { status: next }); await refresh(); notify(next === 'approved' ? '评论已通过审核。' : next === 'spam' ? '评论已标为垃圾信息。' : '评论已移回待审核。'); }
    catch (reason) { notify((reason as Error).message, true); }
    finally { setBusy(null); }
  }
  async function remove(comment: Comment) {
    if (!confirm(`确定删除 ${comment.author} 的这条评论？此操作不可撤销。`)) return;
    setBusy(comment.id);
    try { await adminApi(`/api/admin/comments/${comment.id}`, 'DELETE'); await refresh(); notify('评论已删除。'); }
    catch (reason) { notify((reason as Error).message, true); }
    finally { setBusy(null); }
  }
  async function sendReply(event: FormEvent, comment: Comment) {
    event.preventDefault(); if (!reply.trim()) return;
    setBusy(comment.id);
    try { await adminApi('/api/admin/comments', 'POST', { postId: comment.postId, parentId: comment.id, content: reply.trim() }); await refresh(); setReplyId(null); setReply(''); notify('回复已发表。'); }
    catch (reason) { notify((reason as Error).message, true); }
    finally { setBusy(null); }
  }
  return <><div className="admin-heading"><div><h1>评论管理</h1></div><span className="admin-heading-count"><MessageSquare size={18} />共 {comments.length} 条评论</span></div><section className="admin-card admin-comments-card"><div className="admin-list-toolbar"><div className="admin-tabs" aria-label="评论状态">{[{ id: 'all', name: '全部' }, { id: 'waiting', name: '待审核' }, { id: 'approved', name: '已通过' }, { id: 'spam', name: '垃圾信息' }].map(item => <button key={item.id} className={status === item.id ? 'is-active' : ''} aria-pressed={status === item.id} onClick={() => { setStatus(item.id); setPage(1); }}>{item.name}<span>{comments.filter(comment => item.id === 'all' || comment.status === item.id).length}</span></button>)}</div><label className="admin-search"><Search size={17} /><span className="admin-sr-only">搜索评论</span><input value={query} onChange={event => { setQuery(event.target.value); setPage(1); }} placeholder="搜索留言、作者或文章…" /></label></div>{filtered.length ? <><div className="admin-comment-list">{filtered.slice((page - 1) * 12, page * 12).map(comment => <article className="admin-comment" key={comment.id}><span className="admin-comment-avatar">{comment.author.slice(0, 1)}</span><div className="admin-comment-body"><div className="admin-comment-heading"><div><strong>{comment.author}</strong><time dateTime={new Date(comment.createdAt < 1e12 ? comment.createdAt * 1000 : comment.createdAt).toISOString()}>{dateLabel(comment.createdAt)}</time></div><span className={`admin-badge ${comment.status === 'approved' ? 'is-published' : comment.status === 'spam' ? 'is-spam' : ''}`}>{comment.status === 'approved' ? '已通过' : comment.status === 'spam' ? '垃圾信息' : '待审核'}</span></div><p className="admin-comment-context">在「{titles.get(comment.postId) || `文章 #${comment.postId}`}」{comment.parentId > 0 && <span> · 回复 #{comment.parentId}</span>}</p><p className="admin-comment-text">{comment.content}</p>{comment.email && <p className="admin-comment-email">{comment.email}</p>}<div className="admin-comment-actions">{comment.status !== 'approved' && <button type="button" onClick={() => update(comment, 'approved')} disabled={busy === comment.id}><Check size={14} />通过</button>}{comment.status === 'approved' && <button type="button" onClick={() => update(comment, 'waiting')} disabled={busy === comment.id}><Clock3 size={14} />待审核</button>}<button type="button" onClick={() => { setReplyId(replyId === comment.id ? null : comment.id); setReply(''); }} disabled={busy === comment.id}><Reply size={14} />回复</button>{comment.status !== 'spam' && <button type="button" onClick={() => update(comment, 'spam')} disabled={busy === comment.id}><ShieldAlert size={14} />标为垃圾</button>}<button type="button" className="is-danger" onClick={() => remove(comment)} disabled={busy === comment.id}>{busy === comment.id ? <LoaderCircle size={14} className="admin-spin" /> : <Trash2 size={14} />}删除</button></div>{replyId === comment.id && <form className="admin-reply-form admin-form" onSubmit={event => sendReply(event, comment)}><label htmlFor={`reply-${comment.id}`}>回复 {comment.author}</label><textarea id={`reply-${comment.id}`} value={reply} onChange={event => setReply(event.target.value)} required maxLength={10000} rows={3} placeholder="写下你的回复…" autoFocus /><div className="admin-button-row"><button type="button" className="admin-button admin-button-secondary" onClick={() => setReplyId(null)}><X size={15} />取消</button><button type="submit" className="admin-button" disabled={busy === comment.id || !reply.trim()}><Send size={15} />发表回复</button></div></form>}</div></article>)}</div><div className="admin-pagination"><span>共 {filtered.length} 条 · 第 {page} / {Math.ceil(filtered.length / 12)} 页</span><div><button className="admin-icon-button" aria-label="上一页" disabled={page <= 1} onClick={() => setPage(page - 1)}><ChevronLeft size={18} /></button><button className="admin-icon-button" aria-label="下一页" disabled={page >= Math.ceil(filtered.length / 12)} onClick={() => setPage(page + 1)}><ChevronRight size={18} /></button></div></div></> : <div className="admin-empty"><MessageSquare size={32} /><h3>暂无评论</h3><p>{query ? '没有找到匹配的评论。' : '当前状态下暂无评论。'}</p></div>}</section></>;
}
