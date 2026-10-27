'use client';

import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import type { FooterLink, Post } from '@/lib/types';
import { isSafeSiteLink } from '@/lib/site-customization';
import { postUrl } from '@/lib/utils';
import styles from './AdminCustomization.module.css';

type EditableLink = FooterLink & { visible?: boolean };

export function newLinkId() {
  return typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `link-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function AdminLinkListFields<T extends EditableLink>({ items, onChange, createItem, visibility = false, pages = [], title }: {
  items: T[]; onChange: (items: T[]) => void; createItem: (label?: string, href?: string) => T;
  visibility?: boolean; pages?: Post[]; title: string;
}) {
  function update(index: number, patch: Partial<EditableLink>) {
    onChange(items.map((item, at) => at === index ? { ...item, ...patch } : item));
  }
  function move(index: number, direction: -1 | 1) {
    const next = [...items]; const destination = index + direction;
    if (destination < 0 || destination >= next.length) return;
    [next[index], next[destination]] = [next[destination], next[index]];
    onChange(next);
  }
  return <div className={styles.linkList}>
    {items.length === 0 && <p className={styles.empty}>暂无链接。保存后将隐藏这一组链接。</p>}
    {items.map((item, index) => <fieldset className={styles.linkRow} key={item.id}>
      <legend>{title} {index + 1}</legend>
      <div className={styles.rowHeading}><strong>{item.label || '未命名链接'}</strong><div className={styles.rowActions}>
        <button type="button" className="admin-icon-button" aria-label={`上移${title} ${index + 1}`} disabled={index === 0} onClick={() => move(index, -1)}><ArrowUp size={17} /></button>
        <button type="button" className="admin-icon-button" aria-label={`下移${title} ${index + 1}`} disabled={index === items.length - 1} onClick={() => move(index, 1)}><ArrowDown size={17} /></button>
        <button type="button" className={`admin-icon-button ${styles.danger}`} aria-label={`删除${title} ${index + 1}`} onClick={() => onChange(items.filter((_, at) => at !== index))}><Trash2 size={17} /></button>
      </div></div>
      <div className="admin-form-two"><label>链接名称<input value={item.label} maxLength={80} required onChange={event => update(index, { label: event.target.value })} /></label><label>链接地址<input value={item.href} maxLength={2048} required placeholder="/about 或 https://…" spellCheck={false} onChange={event => { event.target.setCustomValidity(''); update(index, { href: event.target.value }); }} onBlur={event => event.target.setCustomValidity(isSafeSiteLink(event.target.value.trim()) ? '' : '请使用本站路径、HTTP(S) 地址、锚点或邮件地址。')} /></label></div>
      <div className={styles.rowOptions}>
        {visibility && <label className="admin-checkbox"><input type="checkbox" checked={item.visible !== false} onChange={event => update(index, { visible: event.target.checked })} />显示此链接</label>}
        <label className="admin-checkbox"><input type="checkbox" checked={item.newTab} onChange={event => update(index, { newTab: event.target.checked })} />在新窗口打开</label>
      </div>
    </fieldset>)}
    <div className={styles.addRow}>
      <button type="button" className="admin-button admin-button-secondary" disabled={items.length >= 20} onClick={() => onChange([...items, createItem()])}><Plus size={17} />添加{title}</button>
      {pages.length > 0 && <label><span className="admin-sr-only">添加已有页面至{title}</span><select value="" disabled={items.length >= 20} onChange={event => { const page = pages.find(item => item.id === Number(event.target.value)); if (page) onChange([...items, createItem(page.title.slice(0, 80), postUrl(page))]); }}><option value="">从已有页面添加</option>{pages.map(page => <option value={page.id} key={page.id}>{page.title}{page.status !== 'publish' ? '（未公开）' : ''}</option>)}</select></label>}
    </div>
  </div>;
}
