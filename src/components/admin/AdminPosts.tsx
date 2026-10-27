'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import dynamic from 'next/dynamic';
import { ArrowLeft, ArrowUpRight, Check, ChevronLeft, ChevronRight, Eye, FilePenLine, ImagePlus, LoaderCircle, Plus, Save, Search, Send, Trash2, X } from 'lucide-react';
import type { Media, Post, Taxonomy } from '@/lib/types';
import { adminApi, dateLabel, generatedSlug, type Notify } from './api';
import AdminImagePicker from './AdminImagePicker';

const MarkdownPreview = dynamic(() => import('./MarkdownPreview'), { loading: () => <p className="admin-muted">正在准备预览…</p> });
type Props = { posts: Post[]; taxonomies: Taxonomy[]; media: Media[]; type: 'post' | 'page'; initialNew: boolean; initialEditId: number | null; onDirtyChange: (dirty: boolean) => void; refresh: () => Promise<void>; notify: Notify };

export default function AdminPosts({ posts, taxonomies, media, type, initialNew, initialEditId, onDirtyChange, refresh, notify }: Props) {
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
  if (editing) return <PostEditor key={editing === 'new' ? 'new' : editing.id} post={editing === 'new' ? undefined : editing} type={type} taxonomies={taxonomies} media={media} onDirtyChange={onDirtyChange} onBack={() => setEditing(null)} refresh={refresh} notify={notify} />;
  return <>
    <div className="admin-heading"><div><h1>{label}管理</h1></div><button className="admin-button" onClick={() => setEditing('new')}><Plus size={18} />新建{label}</button></div>
    <section className="admin-card admin-table-card"><div className="admin-list-toolbar"><div className="admin-tabs" aria-label="文章状态">{[{ id: 'all', name: '全部' }, { id: 'publish', name: '已发布' }, { id: 'draft', name: '草稿' }, { id: 'private', name: '私密' }].map(item => <button key={item.id} className={status === item.id ? 'is-active' : ''} onClick={() => setStatus(item.id)} aria-pressed={status === item.id}>{item.name}<span>{posts.filter(post => post.type === type && (item.id === 'all' || post.status === item.id)).length}</span></button>)}</div><label className="admin-search"><Search size={17} /><span className="admin-sr-only">搜索{label}</span><input value={query} onChange={event => setQuery(event.target.value)} placeholder={`搜索${label}、分类或标签…`} /></label></div>
      {filtered.length ? <><div className="admin-table-scroll"><table className="admin-table"><thead><tr><th scope="col">{label}标题</th><th scope="col">分类</th><th scope="col">状态</th><th scope="col">阅读</th><th scope="col">更新日期</th><th scope="col" className="admin-align-right">操作</th></tr></thead><tbody>{filtered.slice((page - 1) * 12, page * 12).map(post => <tr key={post.id}><td><button className="admin-post-title" onClick={() => setEditing(post)}><span className="admin-file-icon"><FilePenLine size={18} /></span><span><strong>{post.title}</strong><small>{post.pinned && '置顶 · '}{post.slug}</small></span></button></td><td><span className="admin-table-category">{post.category || '未分类'}</span></td><td><span className={`admin-badge ${post.status === 'publish' ? 'is-published' : ''}`}>{post.status === 'publish' ? '已发布' : post.status === 'private' ? '私密' : '草稿'}</span></td><td className="admin-muted">{post.views.toLocaleString('zh-CN')}</td><td className="admin-muted admin-nowrap">{dateLabel(post.updatedAt)}</td><td><div className="admin-row-actions"><button className="admin-icon-button" title={`编辑${label}`} aria-label={`编辑 ${post.title}`} onClick={() => setEditing(post)}><FilePenLine size={16} /></button>{post.status === 'publish' && <a className="admin-icon-button" title="在博客中查看" aria-label={`查看 ${post.title}`} href={`/${post.type === 'page' ? 'pages' : 'posts'}/${encodeURIComponent(post.slug)}`} target="_blank" rel="noreferrer"><ArrowUpRight size={16} /></a>}<button className="admin-icon-button is-danger" title={`删除${label}`} aria-label={`删除 ${post.title}`} disabled={deleting === post.id} onClick={() => remove(post)}>{deleting === post.id ? <LoaderCircle size={16} className="admin-spin" /> : <Trash2 size={16} />}</button></div></td></tr>)}</tbody></table></div><div className="admin-pagination"><span>共 {filtered.length} 篇{label} · 第 {Math.min(page, Math.ceil(filtered.length / 12))} / {Math.ceil(filtered.length / 12)} 页</span><div><button className="admin-icon-button" aria-label="上一页" disabled={page <= 1} onClick={() => setPage(page - 1)}><ChevronLeft size={18} /></button><button className="admin-icon-button" aria-label="下一页" disabled={page >= Math.ceil(filtered.length / 12)} onClick={() => setPage(page + 1)}><ChevronRight size={18} /></button></div></div></> : <div className="admin-empty"><FilePenLine size={32} /><h3>{query ? '没有找到相关内容' : `这里还没有${label}`}</h3><p>{query ? '试试其他关键词，或者切换状态。' : '点击上方按钮新建。'}</p></div>}
    </section>
  </>;
}

