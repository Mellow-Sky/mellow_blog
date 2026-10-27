'use client';

import { useState } from 'react';
import { Check, ImageOff } from 'lucide-react';
import type { Media } from '@/lib/types';
import styles from './AdminImagePicker.module.css';

type Props = {
  media: Media[];
  value: string;
  onChange: (url: string) => void;
  label: string;
  disabled?: boolean;
};

function Thumbnail({ item, selected, onSelect }: { item: Media; selected: boolean; onSelect: () => void }) {
  const [failed, setFailed] = useState(false);
  return <button type="button" className={styles.thumbnail} aria-label={`选择 ${item.name}`} aria-pressed={selected} title={item.name} onClick={onSelect}>
    {failed ? <span className={styles.fallback}><ImageOff size={24} aria-hidden="true" /><span>无法预览</span></span> : <img src={item.url} alt="" width={120} height={90} loading="lazy" decoding="async" onError={() => setFailed(true)} />}
    {selected && <span className={styles.selected} aria-hidden="true"><Check size={16} strokeWidth={3} /></span>}
  </button>;
}

export default function AdminImagePicker({ media, value, onChange, label, disabled = false }: Props) {
  const images = media.filter(item => item.mime.startsWith('image/'));
  return <fieldset className={styles.picker} disabled={disabled}>
    <legend>{label}</legend>
    {images.length ? <div className={styles.grid}>
      {images.map(item => <Thumbnail key={`${item.id}:${item.url}`} item={item} selected={item.url === value} onSelect={() => onChange(item.url)} />)}
    </div> : <p className={styles.empty}>媒体库暂无图片，可先上传。</p>}
  </fieldset>;
}
