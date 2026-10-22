'use client';

import { useState, type ChangeEvent } from 'react';
import { ImageIcon, LoaderCircle, Sparkles, UploadCloud } from 'lucide-react';
import { DEFAULT_HERO_IMAGE, DEFAULT_HERO_IMAGE_ALT, isBrandingImageSource } from '@/lib/branding';
import type { Media, SiteSettings } from '@/lib/types';
import { adminApi } from './api';
import styles from './AdminBrandingFields.module.css';

type ImageField = 'logo' | 'heroImage';
type Props = {
  draft: SiteSettings;
  onChange: <K extends keyof SiteSettings>(key: K, value: SiteSettings[K]) => void;
  media: Media[];
  onUploadStateChange?: (uploading: boolean) => void;
};

function ImagePreview({ src, alt, kind }: { src: string; alt: string; kind: 'logo' | 'hero' }) {
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const canLoad = isBrandingImageSource(src) && failedSource !== src;
  return <div className={kind === 'logo' ? styles.logoPreview : styles.heroPreview}>
    {canLoad ? <img src={src} alt={alt} width={kind === 'logo' ? 64 : 640} height={kind === 'logo' ? 64 : 400} onError={() => setFailedSource(src)} /> : kind === 'logo' ? <Sparkles size={28} strokeWidth={1.6} aria-hidden="true" /> : <span className={styles.previewFallback}><ImageIcon size={28} aria-hidden="true" /><span>图片暂时无法加载</span></span>}
  </div>;
}

export function AdminBrandingFields({ draft, onChange, media, onUploadStateChange }: Props) {
  const [uploading, setUploading] = useState<ImageField | null>(null);
  const [uploaded, setUploaded] = useState<Media[]>([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const imageMedia = [...uploaded.filter(item => !media.some(existing => existing.id === item.id)), ...media].filter(item => item.mime.startsWith('image/'));

  async function upload(event: ChangeEvent<HTMLInputElement>, target: ImageField) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || uploading) return;
    setUploading(target); setError(''); setMessage(''); onUploadStateChange?.(true);
    try {
      const form = new FormData(); form.append('file', file);
      const result = await adminApi<{ media: Media }>('/api/admin/media', 'POST', form);
      setUploaded(current => [result.media, ...current]);
      onChange(target, result.media.url);
      setMessage('图片已上传，保存设置后生效。');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '上传失败，请重试。');
    } finally {
      setUploading(null); onUploadStateChange?.(false);
    }
  }

  function imageActions(target: ImageField, label: string) {
    return <div className="admin-form-two">
      <label className="admin-upload-button">{uploading === target ? <LoaderCircle size={17} className="admin-spin" /> : <UploadCloud size={17} />}{uploading === target ? '上传中…' : `上传${label}`}<input type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif" disabled={Boolean(uploading)} onChange={event => void upload(event, target)} /></label>
      <label><span className="admin-sr-only">从媒体库选择{label}</span><select value="" disabled={Boolean(uploading)} onChange={event => { if (event.target.value) onChange(target, event.target.value); }}><option value="">从媒体库选择{label}</option>{imageMedia.map(item => <option value={item.url} key={item.id}>{item.name}</option>)}</select></label>
    </div>;
  }

  return <>
    <section className="admin-card admin-form">
      <h2>站点图标</h2>
      <div className={styles.previewRow}><ImagePreview src={draft.logo || ''} alt="站点图标预览" kind="logo" /><small>用于页头和页脚，建议使用方形图片。</small></div>
      <label>图标图片地址<input value={draft.logo || ''} onChange={event => onChange('logo', event.target.value)} placeholder="https://… 或 /uploads/…" /></label>
      {imageActions('logo', '图标')}
      {draft.logo && <button type="button" className="admin-text-button" onClick={() => onChange('logo', '')}>恢复默认图标</button>}
    </section>
    <section className="admin-card admin-form">
      <h2>首页图片</h2>
      <ImagePreview src={draft.heroImage || DEFAULT_HERO_IMAGE} alt={draft.heroImageAlt || '首页图片预览'} kind="hero" />
      <label>首页图片地址<input value={draft.heroImage || ''} onChange={event => onChange('heroImage', event.target.value)} placeholder="https://… 或 /uploads/…" /></label>
      {imageActions('heroImage', '图片')}
      <label>图片描述<input value={draft.heroImageAlt ?? DEFAULT_HERO_IMAGE_ALT} onChange={event => onChange('heroImageAlt', event.target.value)} maxLength={300} placeholder="简短描述画面内容" /><small>供屏幕阅读器使用，纯装饰图片可留空。</small></label>
      <button type="button" className="admin-text-button" onClick={() => { onChange('heroImage', DEFAULT_HERO_IMAGE); onChange('heroImageAlt', DEFAULT_HERO_IMAGE_ALT); }}>恢复默认图片</button>
    </section>
    {error && <p className="admin-inline-error" role="alert">{error}</p>}
    {message && <p className="admin-muted" role="status">{message}</p>}
  </>;
}
