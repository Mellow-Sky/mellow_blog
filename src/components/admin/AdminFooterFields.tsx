'use client';

import type { FooterLink, SiteSettings } from '@/lib/types';
import AdminLinkListFields, { newLinkId } from './AdminLinkListFields';
import styles from './AdminCustomization.module.css';

export default function AdminFooterFields({ draft, onChange }: { draft: SiteSettings; onChange: <K extends keyof SiteSettings>(key: K, value: SiteSettings[K]) => void }) {
  const switches = [ ['footerShowBrand', '显示站点标识'], ['footerShowCopyright', '显示版权文字'], ['footerShowRss', '显示 RSS 订阅'], ['footerShowAdmin', '显示管理入口'] ] as const;
  return <div className={styles.stack}>
    <section className="admin-card admin-form"><h2>页脚内容</h2><label>主要文字<textarea rows={3} value={draft.footer} maxLength={2000} onChange={event => onChange('footer', event.target.value)} placeholder="站点介绍或备案信息" /><small>支持换行；留空则隐藏。</small></label><label>补充文字<textarea rows={2} value={draft.footerSecondary} maxLength={2000} onChange={event => onChange('footerSecondary', event.target.value)} /></label><label>版权文字<input value={draft.footerCopyright} maxLength={500} onChange={event => onChange('footerCopyright', event.target.value)} /><small>可用变量：{'{year}'} 年份、{'{author}'} 作者。</small></label><label>内容排列<select value={draft.footerAlign} onChange={event => onChange('footerAlign', event.target.value as SiteSettings['footerAlign'])}><option value="spread">两端排列</option><option value="center">居中排列</option></select></label><div className={styles.switchGrid}>{switches.map(([key, label]) => <label className="admin-switch-label" key={key}><span><strong>{label}</strong></span><input type="checkbox" role="switch" checked={draft[key]} onChange={event => onChange(key, event.target.checked)} /></label>)}</div></section>
    <section className="admin-card admin-form"><h2>页脚链接</h2><AdminLinkListFields title="页脚链接" items={draft.footerLinks} onChange={value => onChange('footerLinks', value)} createItem={(label = '新链接', href = '/'): FooterLink => ({ id: newLinkId(), label, href, newTab: false })} /></section>
  </div>;
}
