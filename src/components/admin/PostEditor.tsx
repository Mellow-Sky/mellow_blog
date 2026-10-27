'use client';

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { ArrowLeft, Check, ImagePlus, LoaderCircle, Save, Send, X } from 'lucide-react';
import type { Media, Post, Taxonomy } from '@/lib/types';
import { postUrl } from '@/lib/utils';
import { contentFingerprint, editorDraftKey } from '@/lib/editor-drafts';
import { adminApi, generatedSlug, type Notify } from './api';
import AdminImagePicker from './AdminImagePicker';
import MarkdownEditor from './MarkdownEditor';
import { useLocalPostDraft } from './useLocalPostDraft';
import styles from './PostEditor.module.css';

type Props = {
  post?: Post; type: 'post' | 'page'; username: string; taxonomies: Taxonomy[]; media: Media[];
  onBack: () => void; onDirtyChange: (dirty: boolean) => void; refresh: () => Promise<void>; notify: Notify;
};

function initialPost(post: Post | undefined, type: 'post' | 'page'): Post {
  return post ? { ...post, categories: post.categories ?? (post.category ? [post.category] : []) } : {
    id: 0, title: '', slug: '', content: '', excerpt: '', createdAt: Math.floor(Date.now() / 1000), updatedAt: Math.floor(Date.now() / 1000),
    status: 'draft', type, category: '', categories: [], tags: [], cover: '', views: 0, allowComment: true, pinned: false, format: 'markdown',
  };
}
const localTime = (value: number) => new Intl.DateTimeFormat('zh-CN', { dateStyle: 'short', timeStyle: 'medium', timeZone: 'Asia/Shanghai' }).format(value);