function PostEditor({ post, type, taxonomies, media, onBack, onDirtyChange, refresh, notify }: { post?: Post; type: 'post' | 'page'; taxonomies: Taxonomy[]; media: Media[]; onBack: () => void; onDirtyChange: (dirty: boolean) => void; refresh: () => Promise<void>; notify: Notify }) {
  const [draft, setDraft] = useState<Post>(post ? { ...post, categories: post.categories ?? (post.category ? [post.category] : []) } : { id: 0, title: '', slug: '', content: '', excerpt: '', createdAt: Math.floor(Date.now() / 1000), updatedAt: Math.floor(Date.now() / 1000), status: 'draft', type, category: '', categories: [], tags: [], cover: '', views: 0, allowComment: true, pinned: false, format: 'markdown' });
  const [tags, setTags] = useState(post?.tags.join(', ') || '');
  const [mode, setMode] = useState<'write' | 'preview'>('write');
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saved, setSaved] = useState(JSON.stringify(draft));
  const [error, setError] = useState('');
  const dirty = JSON.stringify(draft) !== saved || tags !== draft.tags.join(', ');
  useEffect(() => { onDirtyChange(dirty); return () => onDirtyChange(false); }, [dirty, onDirtyChange]);
  useEffect(() => { const protect = (event: BeforeUnloadEvent) => { if (dirty) event.preventDefault(); }; window.addEventListener('beforeunload', protect); return () => window.removeEventListener('beforeunload', protect); }, [dirty]);
  function update<K extends keyof Post>(key: K, value: Post[K]) { setDraft(current => ({ ...current, [key]: value })); }
  const selectedCategories = draft.categories ?? (draft.category ? [draft.category] : []);
  const categoryOptions = Array.from(new Set([...taxonomies.filter(item => item.type === 'category').map(item => item.name), ...selectedCategories]));
  function toggleCategory(name: string, checked: boolean) {
    setDraft(current => {
      const currentCategories = current.categories ?? (current.category ? [current.category] : []);
      const categories = checked ? [...currentCategories, name] : currentCategories.filter(item => item !== name);
      return { ...current, categories, category: categories.includes(current.category) ? current.category : categories[0] || '' };
    });
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const action = ((event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null)?.value;
    const payload = { ...draft, slug: draft.slug.trim() || generatedSlug(draft.title), categories: Array.from(new Set([draft.category, ...selectedCategories].filter(Boolean))), tags: Array.from(new Set(tags.split(/[,，]/).map(tag => tag.trim()).filter(Boolean))), status: action === 'publish' ? 'publish' : action === 'draft' ? 'draft' : draft.status };
    setBusy(true); setError('');
    try {
      const result = await adminApi<{ post: Post }>(draft.id ? `/api/admin/posts/${draft.id}` : '/api/admin/posts', draft.id ? 'PUT' : 'POST', payload);
      setDraft(result.post); setTags(result.post.tags.join(', ')); setSaved(JSON.stringify(result.post));
      await refresh(); notify(payload.status === 'publish' ? '已发布。' : '已保存。');
    } catch (reason) { setError((reason as Error).message); notify((reason as Error).message, true); }
    finally { setBusy(false); }
  }
  async function uploadCover(file?: File) {
    if (!file) return;
    setUploading(true);
    try { const form = new FormData(); form.append('file', file); const result = await adminApi<{ media: Media }>('/api/admin/media', 'POST', form); update('cover', result.media.url); await refresh(); notify('封面已上传。'); }
    catch (reason) { notify((reason as Error).message, true); }
    finally { setUploading(false); }
  }
  return <form onSubmit={save} className="admin-editor-form"><div className="admin-editor-heading"><div><button className="admin-text-button" type="button" onClick={() => { if (!dirty || confirm('还有未保存的修改，确定离开编辑器？')) onBack(); }}><ArrowLeft size={16} />返回{type === 'page' ? '页面' : '文章'}列表</button><h1>{post ? '编辑' : '新建'}{type === 'page' ? '页面' : '文章'}</h1></div><div className="admin-button-row"><span className="admin-save-status">{!draft.id ? '尚未保存' : dirty ? '有未保存的修改' : <><Check size={14} />已保存</>}</span><button className="admin-button admin-button-secondary" type="submit" name="action" value="draft" disabled={busy}>{busy ? <LoaderCircle size={16} className="admin-spin" /> : <Save size={16} />}存为草稿</button><button className="admin-button" type="submit" name="action" value={draft.status === 'private' ? 'save' : 'publish'} disabled={busy}><Send size={16} />{draft.status === 'private' ? '保存私密文章' : '发布文章'}</button></div></div>{error && <p className="admin-inline-error" role="alert">{error}</p>}<div className="admin-editor-grid"><div className="admin-editor-main"><section className="admin-card admin-writing-card"><label className="admin-sr-only" htmlFor="post-title">标题</label><input id="post-title" className="admin-title-input" value={draft.title} onChange={event => update('title', event.target.value)} required maxLength={300} placeholder="文章标题" /><div className="admin-writing-toolbar"><div className="admin-tabs"><button type="button" className={mode === 'write' ? 'is-active' : ''} onClick={() => setMode('write')} aria-pressed={mode === 'write'}><FilePenLine size={15} />编辑</button><button type="button" className={mode === 'preview' ? 'is-active' : ''} onClick={() => setMode('preview')} aria-pressed={mode === 'preview'}><Eye size={15} />预览</button></div><label className="admin-format-label"><span className="admin-sr-only">内容格式</span><select value={draft.format} onChange={event => update('format', event.target.value as Post['format'])}><option value="markdown">Markdown</option><option value="mdx">MDX</option></select></label></div>{mode === 'write' ? <><label className="admin-sr-only" htmlFor="post-content">文章正文</label><textarea id="post-content" className="admin-content-input" value={draft.content} onChange={event => update('content', event.target.value)} placeholder={'开始撰写，支持 Markdown。'} spellCheck={false} /></> : <div className="admin-preview"><MarkdownPreview content={draft.content} /></div>}<div className="admin-writing-footer"><span>{draft.content.length.toLocaleString('zh-CN')} 字符</span><span>{draft.format === 'mdx' ? '安全预览仅展示 Markdown，不执行 JSX 或脚本' : '支持 Markdown · GFM 表格和任务列表'}</span></div></section><section className="admin-card admin-form"><h2>文章摘要</h2><label>简介<textarea aria-label="简介" value={draft.excerpt} onChange={event => update('excerpt', event.target.value)} rows={3} placeholder="留空时自动生成。" maxLength={2000} /></label></section></div><aside className="admin-editor-aside"><section className="admin-card admin-form"><h2>发布设置</h2><label>访问路径<input value={draft.slug} onChange={event => update('slug', event.target.value)} placeholder="留空自动生成" maxLength={200} /><small>保持原有 slug 可保留文章地址。</small></label><label>可见状态<select value={draft.status} onChange={event => update('status', event.target.value as Post['status'])}><option value="draft">草稿</option><option value="publish">公开发布</option><option value="private">私密</option></select></label><fieldset className="admin-fieldset admin-category-fieldset"><legend>所属分类（可多选）</legend><div className="admin-category-options">{categoryOptions.map(name => <label className="admin-checkbox" key={name}><input type="checkbox" checked={selectedCategories.includes(name)} onChange={event => toggleCategory(name, event.target.checked)} />{name}</label>)}</div>{!categoryOptions.length && <p className="admin-muted">可先在分类与标签中创建分类。</p>}</fieldset>{selectedCategories.length > 0 && <label>主分类<select aria-label="主分类" value={draft.category} onChange={event => update('category', event.target.value)}>{selectedCategories.map(name => <option value={name} key={name}>{name}</option>)}</select></label>}<label>标签<input value={tags} onChange={event => setTags(event.target.value)} placeholder="生活, 技术, 随想" list="admin-existing-tags" /><small>用逗号分隔多个标签。</small><datalist id="admin-existing-tags">{taxonomies.filter(item => item.type === 'tag').map(item => <option value={item.name} key={item.id} />)}</datalist></label><label className="admin-checkbox"><input type="checkbox" checked={draft.pinned} onChange={event => update('pinned', event.target.checked)} />置顶这篇文章</label><label className="admin-checkbox"><input type="checkbox" checked={draft.allowComment} onChange={event => update('allowComment', event.target.checked)} />允许读者评论</label><button type="submit" name="action" value="save" className="admin-button admin-button-secondary admin-button-full" disabled={busy}><Save size={16} />保存当前设置</button></section><section className="admin-card admin-form"><h2>封面图片</h2>{draft.cover ? <div className="admin-cover-preview"><img src={draft.cover} alt="文章封面预览" /><button type="button" className="admin-icon-button" aria-label="移除封面" onClick={() => update('cover', '')}><X size={16} /></button></div> : <div className="admin-cover-empty"><ImagePlus size={28} /><span>暂无封面</span></div>}<label>图片地址<input value={draft.cover} onChange={event => update('cover', event.target.value)} placeholder="https://… 或 /uploads/…" /></label><label className="admin-upload-button"><ImagePlus size={16} />{uploading ? '上传中…' : '上传封面'}<input type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif" disabled={uploading} onChange={event => uploadCover(event.target.files?.[0])} /></label><AdminImagePicker media={media} value={draft.cover} label="从媒体库选择封面" disabled={uploading || busy} onChange={url => update('cover', url)} /></section></aside></div></form>;
}
