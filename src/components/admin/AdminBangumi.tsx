'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowUpRight, Check, KeyRound, LoaderCircle, RefreshCw, Save, Trash2 } from 'lucide-react';
import type { SiteSettings } from '@/lib/types';
import type { BangumiAdminState } from '@/lib/bangumi-types';
import { adminApi, type Notify } from './api';
import styles from './AdminCustomization.module.css';

type Operation = 'token' | 'clear' | 'sync' | 'settings' | null;
const statuses = [{ value: '3', label: '在看' }, { value: '1', label: '想看' }, { value: '2', label: '看过' }, { value: '4', label: '搁置' }, { value: '5', label: '抛弃' }, { value: 'all', label: '全部' }];

function timeLabel(value: string | null) {
  if (!value) return '尚未同步';
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Shanghai' }).format(date) : '尚未同步';
}

export default function AdminBangumi({ settings, refresh, notify }: { settings: SiteSettings; refresh: () => Promise<void>; notify: Notify }) {
  const [state, setState] = useState<BangumiAdminState | null>(null);
  const [draft, setDraft] = useState(settings);
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState<Operation>(null);
  const [loadError, setLoadError] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const lock = useRef(false);
  const mounted = useRef(true);

  const load = useCallback(async () => {
    try { const result = await adminApi<BangumiAdminState>('/api/admin/bangumi'); if (mounted.current) { setState(result); setLoadError(''); } }
    catch (reason) { if (mounted.current) setLoadError((reason as Error).message); }
    finally { if (mounted.current) setLoading(false); }
  }, []);
  useEffect(() => { mounted.current = true; void load(); return () => { mounted.current = false; }; }, [load]);
  useEffect(() => {
    if (!state?.syncing) return;
    let cancelled = false; let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      await load();
      if (!cancelled) timer = setTimeout(poll, 4000);
    }
    timer = setTimeout(poll, 4000);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [state?.syncing, load]);

  async function run(operation: Exclude<Operation, null>, action: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true; setBusy(operation); setError('');
    try { await action(); }
    catch (reason) { const message = (reason as Error).message; if (mounted.current) setError(message); notify(message, true); }
    finally { lock.current = false; if (mounted.current) setBusy(null); }
  }
  function saveToken(event: FormEvent) {
    event.preventDefault(); const value = token.trim(); if (!value) return;
    void run('token', async () => {
      const result = await adminApi<BangumiAdminState>('/api/admin/bangumi', 'PUT', { token: value });
      if (mounted.current) { setState(result); setToken(''); } notify('Access Token 已保存。');
    });
  }
  function clearToken() {
    void run('clear', async () => {
      const result = await adminApi<BangumiAdminState>('/api/admin/bangumi', 'PUT', { clearToken: true });
      if (mounted.current) { setState(result); setToken(''); } notify('Access Token 已删除。');
    });
  }
  function sync() {
    void run('sync', async () => {
      const result = await adminApi<BangumiAdminState>('/api/admin/bangumi/sync', 'POST');
      if (mounted.current) setState(result); notify(result.syncing ? '正在同步追番。' : `追番已同步，共 ${result.total} 部。`);
    });
  }
  function saveSettings(event: FormEvent) {
    event.preventDefault();
    void run('settings', async () => {
      const result = await adminApi<{ settings: SiteSettings }>('/api/admin/settings', 'PUT', draft);
      if (mounted.current) setDraft(result.settings); await refresh(); notify('追番页面设置已保存。');
    });
  }
  const disabled = busy !== null;
  return <>
    <div className="admin-heading"><div><h1>我的追番</h1></div><a href="/bangumi" target="_blank" rel="noopener noreferrer" className="admin-button admin-button-secondary">查看页面<ArrowUpRight size={17} /></a></div>
    {error && <p className="admin-inline-error" role="alert">{error}</p>}
    <div className="admin-settings-grid"><div className={styles.stack}>
      <form className="admin-card admin-form" onSubmit={saveToken}>
        <div className="admin-card-heading"><h2>Bangumi 账号</h2><KeyRound size={21} className="admin-accent" /></div>
        {loading && <p className={styles.loading}><LoaderCircle size={17} className="admin-spin" />读取连接状态…</p>}
        {loadError && <div><p className="admin-inline-error" role="alert">{loadError}</p><button className="admin-button admin-button-secondary" type="button" onClick={() => { setLoading(true); void load(); }} disabled={loading}>重新加载</button></div>}
        {state && <div className={styles.account} role="status"><p><strong>{state.tokenConfigured ? <><Check size={16} style={{ display: 'inline', verticalAlign: '-3px', marginRight: 6 }} />已连接</> : '尚未连接'}</strong>{state.account && <> · {state.account.nickname || state.account.username}</>}</p>{state.account && <p>账号：<a href={`https://bgm.tv/user/${encodeURIComponent(state.account.username || String(state.account.id))}`} target="_blank" rel="noopener noreferrer">{state.account.username || state.account.id}</a></p>}<p>{state.total} 部番剧<small>最近更新：{timeLabel(state.updatedAt)}</small></p>{state.syncing && <p className={styles.loading}><LoaderCircle size={16} className="admin-spin" />正在同步…</p>}{state.lastError && <p className={styles.danger}>上次同步：{state.lastError}</p>}</div>}
        <label>Access Token<input type="password" className={styles.secretInput} value={token} onChange={event => setToken(event.target.value)} autoComplete="new-password" spellCheck={false} maxLength={1024} placeholder={state?.tokenConfigured ? '已保存，填写新 Token 可替换' : '粘贴 Bangumi Access Token'} disabled={disabled || loading} /><small>仅保存在服务器，不会显示在公开页面。</small></label>
        <a className={`admin-text-button ${styles.credentialLink}`} href="https://next.bgm.tv/demo/access-token" target="_blank" rel="noopener noreferrer">创建 Access Token<ArrowUpRight size={15} /></a>
        <div className={styles.actions}><button type="submit" className="admin-button" disabled={disabled || loading || !token.trim()}>{busy === 'token' ? <LoaderCircle size={16} className="admin-spin" /> : <Save size={16} />}保存 Access Token</button><button type="button" className={`admin-button admin-button-secondary ${styles.danger}`} disabled={disabled || loading || !state?.tokenConfigured} onClick={clearToken}>{busy === 'clear' ? <LoaderCircle size={16} className="admin-spin" /> : <Trash2 size={16} />}删除 Access Token</button></div>
      </form>
      <form className="admin-card admin-form" onSubmit={saveSettings}>
        <h2>页面设置</h2><label className="admin-switch-label"><span><strong>显示我的追番</strong></span><input type="checkbox" role="switch" checked={draft.bangumiEnabled} onChange={event => setDraft(current => ({ ...current, bangumiEnabled: event.target.checked }))} disabled={disabled} /></label>
        <label>页面标题<input value={draft.bangumiTitle} maxLength={100} required onChange={event => setDraft(current => ({ ...current, bangumiTitle: event.target.value }))} disabled={disabled} /></label>
        <label>页面描述<textarea value={draft.bangumiDescription} maxLength={1000} rows={2} onChange={event => setDraft(current => ({ ...current, bangumiDescription: event.target.value }))} disabled={disabled} /></label>
        <label>默认分类<select value={String(draft.bangumiDefaultStatus)} onChange={event => setDraft(current => ({ ...current, bangumiDefaultStatus: event.target.value === 'all' ? 'all' : Number(event.target.value) as 1 | 2 | 3 | 4 | 5 }))} disabled={disabled}>{statuses.map(status => <option key={status.value} value={status.value}>{status.label}</option>)}</select></label>
        <div className={styles.inlineSave}><button type="submit" className="admin-button" disabled={disabled}>{busy === 'settings' ? <LoaderCircle size={16} className="admin-spin" /> : <Save size={16} />}保存页面设置</button></div>
      </form>
    </div><aside className={styles.stack}><section className="admin-card admin-form"><h2>收藏同步</h2><p className={styles.sectionNote}>同步 Bangumi 中的动画收藏与观看进度。</p><button type="button" className="admin-button admin-button-secondary" disabled={disabled || loading || !state?.tokenConfigured || state.syncing} onClick={sync}>{busy === 'sync' || state?.syncing ? <LoaderCircle size={17} className="admin-spin" /> : <RefreshCw size={17} />}{busy === 'sync' || state?.syncing ? '正在同步…' : '立即同步'}</button></section></aside></div>
  </>;
}
