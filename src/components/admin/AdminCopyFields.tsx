'use client';

import { DEFAULT_LABELS, LABEL_FIELDS, isSafeSiteLink } from '@/lib/site-customization';
import type { SiteSettings } from '@/lib/types';
import styles from './AdminCustomization.module.css';

export default function AdminCopyFields({ draft, onChange }: { draft: SiteSettings; onChange: <K extends keyof SiteSettings>(key: K, value: SiteSettings[K]) => void }) {
  const tools = [['showSearch', '搜索按钮'], ['showThemeToggle', '配色切换'], ['showReadingSettings', '阅读设置'], ['showBackToTop', '返回顶部']] as const;
  const home = [['homeShowAuthorCard', '作者卡片'], ['homeShowSidebarLinks', '快捷链接'], ['homeShowAnnouncement', '站点公告']] as const;
  return <div className={styles.stack}>
    <section className="admin-card admin-form"><h2>首页按钮</h2><div className="admin-form-two"><label>主按钮地址<input value={draft.heroPrimaryHref} maxLength={2048} required onChange={event => { event.target.setCustomValidity(''); onChange('heroPrimaryHref', event.target.value); }} onBlur={event => event.target.setCustomValidity(isSafeSiteLink(event.target.value.trim()) ? '' : '请填写有效的链接地址。')} placeholder="#journal" /></label><label>次按钮地址<input value={draft.heroSecondaryHref} maxLength={2048} required onChange={event => { event.target.setCustomValidity(''); onChange('heroSecondaryHref', event.target.value); }} onBlur={event => event.target.setCustomValidity(isSafeSiteLink(event.target.value.trim()) ? '' : '请填写有效的链接地址。')} placeholder="/about" /></label></div><div className={styles.switchGrid}>{([['heroShowPrimaryButton', '显示主按钮'], ['heroShowSecondaryButton', '显示次按钮']] as const).map(([key, label]) => <label className="admin-switch-label" key={key}><span><strong>{label}</strong></span><input type="checkbox" role="switch" checked={draft[key]} onChange={event => onChange(key, event.target.checked)} /></label>)}</div></section>
    <section className="admin-card admin-form"><h2>首页组件</h2><div className={styles.switchGrid}>{home.map(([key, label]) => <label className="admin-switch-label" key={key}><span><strong>{label}</strong></span><input type="checkbox" role="switch" checked={draft[key]} onChange={event => onChange(key, event.target.checked)} /></label>)}</div></section>
    <section className="admin-card admin-form"><h2>常用工具</h2><div className={styles.switchGrid}>{tools.map(([key, label]) => <label className="admin-switch-label" key={key}><span><strong>{label}</strong></span><input type="checkbox" role="switch" checked={draft[key]} onChange={event => onChange(key, event.target.checked)} /></label>)}</div></section>
    <section className="admin-card admin-form"><div className="admin-card-heading"><h2>按钮与界面文字</h2><button type="button" className="admin-text-button" onClick={() => onChange('labels', { ...DEFAULT_LABELS })}>恢复默认文案</button></div><div className={styles.labelFields}>{LABEL_FIELDS.map(({ key, label }) => <label key={key}>{label}<input value={draft.labels[key]} maxLength={key === 'searchPlaceholder' ? 100 : 60} required onChange={event => onChange('labels', { ...draft.labels, [key]: event.target.value })} placeholder={DEFAULT_LABELS[key]} /></label>)}</div></section>
  </div>;
}