export default function PostEditor({ post, type, username, taxonomies, media, onBack, onDirtyChange, refresh, notify }: Props) {
  const [draft, setDraft] = useState(() => initialPost(post, type));
  const [tags, setTags] = useState(post?.tags.join(', ') || '');
  const [saved, setSaved] = useState(() => contentFingerprint({ post: draft, tags }));
  const [baseUpdatedAt, setBaseUpdatedAt] = useState(post?.updatedAt ?? null);
  const [busy, setBusy] = useState(false);
  const [coverUploading, setCoverUploading] = useState(false);
  const [bodyUploading, setBodyUploading] = useState(false);
  const [error, setError] = useState('');
  const form = useRef<HTMLFormElement>(null);
  const shortcutSubmit = useRef<HTMLButtonElement>(null);
  const saveLock = useRef(false);
  const previouslyUploading = useRef(false);
  const content = useMemo(() => ({ post: draft, tags }), [draft, tags]);
  const dirty = contentFingerprint(content) !== saved;
  const local = useLocalPostDraft(username, content, dirty, baseUpdatedAt);
  const uploading = coverUploading || bodyUploading;
  const disabled = busy || uploading;
  const selectedCategories = draft.categories ?? (draft.category ? [draft.category] : []);
  const categoryOptions = Array.from(new Set([...taxonomies.filter(item => item.type === 'category').map(item => item.name), ...selectedCategories]));
  const previewSlug = draft.slug.trim() || (draft.title.trim() ? generatedSlug(draft.title) : '我的第一篇文章');

  useEffect(() => { onDirtyChange(dirty || uploading); return () => onDirtyChange(false); }, [dirty, uploading, onDirtyChange]);
  useEffect(() => {
    if (previouslyUploading.current && !bodyUploading) void refresh().catch(() => {});
    previouslyUploading.current = bodyUploading;
  }, [bodyUploading, refresh]);
  useEffect(() => {
    const protect = (event: BeforeUnloadEvent) => { if (dirty || uploading) event.preventDefault(); };
    window.addEventListener('beforeunload', protect);
    return () => window.removeEventListener('beforeunload', protect);
  }, [dirty, uploading]);

  function update<K extends keyof Post>(key: K, value: Post[K]) { setDraft(current => ({ ...current, [key]: value })); }
  function quickSave() { if (!disabled) form.current?.requestSubmit(shortcutSubmit.current || undefined); }
  function restore() {
    if (!local.recovery) return;
    const recovered = local.recovery.content;
    setDraft({ ...recovered.post, id: draft.id, views: draft.views, updatedAt: draft.updatedAt });
    setTags(recovered.tags); local.acceptRecovery(); notify('已恢复本地草稿，请确认后保存。');
  }
  function toggleCategory(name: string, checked: boolean) {
    setDraft(current => {
      const categories = checked ? [...(current.categories || []), name] : (current.categories || []).filter(item => item !== name);
      return { ...current, categories, category: categories.includes(current.category) ? current.category : categories[0] || '' };
    });
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saveLock.current || uploading) return;
    const action = ((event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null)?.value;
    const status = action === 'draft' ? 'draft' : action === 'publish' ? 'publish' : action === 'quick-save' && !draft.id ? 'draft' : draft.status;
    const payload = { ...draft, slug: draft.slug.trim() || generatedSlug(draft.title), categories: Array.from(new Set([draft.category, ...selectedCategories].filter(Boolean))), tags: Array.from(new Set(tags.split(/[,，]/).map(tag => tag.trim()).filter(Boolean))), status };
    saveLock.current = true; setBusy(true); setError('');
    try {
      const result = await adminApi<{ post: Post }>(draft.id ? `/api/admin/posts/${draft.id}` : '/api/admin/posts', draft.id ? 'PUT' : 'POST', payload);
      const nextTags = result.post.tags.join(', ');
      local.clearSaved(local.key, editorDraftKey(username, type, result.post.id));
      setDraft(result.post); setTags(nextTags); setSaved(contentFingerprint({ post: result.post, tags: nextTags })); setBaseUpdatedAt(result.post.updatedAt);
      notify(action === 'publish' ? '已发布。' : '已保存。');
      try { await refresh(); } catch { notify('文章已保存，列表刷新失败，请稍后重新进入。', true); }
    } catch (reason) { const message = (reason as Error).message; setError(message); notify(message, true); }
    finally { saveLock.current = false; setBusy(false); }
  }
  async function uploadCover(file?: File) {
    if (!file || disabled) return;
    setCoverUploading(true);
    try {
      const body = new FormData(); body.append('file', file);
      const result = await adminApi<{ media: Media }>('/api/admin/media', 'POST', body);
      update('cover', result.media.url); notify('封面已上传。'); await refresh();
    } catch (reason) { notify((reason as Error).message, true); }
    finally { setCoverUploading(false); }
  }

  return <form ref={form} onSubmit={save} className="admin-editor-form" onKeyDown={event => {
    if (!event.defaultPrevented && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') { event.preventDefault(); quickSave(); }
  }}>
    <div className="admin-editor-heading"><div>
      <button className="admin-text-button" type="button" onClick={() => { if ((!dirty && !uploading) || confirm('还有未保存的修改，确定离开编辑器？')) onBack(); }}><ArrowLeft size={16} />返回{type === 'page' ? '页面' : '文章'}列表</button>
      <h1>{draft.id ? '编辑' : '新建'}{type === 'page' ? '页面' : '文章'}</h1>
    </div><div className="admin-button-row">
      <span className="admin-save-status">{!draft.id ? '尚未保存到服务器' : dirty ? '有未保存的修改' : <><Check size={14} />已保存</>}</span>
      <button className="admin-button admin-button-secondary" type="submit" name="action" value="draft" disabled={disabled}><Save size={16} />存为草稿</button>
      <button className="admin-button" type="submit" name="action" value={draft.status === 'private' ? 'save' : 'publish'} disabled={disabled}>{busy ? <LoaderCircle size={16} className="admin-spin" /> : <Send size={16} />}{draft.status === 'private' ? '保存私密文章' : '发布文章'}</button>
    </div></div>
    <button ref={shortcutSubmit} type="submit" name="action" value="quick-save" className={styles.shortcutSubmit} tabIndex={-1} aria-hidden="true" disabled={disabled}>保存当前文章</button>
    {local.recovery && <section className={styles.recovery} aria-label="恢复本地草稿">
      <strong>找到未保存的本地草稿</strong><p>保存于 {localTime(local.recovery.savedAt)}。恢复会替换编辑器中的当前内容。</p>
      {draft.id > 0 && local.recovery.baseUpdatedAt !== baseUpdatedAt && <p className={styles.warning}>服务器上的文章已更新，请确认是否仍要恢复这份草稿。</p>}
      <div className="admin-button-row"><button type="button" className="admin-button" onClick={restore}>恢复本地草稿</button><button type="button" className="admin-button admin-button-secondary" onClick={local.discardRecovery}>忽略本地草稿</button></div>
    </section>}
    <div className={`${styles.localStatus} ${local.failed ? styles.localError : ''}`} role="status">
      <strong>{local.failed ? '本地草稿保存失败，请手动保存到服务器。' : local.savedAt ? `本地草稿已保存 · ${localTime(local.savedAt)}` : '输入后自动保存本地草稿'}</strong>
      <span>Ctrl / ⌘ + S 保存到服务器</span>
    </div>
    {error && <p className="admin-inline-error" role="alert">{error}</p>}
    <fieldset className={styles.fields} disabled={busy}><div className="admin-editor-grid"><div className="admin-editor-main">
      <section className="admin-card admin-writing-card">
        <label className="admin-sr-only" htmlFor="post-title">标题</label><input id="post-title" className="admin-title-input" value={draft.title} onChange={event => update('title', event.target.value)} required maxLength={300} placeholder="文章标题" />
        <MarkdownEditor value={draft.content} onChange={value => update('content', value)} format={draft.format} onFormatChange={value => update('format', value)} media={media} disabled={busy || coverUploading} onSave={quickSave} onUploadStateChange={setBodyUploading} />
      </section>
      <section className="admin-card admin-form"><h2>文章摘要</h2><label>简介<textarea aria-label="简介" value={draft.excerpt} onChange={event => update('excerpt', event.target.value)} rows={3} placeholder="留空时自动生成，可在正文插入摘要分隔线。" maxLength={2000} /></label></section>
    </div><aside className="admin-editor-aside">
      <section className="admin-card admin-form"><h2>发布设置</h2>
        <label>访问路径<input value={draft.slug} onChange={event => update('slug', event.target.value)} placeholder="例如：我的第一篇文章，留空根据标题生成" maxLength={180} /><small>支持中文；保持原有路径可保留文章地址。</small></label>
        <output aria-label="访问地址预览" className="admin-muted" style={{ overflowWrap: 'anywhere' }}>访问地址：{postUrl({ type, slug: previewSlug })}</output>
        <label>可见状态<select value={draft.status} onChange={event => update('status', event.target.value as Post['status'])}><option value="draft">草稿</option><option value="publish">公开发布</option><option value="private">私密</option></select></label>
        <fieldset className="admin-fieldset admin-category-fieldset"><legend>所属分类（可多选）</legend><div className="admin-category-options">{categoryOptions.map(name => <label className="admin-checkbox" key={name}><input type="checkbox" checked={selectedCategories.includes(name)} onChange={event => toggleCategory(name, event.target.checked)} />{name}</label>)}</div>{!categoryOptions.length && <p className="admin-muted">可先在分类与标签中创建分类。</p>}</fieldset>
        {selectedCategories.length > 0 && <label>主分类<select aria-label="主分类" value={draft.category} onChange={event => update('category', event.target.value)}>{selectedCategories.map(name => <option value={name} key={name}>{name}</option>)}</select></label>}
        <label>标签<input value={tags} onChange={event => setTags(event.target.value)} placeholder="生活, 技术, 随想" list="admin-existing-tags" /><small>用逗号分隔多个标签。</small><datalist id="admin-existing-tags">{taxonomies.filter(item => item.type === 'tag').map(item => <option value={item.name} key={item.id} />)}</datalist></label>
        <label className="admin-checkbox"><input type="checkbox" checked={draft.pinned} onChange={event => update('pinned', event.target.checked)} />置顶这篇文章</label>
        <label className="admin-checkbox"><input type="checkbox" checked={draft.allowComment} onChange={event => update('allowComment', event.target.checked)} />允许读者评论</label>
        <button type="submit" name="action" value="save" className="admin-button admin-button-secondary admin-button-full" disabled={disabled}><Save size={16} />保存当前设置</button>
      </section>
      <section className="admin-card admin-form"><h2>封面图片</h2>
        {draft.cover ? <div className="admin-cover-preview"><img src={draft.cover} alt="文章封面预览" /><button type="button" className="admin-icon-button" aria-label="移除封面" onClick={() => update('cover', '')}><X size={16} /></button></div> : <div className="admin-cover-empty"><ImagePlus size={28} /><span>暂无封面</span></div>}
        <label>图片地址<input value={draft.cover} onChange={event => update('cover', event.target.value)} placeholder="https://… 或 /uploads/…" /></label>
        <label className="admin-upload-button"><ImagePlus size={16} />{coverUploading ? '上传中…' : '上传封面'}<input type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif" disabled={disabled} onChange={event => { void uploadCover(event.target.files?.[0]); event.target.value = ''; }} /></label>
        <AdminImagePicker media={media} value={draft.cover} label="从媒体库选择封面" disabled={disabled} onChange={url => update('cover', url)} />
      </section>
    </aside></div></fieldset>
  </form>;
}
