'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { AlignEndHorizontal, ArrowDownToLine, ArrowRight, Check, ChevronRight, ExternalLink, FilePenLine, FileText, FolderHeart, ImagePlus, LayoutDashboard, LoaderCircle, LogOut, Menu, MessageSquare, Music2, Palette, Plus, Settings2, ShieldCheck, TextCursorInput, TvMinimalPlay, Waves, X, type LucideIcon } from 'lucide-react';
import type { DashboardData, Post } from '@/lib/types';
import { adminApi, dateLabel, type Notify } from './api';
import AdminPosts from './AdminPosts';
import AdminComments from './AdminComments';
import AdminTaxonomies from './AdminTaxonomies';
import AdminMedia from './AdminMedia';
import AdminSettings from './AdminSettings';
import AdminBangumi from './AdminBangumi';

type Tab = 'dashboard' | 'posts' | 'pages' | 'comments' | 'taxonomies' | 'media' | 'appearance' | 'navigation' | 'footer' | 'copy' | 'bangumi' | 'music' | 'settings';
type Session = { authenticated: boolean; needsSetup: boolean; username?: string };
const navigation: { id: Tab; label: string; icon: LucideIcon }[] = [
  { id: 'dashboard', label: '概览', icon: LayoutDashboard },
  { id: 'posts', label: '文章', icon: FilePenLine },
  { id: 'pages', label: '页面', icon: FileText },
  { id: 'comments', label: '评论', icon: MessageSquare },
  { id: 'taxonomies', label: '分类与标签', icon: FolderHeart },
  { id: 'media', label: '媒体库', icon: ImagePlus },
  { id: 'appearance', label: '外观', icon: Palette },
  { id: 'navigation', label: '导航', icon: Menu },
  { id: 'footer', label: '页脚', icon: AlignEndHorizontal },
  { id: 'copy', label: '界面与文案', icon: TextCursorInput },
  { id: 'bangumi', label: '我的追番', icon: TvMinimalPlay },
  { id: 'music', label: '音乐', icon: Music2 },
  { id: 'settings', label: '站点设置', icon: Settings2 },
];

