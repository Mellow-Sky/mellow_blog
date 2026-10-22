'use client';

import { useState, type FormEvent } from 'react';
import { FolderHeart, Hash, LoaderCircle, Pencil, Plus, Save, Trash2, X } from 'lucide-react';
import type { Taxonomy } from '@/lib/types';
import { adminApi, generatedSlug, type Notify } from './api';

export default function AdminTaxonomies({ taxonomies, refresh, notify }: { taxonomies: Taxonomy[]; refresh: () => Promise<void>; notify: Notify }) {
  const [type, setType] = useState<Taxonomy['type']>('category');
  const [editing, setEditing] = useState<Taxonomy | null>(null);
  const [name, setName] = useState(''); const [slug, setSlug] = useState(''); const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);
  function reset() { setEditing(null); setName(''); setSlug(''); setDescription(''); }
  function edit(item: Taxonomy) { setEditing(item); setName(item.name); setSlug(item.slug); setDescription(item.description); }
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true);
    try { await adminApi(editing ? `/api/admin/taxonomies/${editing.id}` : '/api/admin/taxonomies', editing ? 'PUT' : 'POST', { name: name.trim(), slug: slug.trim() || generatedSlug(name), description, type }); await refresh(); notify(editing ? '修改已保存。' : '创建成功。'); reset(); }
    catch (reason) { notify((reason as Error).message, true); }
    finally { setBusy(false); }
  }
  async function remove(item: Taxonomy) {
    if (!confirm(`确定删除${type === 'category' ? '分类' : '标签'}「${item.name}」？文章本身会保留。`)) return;
    setDeleting(item.id);
    try { await adminApi(`/api/admin/taxonomies/${item.id}`, 'DELETE'); await refresh(); if (editing?.id === item.id) reset(); notify('已删除。'); }
    catch (reason) { notify((reason as Error).message, true); }
    finally { setDeleting(null); }
  }
  return <><div className="admin-heading"><div><h1>分类与标签</h1></div></div><div className="admin-tabs admin-section-tabs"><button aria-pressed={type === 'category'} className={type === 'category' ? 'is-active' : ''} onClick={() => { setType('category'); reset(); }}><FolderHeart size={16} />文章分类<span>{taxonomies.filter(item => item.type === 'category').length}</span></button><button aria-pressed={type === 'tag'} className={type === 'tag' ? 'is-active' : ''} onClick={() => { setType('tag'); reset(); }}><Hash size={16} />文章标签<span>{taxonomies.filter(item => item.type === 'tag').length}</span></button></div><div className="admin-taxonomy-grid"><section className="admin-card"><div className="admin-card-heading"><h2>全部{type === 'category' ? '分类' : '标签'}</h2><span className="admin-muted">{taxonomies.filter(item => item.type === type).length} 项</span></div><div className="admin-taxonomy-list">{taxonomies.filter(item => item.type === type).map(item => <div key={item.id} className="admin-taxonomy-item"><span className="admin-small-icon">{type === 'category' ? <FolderHeart size={18} /> : <Hash size={18} />}</span><div><strong>{item.name}</strong><small>{item.description || item.slug}</small></div><button className="admin-icon-button" title="编辑" aria-label={`编辑 ${item.name}`} onClick={() => edit(item)}><Pencil size={15} /></button><button className="admin-icon-button is-danger" title="删除" aria-label={`删除 ${item.name}`} disabled={deleting === item.id} onClick={() => remove(item)}>{deleting === item.id ? <LoaderCircle size={15} className="admin-spin" /> : <Trash2 size={15} />}</button></div>)}{!taxonomies.some(item => item.type === type) && <div className="admin-empty"><FolderHeart size={30} /><p>添加第一个{type === 'category' ? '分类' : '标签'}。</p></div>}</div></section><form onSubmit={submit} className="admin-card admin-form admin-taxonomy-form"><div className="admin-card-heading"><h2>{editing ? '编辑' : '新建'}{type === 'category' ? '分类' : '标签'}</h2>{editing && <button type="button" className="admin-icon-button" aria-label="取消编辑" onClick={reset}><X size={17} /></button>}</div><label>名称<input value={name} onChange={event => setName(event.target.value)} required maxLength={100} placeholder={type === 'category' ? '例如：日常碎片' : '例如：生活'} /></label><label>访问别名<input value={slug} onChange={event => setSlug(event.target.value)} maxLength={200} placeholder="留空自动生成" /></label><label>描述<textarea aria-label="描述" value={description} onChange={event => setDescription(event.target.value)} rows={4} maxLength={1000} placeholder="可选" /></label><button type="submit" className="admin-button" disabled={busy || !name.trim()}>{busy ? <LoaderCircle size={16} className="admin-spin" /> : editing ? <Save size={16} /> : <Plus size={16} />}{editing ? '保存修改' : '创建'}</button></form></div></>;
}
