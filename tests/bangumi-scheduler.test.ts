import test from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { BANGUMI_SYNC_INTERVAL_MS, BANGUMI_SYNC_RETRY_MS, createBangumiService } from '../src/lib/bangumi-store';
import type { BangumiFetch } from '../src/lib/bangumi-client';

const schema = readFileSync(path.join(process.cwd(), 'scripts/schema.sql'), 'utf8');
const initialTime = Date.parse('2026-01-01T00:00:00Z');
const secret = 'scheduler-test-token';
const account = { id: 42, username: 'demo', nickname: 'Demo' };
const record = {
  subject_id: 1, subject_type: 2, type: 3, private: false, updated_at: '2026-01-01T00:00:00Z', ep_status: 2,
  subject: { id: 1, type: 2, name: 'Sample', name_cn: '示例动画', eps: 12, date: '2026-01-01', score: 8, images: {} },
};
function database(filename = ':memory:') { const db = new Database(filename); db.exec(schema); return db; }
function fixture(db: Database.Database) {
  const state = { time: initialTime, calls: 0, syncs: 0, failed: false };
  const fetcher: BangumiFetch = async (input, init) => {
    state.calls++;
    const url = new URL(input);
    if (state.failed) return Response.json({ error: 'unavailable' }, { status: 503 });
    if (url.pathname === '/v0/me') return Response.json(account);
    if (init?.method === 'PATCH') return new Response(null, { status: 204 });
    if (url.pathname.endsWith('/collections/1')) return Response.json(record);
    state.syncs++;
    return Response.json({ total: 1, limit: 50, offset: 0, data: [record] });
  };
  const options = { fetcher, now: () => state.time };
  return { state, options, service: createBangumiService(db, options) };
}
function iso(time: number) { return new Date(time).toISOString(); }

test('未连接账号时自动任务不访问网络，不创建同步计划', async () => {
  const db = database();
  try {
    const { service, state } = fixture(db);
    assert.equal(await service.syncIfDue(), null);
    assert.equal(service.adminState().nextSyncAt, null);
    assert.equal(state.calls, 0);
    assert.equal((db.prepare('SELECT count(*) AS n FROM integration_schedules').get() as { n: number }).n, 0);
  } finally { db.close(); }
});

test('配置Token后首次自动同步，七天到期前不请求，到期自动更新', async () => {
  const db = database();
  try {
    const { service, state } = fixture(db);
    assert.equal(BANGUMI_SYNC_INTERVAL_MS, 7 * 24 * 60 * 60 * 1000);
    await service.saveToken({ token: secret });
    assert.equal(service.adminState().nextSyncAt, iso(initialTime));
    assert.ok(await service.syncIfDue());
    assert.equal(service.snapshot().items.length, 1);
    assert.equal(service.adminState().nextSyncAt, iso(initialTime + BANGUMI_SYNC_INTERVAL_MS));
    const calls = state.calls;
    state.time += BANGUMI_SYNC_INTERVAL_MS - 1;
    assert.equal(await service.syncIfDue(), null);
    assert.equal(state.calls, calls);
    state.time++;
    assert.ok(await service.syncIfDue());
    assert.equal(state.syncs, 2);
    assert.equal(service.snapshot().updatedAt, iso(state.time));
    assert.equal(service.adminState().nextSyncAt, iso(state.time + BANGUMI_SYNC_INTERVAL_MS));
  } finally { db.close(); }
});

test('重启保留原定同步时间，服务停机错过的任务会在下次检查补齐', async () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'blog-weekly-'));
  const filename = path.join(directory, 'blog.db');
  let db = database(filename);
  try {
    const first = fixture(db);
    await first.service.saveToken({ token: secret });
    await first.service.syncIfDue();
    const next = first.service.adminState().nextSyncAt;
    db.close(); db = database(filename);
    const restarted = fixture(db);
    restarted.state.time = initialTime + BANGUMI_SYNC_INTERVAL_MS - 1;
    assert.equal(restarted.service.adminState().nextSyncAt, next);
    assert.equal(await restarted.service.syncIfDue(), null);
    assert.equal(restarted.state.calls, 0);
    restarted.state.time += 2 * BANGUMI_SYNC_INTERVAL_MS;
    assert.ok(await restarted.service.syncIfDue());
    assert.equal(restarted.state.syncs, 1);
    assert.equal(restarted.service.adminState().nextSyncAt, iso(restarted.state.time + BANGUMI_SYNC_INTERVAL_MS));
  } finally { db.close(); rmSync(directory, { recursive: true, force: true }); }
});

test('升级前已有快照且尚无计划时沿用完整同步时间，不强制重新抓取', async () => {
  const db = database();
  try {
    const { service, state } = fixture(db);
    await service.saveToken({ token: secret }); await service.sync();
    db.prepare('DELETE FROM integration_schedules WHERE provider=?').run('bangumi');
    state.time += BANGUMI_SYNC_INTERVAL_MS - 1;
    const calls = state.calls;
    assert.equal(service.adminState().nextSyncAt, iso(initialTime + BANGUMI_SYNC_INTERVAL_MS));
    assert.equal(await service.syncIfDue(), null);
    assert.equal(state.calls, calls);
    state.time++;
    assert.ok(await service.syncIfDue());
    assert.equal(state.syncs, 2);
  } finally { db.close(); }
});