export default function AdminPanel() {
  const [session, setSession] = useState<Session | null>(null);
  const [data, setData] = useState<DashboardData | null>(null);
  const [tab, setTab] = useState<Tab>('dashboard');
  const [error, setError] = useState('');
  const [toast, setToast] = useState<{ message: string; error: boolean } | null>(null);
  const [newPost, setNewPost] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const [unsaved, setUnsaved] = useState(false);
  const notify: Notify = useCallback((message, isError = false) => setToast({ message, error: isError }), []);
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(null), 6500); return () => clearTimeout(timer); }, [toast]);

  const refresh = useCallback(async () => {
    setData(await adminApi<DashboardData>('/api/admin/dashboard'));
    setError('');
  }, []);

  useEffect(() => {
    adminApi<Session>('/api/auth/session').then(async value => {
      setSession(value);
      if (value.authenticated) await refresh();
    }).catch(reason => setError(reason.message));
  }, [refresh]);

  function navigate(next: Tab) {
    if (next === tab) return;
    if (unsaved && !confirm('文章还有未保存的修改，确定离开当前编辑器？')) return;
    setUnsaved(false); setNewPost(false); setEditId(null); setTab(next);
  }
  function writePost(post?: Post) { setTab(post?.type === 'page' ? 'pages' : 'posts'); setEditId(post?.id ?? null); setNewPost(!post); }
  async function logout() {
    if (unsaved && !confirm('文章还有未保存的修改，确定退出登录？')) return;
    setLoggingOut(true);
    try {
      await adminApi('/api/auth/logout', 'POST');
      setSession({ authenticated: false, needsSetup: false }); setData(null);
      setTab('dashboard'); setNewPost(false); setEditId(null); setUnsaved(false);
    }
    catch (reason) { notify((reason as Error).message, true); }
    finally { setLoggingOut(false); }
  }

  if (!session) return <div className="admin-root admin-loading"><Waves size={36} /><p>{error || '加载中…'}</p>{error ? <button className="admin-button" onClick={() => location.reload()}>重新加载</button> : <LoaderCircle className="admin-spin" size={20} />}</div>;
  if (!session.authenticated) return <AuthScreen setup={session.needsSetup} onAuthenticated={async () => { setSession(await adminApi<Session>('/api/auth/session')); try { await refresh(); } catch (reason) { setError((reason as Error).message); } }} />;

  const waiting = data?.comments.filter(comment => comment.status === 'waiting').length || 0;
  const current = navigation.find(item => item.id === tab)!;
  return <div className="admin-root">
    <a className="admin-skip" href="#admin-main">跳转到主要内容</a>
    <aside className="admin-sidebar" aria-label="后台导航">
      <a className="admin-brand" href="/"><span className="admin-brand-icon"><Waves size={25} /></span><span>博客<span className="admin-brand-caption">后台管理</span></span></a>

      <nav>{navigation.map(item => <button key={item.id} className={`admin-nav-item ${tab === item.id ? 'is-active' : ''}`} onClick={() => navigate(item.id)} aria-current={tab === item.id ? 'page' : undefined}><item.icon size={18} /><span>{item.label}</span>{item.id === 'comments' && waiting > 0 && <span className="admin-nav-count">{waiting}</span>}</button>)}</nav>
      <div className="admin-sidebar-bottom"><a className="admin-nav-item" href="/" target="_blank" rel="noreferrer"><ExternalLink size={17} />前往博客</a><a className="admin-nav-item" href="/api/admin/backup" download><ArrowDownToLine size={17} />导出站点数据</a><button className="admin-nav-item" onClick={logout} disabled={loggingOut}><LogOut size={17} />{loggingOut ? '正在退出…' : '退出登录'}</button></div>
    </aside>
    <div className="admin-workspace">
      <header className="admin-topbar"><div className="admin-breadcrumb">后台<ChevronRight size={14} /><span>{current.label}</span></div><div className="admin-user"><span className="admin-online-dot" />已登录<span className="admin-avatar">{(session.username || data?.settings.author || '博').slice(0, 1).toUpperCase()}</span></div></header>
      <main id="admin-main" className="admin-main" tabIndex={-1}>
        {!data ? <div className="admin-empty"><LoaderCircle className={error ? '' : 'admin-spin'} /><h2>{error || '正在加载站点数据'}</h2>{error && <button className="admin-button" onClick={() => refresh().catch(reason => setError(reason.message))}>重试</button>}</div> : <>
          {tab === 'dashboard' && <Dashboard data={data} onNavigate={navigate} onWrite={writePost} />}
          {(tab === 'posts' || tab === 'pages') && <AdminPosts username={session.username || ''} key={tab} posts={data.posts} taxonomies={data.taxonomies} media={data.media} type={tab === 'pages' ? 'page' : 'post'} initialNew={newPost} initialEditId={editId} onDirtyChange={setUnsaved} refresh={refresh} notify={notify} />}
          {tab === 'comments' && <AdminComments comments={data.comments} posts={data.posts} refresh={refresh} notify={notify} />}
          {tab === 'taxonomies' && <AdminTaxonomies taxonomies={data.taxonomies} refresh={refresh} notify={notify} />}
          {tab === 'media' && <AdminMedia media={data.media} refresh={refresh} notify={notify} />}
          {(tab === 'appearance' || tab === 'music' || tab === 'settings' || tab === 'navigation' || tab === 'footer' || tab === 'copy') && <AdminSettings key={tab} settings={data.settings} media={data.media} pages={data.posts.filter(post => post.type === 'page')} section={tab} refresh={refresh} notify={notify} />}
          {tab === 'bangumi' && <AdminBangumi settings={data.settings} refresh={refresh} notify={notify} />}
        </>}
      </main>
      <footer className="admin-footer">博客 · 后台管理</footer>
    </div>
    {toast && <div className={`admin-toast ${toast.error ? 'is-error' : ''}`} role={toast.error ? 'alert' : 'status'}>{toast.error ? <X size={18} /> : <Check size={18} />}<span>{toast.message}</span><button className="admin-icon-button" aria-label="关闭提示" onClick={() => setToast(null)}><X size={16} /></button></div>}
  </div>;
}

