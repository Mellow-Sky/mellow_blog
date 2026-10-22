'use client';

import type { NavigationItem, Post, SiteSettings } from '@/lib/types';
import { DEFAULT_NAVIGATION, DEFAULT_SIDEBAR_LINKS } from '@/lib/site-customization';
import AdminLinkListFields, { newLinkId } from './AdminLinkListFields';
import styles from './AdminCustomization.module.css';

export default function AdminNavigationFields({ draft, onChange, pages = [] }: { draft: SiteSettings; onChange: <K extends keyof SiteSettings>(key: K, value: SiteSettings[K]) => void; pages?: Post[] }) {
  const createItem = (label = '新链接', href = '/'): NavigationItem => ({ id: newLinkId(), label, href, visible: true, newTab: false });
  return <div className={styles.stack}>
    <section className="admin-card admin-form"><div className="admin-card-heading"><h2>顶部导航</h2><button type="button" className="admin-text-button" onClick={() => onChange('navigation', DEFAULT_NAVIGATION.map(item => ({ ...item })))}>恢复默认</button></div><p className={styles.sectionNote}>按顺序显示在页头与移动菜单中。</p><AdminLinkListFields title="导航链接" items={draft.navigation} onChange={value => onChange('navigation', value)} createItem={createItem} visibility pages={pages} /></section>
    <section className="admin-card admin-form"><div className="admin-card-heading"><h2>首页快捷链接</h2><button type="button" className="admin-text-button" onClick={() => onChange('sidebarLinks', DEFAULT_SIDEBAR_LINKS.map(item => ({ ...item })))}>恢复默认</button></div><AdminLinkListFields title="快捷链接" items={draft.sidebarLinks} onChange={value => onChange('sidebarLinks', value)} createItem={createItem} visibility pages={pages} /></section>
  </div>;
}
