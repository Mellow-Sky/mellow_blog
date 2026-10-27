'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowUpRight, ChevronLeft, ChevronRight, FilePenLine, LoaderCircle, Plus, Search, Trash2 } from 'lucide-react';
import type { Media, Post, Taxonomy } from '@/lib/types';
import { postUrl } from '@/lib/utils';
import { adminApi, dateLabel, type Notify } from './api';
import PostEditor from './PostEditor';

type Props = { username: string; posts: Post[]; taxonomies: Taxonomy[]; media: Media[]; type: 'post' | 'page'; initialNew: boolean; initialEditId: number | null; onDirtyChange: (dirty: boolean) => void; refresh: () => Promise<void>; notify: Notify };

export default function AdminPosts({ username, posts, taxonomies, media, type, initialNew, initialEditId, onDirtyChange, refresh, notify }: Props) {
  const [editing, setEditing] = useState<Post | 'new' | null>(initialNew ? 'new' : posts.find(post => post.id === initialEditId) || null);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);
  const [deleting, setDeleting] = useState<number | null>(null);
  const label = type === 'page' ? '页面' : '文章';
  const filtered = useMemo(() => posts.filter(post => post.type === type && (status === 'all' || post.status === status) && `${post.title} ${post.category} ${post.tags.join(' ')}`.toLowerCase().includes(query.toLowerCase())).sort((a, b) => b.updatedAt - a.updatedAt), [posts, query, status, type]);
  useEffect(() => setPage(1), [query, status]);
  useEffect(() => setPage(current => Math.min(current, Math.max(1, Math.ceil(filtered.length / 12)))), [filtered.length]);
  async function remove(post: Post) {
    if (!confirm(`确定删除「${post.title}」？其下的评论也会被删除，此操作不可撤销。建议先导出备份。`)) return;
    setDeleting(post.id);
    try { await adminApi(`/api/admin/posts/${post.id}`, 'DELETE'); await refresh(); notify(`${label}已删除。`); }
    catch (reason) { notify((reason as Error).message, true); }
    finally { setDeleting(null); }
  }
  if (editing) return <PostEditor username={username} key={editing === 'new' ? 'new' : editing.id} post={editing === 'new' ? undefined : editing} type={type} taxonomies={taxonomies} media={media} onDirtyChange={onDirtyChange} onBack={() => setEditing(null)} refresh={refresh} notify={notify} />;
  return <>
    <div className="admin-heading"><div><h1>{label}管理</h1></div><button className="admin-button" onClick={() => setEditing('new')}><Plus size={18} />新建{label}</button></div>
    <section className="admin-card admin-table-card"><div className="admin-list-toolbar"><div className="admin-tabs" aria-label="文章状态">{[{ id: 'all', name: '全部' }, { id: 'publish', name: '已发布' }, { id: 'draft', name: '草稿' }, { id: 'private', name: '私密' }].map(item => <button key={item.id} className={status === item.id ? 'is-active' : ''} onClick={() => setStatus(item.id)} aria-pressed={status === item.id}>{item.name}<span>{posts.filter(post => post.type === type && (item.id === 'all' || post.status === item.id)).length}</span></button>)}</div><label className="admin-search"><Search size={17} /><span className="admin-sr-only">搜索{label}</span><input value={query} onChange={event => setQuery(event.target.value)} placeholder={`搜索${label}、分类或标签…`} /></label></div>
      {filtered.length ? <><div className="admin-table-scroll"><table className="admin-table"><thead><tr><th scope="col">{label}标题</th><th scope="col">分类</th><th scope="col">状态</th><th scope="col">阅读</th><th scope="col">更新日期</th><th scope="col" className="admin-align-right">操作</th></tr></thead><tbody>{filtered.slice((page - 1) * 12, page * 12).map(post => <tr key={post.id}><td><button className="admin-post-title" onClick={() => setEditing(post)}><span className="admin-file-icon"><FilePenLine size={18} /></span><span><strong>{post.title}</strong><small>{post.pinned && '置顶 · '}{post.slug}</small></span></button></td><td><span className="admin-table-category">{post.category || '未分类'}</span></td><td><span className={`admin-badge ${post.status === 'publish' ? 'is-published' : ''}`}>{post.status === 'publish' ? '已发布' : post.status === 'private' ? '私密' : '草稿'}</span></td><td className="admin-muted">{post.views.toLocaleString('zh-CN')}</td><td className="admin-muted admin-nowrap">{dateLabel(post.updatedAt)}</td><td><div className="admin-row-actions"><button className="admin-icon-button" title={`编辑${label}`} aria-label={`编辑 ${post.title}`} onClick={() => setEditing(post)}><FilePenLine size={16} /></button>{post.status === 'publish' && <a className="admin-icon-button" title="在博客中查看" aria-label={`查看 ${post.title}`} href={postUrl(post)} target="_blank" rel="noreferrer"><ArrowUpRight size={16} /></a>}<button className="admin-icon-button is-danger" title={`删除${label}`} aria-label={`删除 ${post.title}`} disabled={deleting === post.id} onClick={() => remove(post)}>{deleting === post.id ? <LoaderCircle size={16} className="admin-spin" /> : <Trash2 size={16} />}</button></div></td></tr>)}</tbody></table></div><div className="admin-pagination"><span>共 {filtered.length} 篇{label} · 第 {Math.min(page, Math.ceil(filtered.length / 12))} / {Math.ceil(filtered.length / 12)} 页</span><div><button className="admin-icon-button" aria-label="上一页" disabled={page <= 1} onClick={() => setPage(page - 1)}><ChevronLeft size={18} /></button><button className="admin-icon-button" aria-label="下一页" disabled={page >= Math.ceil(filtered.length / 12)} onClick={() => setPage(page + 1)}><ChevronRight size={18} /></button></div></div></> : <div className="admin-empty"><FilePenLine size={32} /><h3>{query ? '没有找到相关内容' : `这里还没有${label}`}</h3><p>{query ? '试试其他关键词，或者切换状态。' : '点击上方按钮新建。'}</p></div>}
    </section>
  </>;
}