function AuthScreen({ setup, onAuthenticated }: { setup: boolean; onAuthenticated: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const username = String(form.get('username') || ''); const password = String(form.get('password') || '');
    if (setup && password !== form.get('confirmPassword')) { setError('两次输入的密码不一致。'); return; }
    setBusy(true); setError('');
    try { await adminApi(`/api/auth/${setup ? 'setup' : 'login'}`, 'POST', { username, password, ...(setup ? { setupToken: String(form.get('setupToken') || '') } : {}) }); await onAuthenticated(); }
    catch (reason) { setError((reason as Error).message); }
    finally { setBusy(false); }
  }
  return <div className="admin-root admin-auth"><div className="admin-auth-story"><a className="admin-brand" href="/"><span className="admin-brand-icon"><Waves size={28} /></span>博客</a><div><h1>后台管理</h1><p>撰写文章，管理博客。</p></div></div><main className="admin-auth-main"><div className="admin-auth-card"><span className="admin-small-icon"><ShieldCheck size={22} /></span><h2>{setup ? '创建管理员' : '登录后台'}</h2>{setup && <p>首次使用，请设置管理员账号。</p>}<form onSubmit={submit} className="admin-form"><label>管理员账号<input name="username" autoComplete="username" required minLength={setup ? 3 : 1} maxLength={64} placeholder="输入管理员账号" autoFocus /></label><label>登录密码<input name="password" type="password" autoComplete={setup ? 'new-password' : 'current-password'} required minLength={setup ? 12 : 1} placeholder={setup ? '至少 12 位，建议使用随机密码' : '输入登录密码'} /></label>{setup && <label>确认密码<input name="confirmPassword" type="password" autoComplete="new-password" required minLength={12} placeholder="再次输入密码" /></label>}{setup && <label>部署设置令牌<input name="setupToken" type="password" autoComplete="off" placeholder="本地开发可留空" /><small>填写服务器 .env.production 中的 ADMIN_SETUP_TOKEN；本地开发可留空。</small></label>}{error && <p className="admin-inline-error" role="alert">{error}</p>}<button type="submit" disabled={busy} className="admin-button admin-button-full">{busy ? <LoaderCircle size={18} className="admin-spin" /> : <ArrowRight size={18} />}{busy ? '正在进入…' : setup ? '创建管理员' : '登录'}</button></form><a href="/" className="admin-auth-return">返回博客首页 <ExternalLink size={13} /></a></div></main></div>;
}

function Dashboard({ data, onNavigate, onWrite }: { data: DashboardData; onNavigate: (tab: Tab) => void; onWrite: (post?: Post) => void }) {
  const recent = [...data.posts].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 5);
  const waiting = data.comments.filter(comment => comment.status === 'waiting');
  return <>
    <div className="admin-heading"><div><h1>博客概览</h1></div><button className="admin-button" onClick={() => onWrite()}><Plus size={18} />写文章</button></div>
    <div className="admin-stats">{[{ label: '已发布文章', value: data.stats.posts, icon: FileText, tab: 'posts' }, { label: '读者评论', value: data.stats.comments, icon: MessageSquare, tab: 'comments' }, { label: '累计阅读', value: data.stats.views, icon: Waves, tab: 'posts' }, { label: '灵感草稿', value: data.stats.drafts, icon: FilePenLine, tab: 'posts' }].map(item => <button key={item.label} className="admin-stat" onClick={() => onNavigate(item.tab as Tab)}><span className="admin-stat-label">{item.label}<item.icon size={19} /></span><strong>{item.value.toLocaleString('zh-CN')}</strong></button>)}</div>
    <div className="admin-dashboard-grid"><section className="admin-card"><div className="admin-card-heading"><div><h2>最近更新</h2></div><button className="admin-text-button" onClick={() => onNavigate('posts')}>全部文章<ArrowRight size={15} /></button></div>{recent.length ? <div className="admin-recent-list">{recent.map(post => <button key={post.id} className="admin-recent-item" onClick={() => onWrite(post)}><span className="admin-recent-icon"><FileText size={20} /></span><span className="admin-recent-content"><strong>{post.title}</strong><small>{post.category || '未分类'}<span>·</span>{dateLabel(post.updatedAt)}</small></span><span className={`admin-badge ${post.status === 'publish' ? 'is-published' : ''}`}>{post.status === 'publish' ? '已发布' : post.status === 'private' ? '私密' : '草稿'}</span><ChevronRight size={16} /></button>)}</div> : <div className="admin-empty"><FilePenLine /><p>暂无文章</p><button className="admin-button" onClick={() => onWrite()}>开始写作</button></div>}</section><aside className="admin-dashboard-aside"><section className="admin-card admin-quick-card"><h2>博客外观</h2><div className="admin-color-swatches" aria-hidden="true"><span /><span /><span /><span /></div><button className="admin-button admin-button-secondary" onClick={() => onNavigate('appearance')}>调整博客外观<Palette size={15} /></button></section><section className="admin-card admin-review-card"><div className="admin-card-heading"><span className="admin-small-icon"><MessageSquare size={20} /></span><span className="admin-badge">{waiting.length} 条待审核</span></div><h2>评论审核</h2><button className="admin-text-button" onClick={() => onNavigate('comments')}>管理评论<ArrowRight size={15} /></button></section></aside></div>
  </>;
}
