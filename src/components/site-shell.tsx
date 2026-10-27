'use client';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { MotionConfig } from 'motion/react';
import { ArrowDown, ArrowUpRight, Check, Command, ImageIcon, LayoutGrid, Menu, Moon, Search, Settings2, Sparkles, Sun, X } from 'lucide-react';
import type { SiteSettings } from '@/lib/types';
import { APPEARANCE_STORAGE_KEY, isBackgroundUrl, readAppearance, resetAppearance, resolveAppearance, serializeAppearance, type Appearance, type AppearanceOverrides } from '@/lib/appearance';
import { MusicPlayer } from './music-player';
import { isBrandingImageSource } from '@/lib/branding';
import { formatCopyright, visibleSiteLinks } from '@/lib/site-customization';
import { SiteLink } from './site-link';
import { isCurrentSitePath } from '@/lib/urls';

export type SearchEntry = { title: string; url: string; category: string; excerpt: string };
function Brand({ title, subtitle, logo = '', compact = false }: { title: string; subtitle?: string; logo?: string; compact?: boolean }) {
  const [failedLogo, setFailedLogo] = useState<string | null>(null);
  const hasLogo = isBrandingImageSource(logo) && failedLogo !== logo;
  return <Link href="/" className="brand" aria-label={`${title}，返回首页`}><span className="brand-mark" style={{ position: 'relative', overflow: 'hidden', flexShrink: 0 }} aria-hidden="true">{hasLogo ? <Image src={logo} alt="" fill sizes={compact ? '30px' : '40px'} unoptimized={/^https:\/\//i.test(logo)} style={{ objectFit: 'contain' }} onError={() => setFailedLogo(logo)} /> : <Sparkles size={21} strokeWidth={1.6} />}</span><span>{title.replace(/\.$/, '')}<span className="brand-dot">.</span>{!compact && subtitle && <small>{subtitle}</small>}</span></Link>;
}
function Dialog({ open, close, children, className, label }: { open: boolean; close: () => void; children: ReactNode; className: string; label: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const dialog = ref.current; if (open && !dialog?.open) dialog?.showModal(); else if (!open && dialog?.open) dialog.close(); }, [open]);
  return <dialog ref={ref} aria-label={label} className={className} onCancel={close} onClose={close} onClick={e => { if (e.target === e.currentTarget) close(); }}>{children}</dialog>;
}
export function SiteShell({ children, settings, entries }: { children: ReactNode; settings: SiteSettings; entries: SearchEntry[] }) {
  const pathname = usePathname();
  const labels = settings.labels;
  const navigation = visibleSiteLinks(settings.navigation, settings.bangumiEnabled);
  const useMenu = navigation.length > 5 || navigation.reduce((length, item) => length + item.label.length, 0) > 20;
  const isAdmin = pathname.startsWith('/admin');
  const [search, setSearch] = useState(false), [appearance, setAppearance] = useState(false), [mobile, setMobile] = useState(false);
  const [query, setQuery] = useState('');
  const [overrides, setOverrides] = useState<AppearanceOverrides>({});
  const { mode, background, layout, fontSize } = resolveAppearance(overrides, settings);
  const initialSettings = useRef(settings);
  const preferencesRead = useRef(false);
  const [ready, setReady] = useState(false);
  const [resolvedMode, setResolvedMode] = useState(settings.colorMode === 'dark' ? 'dark' : 'light');
  const setMode = (mode: Appearance['mode']) => setOverrides(current => ({ ...current, mode }));
  const setBackground = (background: string) => setOverrides(current => ({ ...current, background }));
  const setLayout = (layout: Appearance['layout']) => setOverrides(current => ({ ...current, layout }));
  const setFontSize = (fontSize: number) => setOverrides(current => ({ ...current, fontSize }));
  useEffect(() => {
    if (preferencesRead.current) return;
    preferencesRead.current = true;
    try { setOverrides(readAppearance(localStorage.getItem(APPEARANCE_STORAGE_KEY), initialSettings.current)); } catch {}
    setReady(true);
  }, []);
  useEffect(() => {
    if (!ready) return;
    try { localStorage.setItem(APPEARANCE_STORAGE_KEY, serializeAppearance(overrides)); } catch {}
  }, [overrides, ready]);
  useEffect(() => {
    if (!ready) return;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const update = () => { const resolved = mode === 'system' ? (media.matches ? 'dark' : 'light') : mode; document.documentElement.dataset.theme = resolved; setResolvedMode(resolved); };
    update(); media.addEventListener('change', update);
    document.documentElement.dataset.layout = layout;
    document.documentElement.style.setProperty('--reading-size', `${fontSize}px`);
    return () => media.removeEventListener('change', update);
  }, [mode, layout, fontSize, ready]);
  useEffect(() => { setMobile(false); setSearch(false); }, [pathname]);
  useEffect(() => {
    const handle = (e: KeyboardEvent) => { if (settings.showSearch && (e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setSearch(v => !v); } };
    window.addEventListener('keydown', handle); return () => window.removeEventListener('keydown', handle);
  }, [settings.showSearch]);
  const closeSearch = useCallback(() => setSearch(false), []), closeAppearance = useCallback(() => setAppearance(false), []);
  const results = entries.filter(p => `${p.title} ${p.category} ${p.excerpt}`.toLowerCase().includes(query.toLowerCase())).slice(0, 12);
  if (isAdmin) return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
  const backgrounds = ['', '/images/hero.svg'];
  return <MotionConfig reducedMotion="user">
    <a href="#main-content" className="skip-link">跳到主要内容</a>
    {background && <div className="site-background" style={{ backgroundImage: `url(${JSON.stringify(background)})`, opacity: settings.backgroundOpacity ?? 0.12 }} aria-hidden />}
    <header className={`site-header${useMenu ? ' has-menu' : ''}`}><div className="header-inner">
      <Brand title={settings.title} subtitle={settings.subtitle} logo={settings.logo} />
      <nav className={`main-nav ${mobile ? 'is-open' : ''}`} aria-label="主要导航">
        {navigation.map(item => { const active = isCurrentSitePath(pathname, item.href); return <SiteLink key={item.id} href={item.href} newTab={item.newTab} onClick={() => setMobile(false)} className={active ? 'active' : ''} aria-current={active ? 'page' : undefined}>{item.label}</SiteLink>; })}
      </nav>
      <div className="header-actions">{settings.showSearch && <button className="search-trigger" onClick={() => setSearch(true)} aria-label={labels.search}><Search size={17} /><span>{labels.search}</span><kbd>⌘ K</kbd></button>}{settings.showThemeToggle && <button className="icon-button theme-toggle" onClick={() => setMode(resolvedMode === 'dark' ? 'light' : 'dark')} aria-label={resolvedMode === 'dark' ? '切换浅色模式' : '切换深色模式'}>{resolvedMode === 'dark' ? <Sun size={19} /> : <Moon size={19} />}</button>}{navigation.length > 0 && <button className="icon-button mobile-menu" onClick={() => setMobile(!mobile)} aria-expanded={mobile} aria-label="展开导航">{mobile ? <X size={20} /> : <Menu size={20} />}</button>}</div>
    </div></header>
    <main id="main-content">{children}</main>
    <footer className={`site-footer footer-${settings.footerAlign}`}>
      {(settings.footerShowBrand || settings.footer || settings.footerSecondary) && <div className="footer-description">{settings.footerShowBrand && <Brand title={settings.title} logo={settings.logo} compact />}{settings.footer && <p>{settings.footer}</p>}{settings.footerSecondary && <p>{settings.footerSecondary}</p>}</div>}
      <div className="footer-right">
        {settings.footerShowCopyright && settings.footerCopyright && <p>{formatCopyright(settings.footerCopyright, settings.author)}</p>}
        <div className="footer-links">{settings.footerLinks.map(item => <SiteLink key={item.id} href={item.href} newTab={item.newTab}>{item.label}</SiteLink>)}{settings.footerShowRss && <Link href="/feed.xml">{labels.rss}</Link>}{settings.footerShowAdmin && <Link href="/admin">{labels.admin} <ArrowUpRight size={12} /></Link>}</div>
      </div>
    </footer>
    {(settings.showReadingSettings || settings.showBackToTop) && <div className="floating-tools">{settings.showReadingSettings && <button className="icon-button" aria-label={labels.readSettings} onClick={() => setAppearance(true)}><Settings2 size={19} /></button>}{settings.showBackToTop && <a href="#main-content" className="icon-button" aria-label={labels.backToTop}><ArrowDown size={18} style={{ transform: 'rotate(180deg)' }} /></a>}</div>}
    {settings.musicEnabled && <MusicPlayer settings={settings} />}
    <Dialog open={search} close={closeSearch} label={labels.search} className="search-dialog"><div className="dialog-head"><Search size={20} /><input autoFocus aria-label="文章关键词" placeholder={labels.searchPlaceholder} value={query} onChange={e => setQuery(e.target.value)} /><button className="icon-button" onClick={closeSearch} aria-label="关闭搜索"><X size={19} /></button></div><div className="search-results"><div className="eyebrow">{query ? `${results.length} 篇文章` : '全部文章'}</div>{results.map(p => <Link key={p.url} href={p.url} onClick={closeSearch}><span><small>{p.category}</small><strong>{p.title}</strong><p>{p.excerpt.slice(0, 48)}</p></span><ArrowUpRight size={19} /></Link>)}{!results.length && <p className="empty-state">没有找到相关文章</p>}</div><div className="dialog-foot"><Command size={13} /> K 随时打开<span>ESC 关闭</span></div></Dialog>
    <Dialog open={appearance} close={closeAppearance} label={labels.readSettings} className="appearance-dialog"><div className="panel-title"><div><h2>{labels.readSettings}</h2></div><button className="icon-button" onClick={closeAppearance} aria-label="关闭外观设置"><X size={20} /></button></div><p className="muted">设置仅保存在当前设备。</p><h3>主题</h3><div className="segmented">{[['light', '浅色', Sun], ['dark', '深色', Moon], ['system', '随系统', Settings2]].map(([v, title, Icon]) => <button key={v as string} aria-pressed={mode === v} className={mode === v ? 'selected' : ''} onClick={() => setMode(v as typeof mode)}>{typeof Icon !== 'string' && <Icon size={16} />}{title as string}</button>)}</div><div className="background-heading"><h3>背景</h3><button className="text-link" disabled={!Object.hasOwn(overrides, 'background')} onClick={() => setOverrides(current => resetAppearance(current, 'background'))}>跟随站点</button></div><div className="background-options">{backgrounds.map((url, i) => <button key={url} aria-label={i === 0 ? '纯色背景' : `背景图片 ${i}`} aria-pressed={background === url} onClick={() => setBackground(url)} style={url ? { backgroundImage: `url(${url})` } : undefined}>{!url && <ImageIcon size={20} />}{background === url && <span><Check size={15} /></span>}</button>)}</div><label className="field-label" htmlFor="custom-background">自定义图片地址</label><input id="custom-background" className="text-input" value={background} onChange={e => { const value = e.target.value; if (isBackgroundUrl(value)) setBackground(value); }} placeholder="https://…" /><h3>文章布局</h3><div className="segmented">{[['magazine', '卡片'], ['compact', '列表']].map(([v, title]) => <button key={v} aria-pressed={layout === v} className={layout === v ? 'selected' : ''} onClick={() => setLayout(v as typeof layout)}><LayoutGrid size={16} />{title}</button>)}</div><h3><label htmlFor="reading-size">正文字号 <span className="muted">{fontSize}px</span></label></h3><input id="reading-size" type="range" min="15" max="24" value={fontSize} onChange={e => setFontSize(Number(e.target.value))} /><button className="button button-soft restore-button" onClick={() => setOverrides(current => resetAppearance(current))}>恢复默认</button></Dialog>
  </MotionConfig>;
}
