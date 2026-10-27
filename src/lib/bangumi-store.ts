import { randomUUID } from 'node:crypto';
import type Database from 'better-sqlite3';
import type { BangumiAccount, BangumiAdminState, BangumiCollection, BangumiCollectionType, BangumiSnapshot } from './bangumi-types';
import { bangumiImage, BangumiError, BANGUMI_MAX_ITEMS, BANGUMI_PAGE_SIZE, parseBangumiAccount, parseBangumiCollection, parseBangumiPage, requestBangumi, validateBangumiToken, type BangumiFetch } from './bangumi-client';

interface StateRow { account_json: string | null; items_json: string; synced_at: string | null; last_error: string | null }
interface Options { fetcher?: BangumiFetch; now?: () => number }
const PROVIDER = 'bangumi';
const LEASE_MILLISECONDS = 120_000;
export const BANGUMI_SYNC_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;
export const BANGUMI_SYNC_RETRY_MS = 60 * 60 * 1000;

/** Server data layer. Tokens never leave this closure through the returned API. */
export function createBangumiService(db: Database.Database, options: Options = {}) {
  const now = options.now || Date.now;
  const remote = options.fetcher || fetch;
  const empty: StateRow = { account_json: null, items_json: '[]', synced_at: null, last_error: null };
  function token() { return (db.prepare('SELECT secret FROM integration_secrets WHERE provider=?').get(PROVIDER) as { secret: string } | undefined)?.secret || ''; }
  function row() { return (db.prepare('SELECT account_json,items_json,synced_at,last_error FROM bangumi_state WHERE id=1').get() as StateRow | undefined) || empty; }
  function ensureRow() { db.prepare('INSERT OR IGNORE INTO bangumi_state(id) VALUES(1)').run(); }
  function nextSyncTime(state = row()) {
    const scheduled = db.prepare('SELECT next_run_at FROM integration_schedules WHERE provider=?').get(PROVIDER) as { next_run_at: number } | undefined;
    if (scheduled) return scheduled.next_run_at;
    const synced = state.synced_at ? Date.parse(state.synced_at) : NaN;
    return Number.isFinite(synced) ? synced + BANGUMI_SYNC_INTERVAL_MS : now();
  }
  function schedule(timestamp: number) {
    db.prepare('INSERT INTO integration_schedules(provider,next_run_at) VALUES(?,?) ON CONFLICT(provider) DO UPDATE SET next_run_at=excluded.next_run_at').run(PROVIDER, timestamp);
  }
  function account(state: StateRow): BangumiAccount | null {
    if (!state.account_json) return null;
    try { return parseBangumiAccount(JSON.parse(state.account_json)); } catch { return null; }
  }
  function items(state: StateRow): BangumiCollection[] {
    try {
      const parsed: unknown = JSON.parse(state.items_json);
      if (!Array.isArray(parsed) || parsed.length > BANGUMI_MAX_ITEMS) return [];
      return parsed.filter((v): v is BangumiCollection => !!v && typeof v === 'object' && Number.isSafeInteger(v.id) && v.id > 0 && [1, 2, 3, 4, 5].includes(v.type) && typeof v.name === 'string' && typeof v.nameCn === 'string' && typeof v.image === 'string' && typeof v.date === 'string' && typeof v.updatedAt === 'string' && typeof v.score === 'number' && Number.isFinite(v.score) && v.score >= 0 && v.score <= 10 && Number.isSafeInteger(v.episodes) && v.episodes >= 0 && Number.isSafeInteger(v.watchedEpisodes) && v.watchedEpisodes >= 0)
        .map(v => ({ id: v.id, name: v.name, nameCn: v.nameCn, image: bangumiImage(v.image), date: v.date, score: v.score, type: v.type, updatedAt: v.updatedAt, episodes: v.episodes, watchedEpisodes: v.watchedEpisodes }));
    } catch { return []; }
  }
  function snapshot(): BangumiSnapshot {
    const state = row();
    const configured = !!token();
    return { configured, items: configured ? items(state) : [], updatedAt: configured ? state.synced_at : null };
  }
  function adminState(): BangumiAdminState {
    const state = row();
    return {
      tokenConfigured: !!token(), account: account(state), updatedAt: state.synced_at,
      lastError: state.last_error, total: items(state).length,
      nextSyncAt: token() ? new Date(nextSyncTime(state)).toISOString() : null,
      syncing: !!db.prepare('SELECT provider FROM integration_locks WHERE provider=? AND expires_at>?').get(PROVIDER, now()),
    };
  }
  async function locked<T>(operation: () => Promise<T>): Promise<T> {
    const owner = randomUUID();
    const lock = db.prepare('INSERT INTO integration_locks(provider,owner,expires_at) VALUES(?,?,?) ON CONFLICT(provider) DO UPDATE SET owner=excluded.owner,expires_at=excluded.expires_at WHERE integration_locks.expires_at<=?').run(PROVIDER, owner, now() + LEASE_MILLISECONDS, now());
    if (!lock.changes) throw new BangumiError(409, '追番数据正在更新，请稍后重试');
    ensureRow();
    try { return await operation(); }
    catch (error) {
      const safe = error instanceof BangumiError ? error : new BangumiError(500, '追番数据处理失败，请稍后重试');
      db.prepare('UPDATE bangumi_state SET last_error=? WHERE id=1').run(safe.message);
      throw safe;
    } finally { db.prepare('DELETE FROM integration_locks WHERE provider=? AND owner=?').run(PROVIDER, owner); }
  }
  async function saveToken(input: { token?: string; clearToken?: boolean }): Promise<BangumiAdminState> {
    if (input.clearToken && input.token?.trim()) throw new BangumiError(400, '清除与更新 Token 不能同时进行');
    if (!input.clearToken && !input.token?.trim()) return adminState();
    await locked(async () => {
      if (input.clearToken) {
        db.transaction(() => {
          db.prepare('DELETE FROM integration_secrets WHERE provider=?').run(PROVIDER);
          db.prepare('DELETE FROM integration_schedules WHERE provider=?').run(PROVIDER);
          db.prepare("UPDATE bangumi_state SET account_json=NULL,items_json='[]',synced_at=NULL,last_error=NULL WHERE id=1").run();
        })();
        return;
      }
      const replacement = validateBangumiToken(input.token!);
      const verified = parseBangumiAccount(await requestBangumi('/v0/me', replacement, {}, remote));
      db.transaction(() => {
        const previous = token();
        db.prepare('INSERT INTO integration_secrets(provider,secret) VALUES(?,?) ON CONFLICT(provider) DO UPDATE SET secret=excluded.secret').run(PROVIDER, replacement);
        if (previous !== replacement || account(row())?.id !== verified.id) {
          db.prepare("UPDATE bangumi_state SET items_json='[]',synced_at=NULL WHERE id=1").run();
          schedule(now());
        }
        db.prepare('UPDATE bangumi_state SET account_json=?,last_error=NULL WHERE id=1').run(JSON.stringify(verified));
      })();
    });
    return adminState();
  }
  async function syncCollection() {
      const secret = token();
      if (!secret) throw new BangumiError(400, '请先在后台填写 Access Token');
      const signal = AbortSignal.timeout(90_000);
      const verified = parseBangumiAccount(await requestBangumi('/v0/me', secret, { signal }, remote));
      const collected: BangumiCollection[] = [];
      const seen = new Set<number>();
      let offset = 0;
      let total: number | null = null;
      do {
        const path = `/v0/users/${encodeURIComponent(verified.username)}/collections?subject_type=2&limit=${BANGUMI_PAGE_SIZE}&offset=${offset}`;
        const page = parseBangumiPage(await requestBangumi(path, secret, { signal }, remote), offset);
        if (total !== null && page.total !== total) throw new BangumiError(502, 'Bangumi 收藏正在变化，请重新同步');
        total = page.total;
        for (const record of page.records) {
          const item = parseBangumiCollection(record);
          if (!item) continue;
          if (seen.has(item.id)) throw new BangumiError(502, 'Bangumi 分页数据有重复，请重新同步');
          seen.add(item.id);
          collected.push(item);
        }
        offset += page.records.length;
      } while (offset < total);
      collected.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || b.id - a.id);
      db.transaction(() => {
        db.prepare('UPDATE bangumi_state SET account_json=?,items_json=?,synced_at=?,last_error=NULL WHERE id=1').run(JSON.stringify(verified), JSON.stringify(collected), new Date(now()).toISOString());
        schedule(now() + BANGUMI_SYNC_INTERVAL_MS);
      })();
  }
  async function sync(): Promise<BangumiAdminState> {
    await locked(syncCollection);
    return adminState();
  }
  async function syncIfDue(): Promise<BangumiAdminState | null> {
    if (!token() || nextSyncTime() > now()) return null;
    let synced = false;
    try {
      await locked(async () => {
        // The lease serializes automatic/manual sync and credential changes across processes.
        if (!token() || nextSyncTime() > now()) return;
        try { await syncCollection(); synced = true; }
        catch (error) { schedule(now() + BANGUMI_SYNC_RETRY_MS); throw error; }
      });
    } catch (error) {
      if (error instanceof BangumiError && error.status === 409) return null;
      throw error;
    }
    return synced ? adminState() : null;
  }
  async function updateCollection(subjectId: number, type: BangumiCollectionType): Promise<BangumiCollection> {
    if (!Number.isSafeInteger(subjectId) || subjectId < 1 || ![1, 2, 3, 4, 5].includes(type)) throw new BangumiError(400, '无效的收藏状态');
    return locked(async () => {
      const secret = token();
      const state = row();
      const owner = account(state);
      if (!secret || !owner) throw new BangumiError(400, '请先配置并同步 Bangumi');
      const cached = items(state);
      if (!cached.some(v => v.id === subjectId)) throw new BangumiError(404, '请先同步此收藏');
      const current = parseBangumiCollection(await requestBangumi(`/v0/users/${encodeURIComponent(owner.username)}/collections/${subjectId}`, secret, {}, remote));
      if (!current || current.id !== subjectId) {
        db.prepare('UPDATE bangumi_state SET items_json=? WHERE id=1').run(JSON.stringify(cached.filter(v => v.id !== subjectId)));
        throw new BangumiError(409, '此收藏已隐藏或不再可用，请重新同步');
      }
      await requestBangumi(`/v0/users/-/collections/${subjectId}`, secret, { method: 'PATCH', body: { type } }, remote);
      const item: BangumiCollection = { ...current, type, updatedAt: new Date(now()).toISOString() };
      db.prepare('UPDATE bangumi_state SET items_json=?,last_error=NULL WHERE id=1').run(JSON.stringify(cached.map(v => v.id === subjectId ? item : v)));
      return item;
    });
  }
  return { snapshot, adminState, saveToken, sync, syncIfDue, updateCollection };
}
