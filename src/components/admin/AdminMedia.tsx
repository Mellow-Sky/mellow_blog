'use client';

import { useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import { Copy, ExternalLink, File, ImagePlus, LoaderCircle, Music2, Search, Trash2, UploadCloud } from 'lucide-react';
import type { Media } from '@/lib/types';
import { adminApi, dateLabel, sizeLabel, type Notify } from './api';

export default function AdminMedia({ media, refresh, notify }: { media: Media[]; refresh: () => Promise<void>; notify: Notify }) {
  const [query, setQuery] = useState(''); const [filter, setFilter] = useState('all');
  const [uploading, setUploading] = useState(false); const [dragging, setDragging] = useState(false); const [deleting, setDeleting] = useState<number | null>(null);
  const uploadInput = useRef<HTMLInputElement>(null);
  const filtered = [...media].filter(item => item.name.toLowerCase().includes(query.toLowerCase()) && (filter === 'all' || item.mime.startsWith(filter))).sort((a, b) => b.createdAt - a.createdAt);
  async function upload(files: FileList | null) {
    if (!files?.length || uploading) return;
    setUploading(true); let count = 0;
    try {
      for (const file of Array.from(files)) { const form = new FormData(); form.append('file', file); await adminApi('/api/admin/media', 'POST', form); count++; }
      await refresh(); notify(`已上传 ${count} 个文件。`);
    } catch (reason) { if (count) await refresh(); notify(`${count ? `已上传 ${count} 个文件。` : ''}${(reason as Error).message}`, true); }
    finally { setUploading(false); if (uploadInput.current) uploadInput.current.value = ''; }
  }
  function drop(event: DragEvent<HTMLDivElement>) { event.preventDefault(); setDragging(false); void upload(event.dataTransfer.files); }
  async function copy(url: string) { try { await navigator.clipboard.writeText(url.startsWith('/') ? `${location.origin}${url}` : url); notify('文件地址已复制。'); } catch { notify('浏览器不允许访问剪贴板，请打开文件后复制地址。', true); } }
  async function remove(item: Media) {
    if (!confirm(`确定删除「${item.name}」？引用此文件的文章可能无法再显示它。`)) return;
    setDeleting(item.id);
    try { await adminApi(`/api/admin/media/${item.id}`, 'DELETE'); await refresh(); notify('文件已删除。'); }
    catch (reason) { notify((reason as Error).message, true); }
    finally { setDeleting(null); }
  }
  return <><div className="admin-heading"><div><h1>媒体库</h1></div><button className="admin-button" onClick={() => uploadInput.current?.click()} disabled={uploading}>{uploading ? <LoaderCircle size={17} className="admin-spin" /> : <ImagePlus size={17} />}{uploading ? '正在上传…' : '上传文件'}</button></div><input ref={uploadInput} className="admin-sr-only" type="file" multiple aria-label="选择上传文件" accept="image/jpeg,image/png,image/webp,image/gif,image/avif,audio/mpeg,audio/ogg,audio/wav" disabled={uploading} onChange={(event: ChangeEvent<HTMLInputElement>) => upload(event.target.files)} /><div className={`admin-dropzone ${dragging ? 'is-dragging' : ''}`} onDragOver={event => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={drop}><span className="admin-upload-cloud"><UploadCloud size={30} strokeWidth={1.5} /></span><h2>{uploading ? '上传中…' : '拖放文件上传'}</h2><p>支持 JPG、PNG、WebP、GIF、AVIF 和 MP3、OGG、WAV；单个文件最大 20 MB。</p><button type="button" className="admin-text-button" disabled={uploading} onClick={() => uploadInput.current?.click()}>或点击选择文件 <ImagePlus size={15} /></button></div><section className="admin-card"><div className="admin-list-toolbar"><div className="admin-tabs" aria-label="媒体类型">{[{ id: 'all', name: '全部文件' }, { id: 'image/', name: '图片' }, { id: 'audio/', name: '音频' }].map(item => <button key={item.id} className={filter === item.id ? 'is-active' : ''} aria-pressed={filter === item.id} onClick={() => setFilter(item.id)}>{item.name}</button>)}</div><label className="admin-search"><Search size={17} /><span className="admin-sr-only">搜索文件</span><input value={query} onChange={event => setQuery(event.target.value)} placeholder="搜索文件名称…" /></label></div>{filtered.length ? <div className="admin-media-grid">{filtered.map(item => <article className="admin-media-item" key={item.id}><div className="admin-media-preview">{item.mime.startsWith('image/') ? <img src={item.url} alt={item.name} loading="lazy" /> : item.mime.startsWith('audio/') ? <Music2 size={42} strokeWidth={1} /> : <File size={42} strokeWidth={1} />}</div><div className="admin-media-info"><strong title={item.name}>{item.name}</strong><small>{sizeLabel(item.size)} · {dateLabel(item.createdAt)}</small><div className="admin-media-actions"><button className="admin-icon-button" title="复制文件地址" aria-label={`复制 ${item.name} 的地址`} onClick={() => copy(item.url)}><Copy size={15} /></button><a className="admin-icon-button" title="打开文件" aria-label={`打开 ${item.name}`} href={item.url} target="_blank" rel="noreferrer"><ExternalLink size={15} /></a><button className="admin-icon-button is-danger" title="删除文件" aria-label={`删除 ${item.name}`} disabled={deleting === item.id} onClick={() => remove(item)}>{deleting === item.id ? <LoaderCircle size={15} className="admin-spin" /> : <Trash2 size={15} />}</button></div></div></article>)}</div> : <div className="admin-empty"><ImagePlus size={32} /><h3>{query ? '没有找到匹配的文件' : '暂无文件'}</h3><p>可用于文章、背景和音乐。</p></div>}<p className="admin-media-summary">资料库共有 {media.length} 个文件 · {sizeLabel(media.reduce((sum, item) => sum + item.size, 0))}</p></section></>;
}
