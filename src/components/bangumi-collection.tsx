'use client';

import Link from 'next/link';
import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { ArrowDownWideNarrow, ChevronDown, Film, LayoutGrid, List, RefreshCw, Search, Star, X } from 'lucide-react';
import type { BangumiCollection, BangumiCollectionType, BangumiSnapshot } from '@/lib/bangumi-types';
import { Reveal } from '@/components/motion';
import styles from '@/app/bangumi/bangumi.module.css';

type CollectionFilter = 'all' | BangumiCollectionType;
type CollectionSort = 'updated' | 'score' | 'year' | 'title';
const statuses: { value: CollectionFilter; label: string }[] = [
  { value: 'all', label: '全部' }, { value: 3, label: '在看' }, { value: 1, label: '想看' },
  { value: 2, label: '看过' }, { value: 4, label: '搁置' }, { value: 5, label: '抛弃' },
];
const pageSize = 60;
const titleOf = (item: BangumiCollection) => item.nameCn || item.name;
const yearOf = (item: BangumiCollection) => /^\d{4}/.exec(item.date)?.[0] || '';
const updatedOf = (item: BangumiCollection) => Date.parse(item.updatedAt) || 0;

async function request<T>(url: string, method = 'GET', body?: unknown): Promise<T> {
  const response = await fetch(url, {
    method, credentials: 'same-origin', cache: 'no-store',
    ...(body === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || (response.status === 401 ? '请重新登录后台' : '请求失败，请稍后重试'));
  return result as T;
}

function Poster({ item }: { item: BangumiCollection }) {
  const [failed, setFailed] = useState(false);
  const image = /^https:\/\//i.test(item.image) ? item.image : '';
  useEffect(() => { setFailed(false); }, [image]);
  return <a className={styles.poster} href={`https://bgm.tv/subject/${item.id}`} target="_blank" rel="noopener noreferrer" aria-label={`在 Bangumi 查看《${titleOf(item)}》`}>
    {image && !failed ? <img src={image} alt="" width={88} height={132} loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setFailed(true)} /> : <Film size={28} strokeWidth={1.4} aria-hidden />}
  </a>;
}

export function BangumiCollectionView({ initialSnapshot, canManage, title, description, defaultStatus = 3, syncLabel = '同步', syncingLabel = '同步中…' }: {
  initialSnapshot: BangumiSnapshot;
  canManage: boolean;
  title: string;
  description: string;
  defaultStatus?: CollectionFilter;
  syncLabel?: string;
  syncingLabel?: string;
}) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [filter, setFilter] = useState<CollectionFilter>(defaultStatus);
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query.trim().toLocaleLowerCase());
  const [sort, setSort] = useState<CollectionSort>('updated');
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [visible, setVisible] = useState(pageSize);
  const [pending, setPending] = useState<number | 'sync' | null>(null);
  const [feedback, setFeedback] = useState<{ text: string; error: boolean } | null>(null);
  const mutationLock = useRef(false);
  const reduced = useReducedMotion();

  useEffect(() => { setSnapshot(initialSnapshot); }, [initialSnapshot]);
  useEffect(() => { setFilter(defaultStatus); }, [defaultStatus]);
  useEffect(() => { setVisible(pageSize); }, [filter, deferredQuery, sort]);

  const counts = useMemo(() => snapshot.items.reduce<Record<string, number>>((result, item) => {
    result.all += 1; result[item.type] = (result[item.type] || 0) + 1; return result;
  }, { all: 0 }), [snapshot.items]);
  const filtered = useMemo(() => {
    const items = snapshot.items.filter(item => (filter === 'all' || item.type === filter) && (!deferredQuery || `${item.nameCn} ${item.name} ${yearOf(item)}`.toLocaleLowerCase().includes(deferredQuery)));
    return items.sort((a, b) => {
      if (sort === 'score') return b.score - a.score || updatedOf(b) - updatedOf(a);
      if (sort === 'year') return yearOf(b).localeCompare(yearOf(a)) || updatedOf(b) - updatedOf(a);
      if (sort === 'title') return titleOf(a).localeCompare(titleOf(b), 'zh-CN');
      return updatedOf(b) - updatedOf(a) || b.id - a.id;
    });
  }, [snapshot.items, filter, deferredQuery, sort]);

  async function sync() {
    if (mutationLock.current || !canManage) return;
    mutationLock.current = true; setPending('sync'); setFeedback(null);
    let synced = false;
    try {
      await request('/api/admin/bangumi/sync', 'POST');
      synced = true;
      const next = await request<BangumiSnapshot>('/api/bangumi');
      setSnapshot(next); setFeedback({ text: '已同步', error: false });
    } catch (error) {
      setFeedback({ text: synced ? '同步完成，请刷新页面查看' : error instanceof Error ? error.message : '同步失败，请稍后重试', error: true });
    } finally { mutationLock.current = false; setPending(null); }
  }

  async function changeStatus(item: BangumiCollection, type: BangumiCollectionType) {
    if (mutationLock.current || !canManage || item.type === type) return;
    mutationLock.current = true; setPending(item.id); setFeedback(null);
    try {
      const result = await request<{ item: BangumiCollection }>(`/api/admin/bangumi/collections/${item.id}`, 'PATCH', { type });
      setSnapshot(previous => ({ ...previous, items: previous.items.map(entry => entry.id === item.id ? result.item : entry) }));
      setFeedback({ text: `《${titleOf(item)}》已设为${statuses.find(status => status.value === type)?.label || ''}`, error: false });
    } catch (error) {
      setFeedback({ text: error instanceof Error ? error.message : '更新失败，请稍后重试', error: true });
    } finally { mutationLock.current = false; setPending(null); }
  }

  const hasCollection = snapshot.items.length > 0;
  return <div className={`page-container ${styles.page}`}>
    <Reveal><header className={styles.heading}>
      <div><h1>{title}</h1>{description && <p>{description}</p>}</div>
      {canManage && <button type="button" className={styles.sync} onClick={sync} disabled={pending !== null || !snapshot.configured} title={!snapshot.configured ? '请先在后台配置 Bangumi' : undefined}>
        <RefreshCw size={17} className={pending === 'sync' ? styles.spinning : ''} aria-hidden />{pending === 'sync' ? syncingLabel : syncLabel}
      </button>}
    </header></Reveal>

    <div className={styles.filtersRow}>
      <div className={styles.filters} role="group" aria-label="观看状态">{statuses.map(status => <button key={status.value} type="button" onClick={() => setFilter(status.value)} aria-pressed={filter === status.value} className={filter === status.value ? styles.activeFilter : ''}>
        {status.label}<span>{counts[status.value] || 0}</span>
      </button>)}</div>
      <span className={styles.resultCount} aria-live="polite" aria-atomic="true">{filtered.length} 部</span>
    </div>

    <div className={styles.toolbar}>
      <label className={styles.search}><Search size={19} aria-hidden /><span className={styles.srOnly}>搜索番剧</span><input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="搜索番剧" /></label>
      <div className={styles.displayControls}>
        <label className={styles.sort}><ArrowDownWideNarrow size={18} aria-hidden /><span className={styles.srOnly}>排序方式</span><select value={sort} onChange={event => setSort(event.target.value as CollectionSort)}>
          <option value="updated">最近变更</option><option value="score">评分最高</option><option value="year">最新年份</option><option value="title">标题排序</option>
        </select><ChevronDown size={15} aria-hidden /></label>
        <div className={styles.viewSwitch} role="group" aria-label="显示方式">
          <button type="button" className={view === 'grid' ? styles.activeView : ''} aria-label="卡片视图" aria-pressed={view === 'grid'} onClick={() => setView('grid')}><LayoutGrid size={19} aria-hidden /></button>
          <button type="button" className={view === 'list' ? styles.activeView : ''} aria-label="列表视图" aria-pressed={view === 'list'} onClick={() => setView('list')}><List size={20} aria-hidden /></button>
        </div>
      </div>
    </div>

    {feedback && <div className={`${styles.feedback} ${feedback.error ? styles.error : ''}`} role={feedback.error ? 'alert' : 'status'}><span>{feedback.text}</span><button type="button" onClick={() => setFeedback(null)} aria-label="关闭提示"><X size={17} aria-hidden /></button></div>}

    {filtered.length ? <>
      <ul className={`${styles.collection} ${view === 'list' ? styles.listView : ''}`} aria-label="番剧收藏">
        {filtered.slice(0, visible).map((item, index) => <motion.li key={item.id} className={styles.card} aria-busy={pending === item.id} initial={false} whileInView={reduced ? undefined : { opacity: [0.5, 1], y: [12, 0] }} viewport={{ once: true, amount: 0.1 }} transition={{ duration: 0.4, delay: Math.min(index, 8) * 0.025 }}>
          <Poster item={item} />
          <div className={styles.cardContent}>
            <h2><a href={`https://bgm.tv/subject/${item.id}`} target="_blank" rel="noopener noreferrer" title={titleOf(item)}>{titleOf(item)}</a></h2>
            <p className={styles.meta}><span>{yearOf(item) ? `${yearOf(item)} 年` : '年份未定'}</span><span aria-hidden>·</span><span className={styles.rating}><Star size={13} aria-hidden />{item.score > 0 ? `${item.score.toFixed(1)} 分` : '暂无评分'}</span></p>
            <div className={styles.cardBottom}>
              {canManage ? <label className={styles.statusSelect}><span className={styles.srOnly}>调整《{titleOf(item)}》的观看状态</span><select value={item.type} disabled={pending !== null} onChange={event => changeStatus(item, Number(event.target.value) as BangumiCollectionType)}>{statuses.filter(status => status.value !== 'all').map(status => <option key={status.value} value={status.value}>{status.label}</option>)}</select><ChevronDown size={15} aria-hidden /></label> : <span className={styles.status}>{statuses.find(status => status.value === item.type)?.label}</span>}
              {view === 'list' && item.watchedEpisodes > 0 && <span className={styles.progress}>{item.watchedEpisodes}{item.episodes > 0 ? ` / ${item.episodes}` : ''} 话</span>}
            </div>
          </div>
        </motion.li>)}
      </ul>
      {visible < filtered.length && <button type="button" className={styles.loadMore} onClick={() => setVisible(previous => previous + pageSize)}>加载更多<span>{filtered.length - visible} 部</span><ChevronDown size={17} aria-hidden /></button>}
    </> : <div className={styles.empty}>
      <Film size={38} strokeWidth={1.3} aria-hidden />
      <p>{!hasCollection ? '追番记录待更新' : deferredQuery ? '没有找到相关番剧' : '暂无此状态的番剧'}</p>
      {hasCollection ? <button type="button" onClick={() => { setQuery(''); setFilter('all'); }}>查看全部</button> : canManage && <Link href="/admin">前往后台配置</Link>}
    </div>}
    {snapshot.updatedAt && !Number.isNaN(Date.parse(snapshot.updatedAt)) && <p className={styles.updated}>最近同步 <time dateTime={snapshot.updatedAt}>{new Date(snapshot.updatedAt).toLocaleDateString('zh-CN', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' })}</time><span aria-hidden>·</span><a href="https://bgm.tv" target="_blank" rel="noopener noreferrer">Bangumi</a></p>}
  </div>;
}