test('自动同步失败保留公开快照并一小时后重试，重试成功恢复七天周期', async () => {
  const db = database();
  try {
    const { service, state } = fixture(db);
    assert.equal(BANGUMI_SYNC_RETRY_MS, 60 * 60 * 1000);
    await service.saveToken({ token: secret }); await service.syncIfDue();
    const previous = service.snapshot();
    state.time += BANGUMI_SYNC_INTERVAL_MS; state.failed = true;
    await assert.rejects(service.syncIfDue());
    assert.deepEqual(service.snapshot(), previous);
    assert.ok(service.adminState().lastError);
    assert.equal(service.adminState().syncing, false);
    assert.equal(service.adminState().nextSyncAt, iso(state.time + BANGUMI_SYNC_RETRY_MS));
    const calls = state.calls;
    state.time += BANGUMI_SYNC_RETRY_MS - 1;
    assert.equal(await service.syncIfDue(), null);
    assert.equal(state.calls, calls);
    state.time++; state.failed = false;
    assert.ok(await service.syncIfDue());
    assert.equal(service.adminState().lastError, null);
    assert.equal(service.adminState().nextSyncAt, iso(state.time + BANGUMI_SYNC_INTERVAL_MS));
  } finally { db.close(); }
});

test('手动同步成功重新计算七天，手动失败不延后已安排的任务', async () => {
  const db = database();
  try {
    const { service, state } = fixture(db);
    await service.saveToken({ token: secret }); await service.syncIfDue();
    state.time += 24 * 60 * 60 * 1000;
    await service.sync();
    const next = iso(state.time + BANGUMI_SYNC_INTERVAL_MS);
    assert.equal(service.adminState().nextSyncAt, next);
    state.time += 1000; state.failed = true;
    await assert.rejects(service.sync());
    assert.equal(service.adminState().nextSyncAt, next);
  } finally { db.close(); }
});

test('更新单条收藏与保留相同Token不会推迟每周完整同步', async () => {
  const db = database();
  try {
    const { service, state } = fixture(db);
    await service.saveToken({ token: secret }); await service.syncIfDue();
    const next = service.adminState().nextSyncAt;
    state.time += BANGUMI_SYNC_INTERVAL_MS - 1;
    await service.updateCollection(1, 2);
    assert.equal(service.snapshot().items[0].type, 2);
    assert.equal(service.adminState().nextSyncAt, next);
    await service.saveToken({ token: secret });
    assert.equal(service.adminState().nextSyncAt, next);
    state.time++;
    assert.ok(await service.syncIfDue());
  } finally { db.close(); }
});

test('更换Token重新安排首次同步，删除Token取消计划和后续请求', async () => {
  const db = database();
  try {
    const { service, state } = fixture(db);
    await service.saveToken({ token: secret }); await service.syncIfDue();
    state.time += 1000;
    await service.saveToken({ token: 'replacement-test-token' });
    assert.equal(service.adminState().nextSyncAt, iso(state.time));
    assert.deepEqual(service.snapshot().items, []);
    await service.syncIfDue();
    await service.saveToken({ clearToken: true });
    assert.equal(service.adminState().nextSyncAt, null);
    const calls = state.calls;
    state.time += BANGUMI_SYNC_INTERVAL_MS;
    assert.equal(await service.syncIfDue(), null);
    assert.equal(state.calls, calls);
    assert.equal((db.prepare('SELECT count(*) AS n FROM integration_schedules').get() as { n: number }).n, 0);
  } finally { db.close(); }
});

test('两个服务实例同时到期时只有一个抓取，过期租约恢复后不会漏掉任务', async () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'blog-weekly-lock-'));
  const filename = path.join(directory, 'blog.db');
  const firstDb = database(filename); const secondDb = database(filename);
  let release: (() => void) | undefined;
  try {
    const f = fixture(firstDb);
    await f.service.saveToken({ token: secret });
    const fetcher: BangumiFetch = async (input, init) => {
      if (new URL(input).pathname === '/v0/me') await new Promise<void>(resolve => { release = resolve; });
      return f.options.fetcher(input, init);
    };
    const first = createBangumiService(firstDb, { ...f.options, fetcher });
    const second = createBangumiService(secondDb, f.options);
    const pending = first.syncIfDue();
    assert.equal(first.adminState().syncing, true);
    assert.equal(await second.syncIfDue(), null);
    assert.equal(f.state.syncs, 0);
    release!(); release = undefined; await pending;
    assert.equal(await second.syncIfDue(), null);
    assert.equal(f.state.syncs, 1);
    f.state.time += BANGUMI_SYNC_INTERVAL_MS;
    firstDb.prepare('INSERT INTO integration_locks(provider,owner,expires_at) VALUES(?,?,?)').run('bangumi', 'terminated-worker', f.state.time + 1);
    assert.equal(await second.syncIfDue(), null);
    f.state.time++;
    assert.ok(await second.syncIfDue());
    assert.equal(f.state.syncs, 2);
  } finally {
    release?.(); firstDb.close(); secondDb.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
