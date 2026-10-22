import test from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createBangumiService } from '../src/lib/bangumi-store';
import { bangumiImage, BangumiError, BANGUMI_USER_AGENT, parseBangumiCollection, requestBangumi, type BangumiFetch } from '../src/lib/bangumi-client';

const secret = 'qa-access-token-secret';
const me = { id: 42, username: 'demo', nickname: 'Demo', email: 'private@example.com', reg_time: '2020-01-01' };
const schema = readFileSync(path.join(process.cwd(), 'scripts/schema.sql'), 'utf8');
function database(filename = ':memory:') { const db = new Database(filename); db.exec(schema); return db; }
function collection(id = 1, extra: Record<string, unknown> = {}) {
  return {
    subject_id: id, subject_type: 2, type: 3, private: false, updated_at: '2026-01-02T03:04:05+08:00', ep_status: 3,
    subject: { id, type: 2, name: `Anime ${id}`, name_cn: `动画 ${id}`, eps: 12, date: '2026-01-01', score: 8.2, images: { medium: `https://lain.bgm.tv/pic/cover/m/${id}.jpg` } },
    ...extra,
  };
}
function json(value: unknown, status = 200) { return Response.json(value, { status }); }
function pages(records: unknown[], offset = 0) { return { total: records.length, limit: 50, offset, data: records.slice(offset, offset + 50) }; }
function fake(records: unknown[], observer?: (url: URL, init?: RequestInit) => Response | Promise<Response> | undefined): BangumiFetch {
  return async (input, init) => {
    const url = new URL(input);
    assert.equal(url.origin, 'https://api.bgm.tv');
    assert.equal(init?.redirect, 'error');
    assert.equal(init?.cache, 'no-store');
    assert.equal(new Headers(init?.headers).get('authorization'), `Bearer ${secret}`);
    assert.equal(new Headers(init?.headers).get('user-agent'), BANGUMI_USER_AGENT);
    const override = await observer?.(url, init);
    if (override) return override;
    if (url.pathname === '/v0/me') return json(me);
    assert.equal(url.searchParams.get('subject_type'), '2');
    assert.equal(url.searchParams.get('limit'), '50');
    return json(pages(records, Number(url.searchParams.get('offset'))));
  };
}

test('未配置Token时纯读状态与公共快照完全不访问网络', async () => {
  const db = database(); let calls = 0;
  try {
    const service = createBangumiService(db, { fetcher: async () => { calls++; throw new Error('must not fetch'); } });
    assert.deepEqual(service.snapshot(), { configured: false, items: [], updatedAt: null });
    assert.equal(service.adminState().tokenConfigured, false);
    assert.equal(service.adminState().syncing, false);
    await assert.rejects(service.sync(), /请先在后台填写/);
    assert.equal(calls, 0);
    assert.equal((db.prepare('SELECT count(*) AS n FROM integration_secrets').get() as { n: number }).n, 0);
  } finally { db.close(); }
});

test('Token验证后独立保存，安全状态不含Token或账号邮箱，空白保留', async () => {
  const db = database(); let calls = 0;
  try {
    const service = createBangumiService(db, { fetcher: fake([], () => { calls++; return undefined; }) });
    const state = await service.saveToken({ token: ` ${secret} ` });
    assert.equal(state.tokenConfigured, true);
    assert.deepEqual(state.account, { id: 42, username: 'demo', nickname: 'Demo' });
    assert.equal(state.total, 0);
    assert.equal(calls, 1);
    assert.equal(JSON.stringify(state).includes(secret), false);
    assert.equal(JSON.stringify(state).includes('private@example.com'), false);
    await service.saveToken({ token: '  ' });
    assert.equal(calls, 1);
    assert.equal((db.prepare('SELECT secret FROM integration_secrets WHERE provider=?').get('bangumi') as { secret: string }).secret, secret);
    assert.equal((db.prepare('SELECT count(*) AS n FROM settings').get() as { n: number }).n, 0);
  } finally { db.close(); }
});

test('完整翻页后只发布公开动画，缓存去掉原始API隐私字段', async () => {
  const records = Array.from({ length: 55 }, (_, i) => collection(i + 1));
  records[2] = collection(3, { private: true });
  records[3] = collection(4, { subject_type: 1 });
  records[4] = collection(5, { private: undefined });
  const offsets: number[] = []; const db = database();
  try {
    const service = createBangumiService(db, { fetcher: fake(records, url => { if (url.search) offsets.push(Number(url.searchParams.get('offset'))); return undefined; }) });
    await service.saveToken({ token: secret });
    await service.sync();
    assert.deepEqual(offsets, [0, 50]);
    const snapshot = service.snapshot();
    assert.equal(snapshot.items.length, 52);
    assert.ok(snapshot.updatedAt);
    assert.deepEqual(snapshot.items.find(v => v.id === 1), { id: 1, name: 'Anime 1', nameCn: '动画 1', image: 'https://lain.bgm.tv/pic/cover/m/1.jpg', date: '2026-01-01', score: 8.2, type: 3, updatedAt: '2026-01-01T19:04:05.000Z', episodes: 12, watchedEpisodes: 3 });
    assert.equal(JSON.stringify(snapshot).includes(secret), false);
    assert.equal(JSON.stringify(snapshot).includes('subject_type'), false);
    assert.equal(JSON.stringify(snapshot).includes('private'), false);
  } finally { db.close(); }
});

test('后续分页失败、总数变化或重复条目都保留上次完整快照', async () => {
  const records = Array.from({ length: 51 }, (_, i) => collection(i + 1));
  const db = database(); let mode = 'normal';
  try {
    const service = createBangumiService(db, { fetcher: fake(records, url => {
      if (url.searchParams.get('offset') !== '50') return;
      if (mode === 'error') return json({ message: secret }, 503);
      if (mode === 'count') return json({ ...pages(records, 50), total: 52 });
      if (mode === 'duplicate') return json({ ...pages(records, 50), data: [collection(1)] });
      return;
    }) });
    await service.saveToken({ token: secret }); await service.sync();
    const previous = service.snapshot();
    for (mode of ['error', 'count', 'duplicate']) {
      await assert.rejects(service.sync(), BangumiError);
      assert.deepEqual(service.snapshot(), previous);
      assert.ok(service.adminState().lastError);
      assert.equal(service.adminState().syncing, false);
      assert.equal(service.adminState().lastError?.includes(secret), false);
    }
  } finally { db.close(); }
});

test('失效Token不覆盖原有凭据与快照，远端错误正文不回传', async () => {
  const db = database(); let rejectToken = false;
  try {
    const fetcher: BangumiFetch = async (input, init) => {
      if (rejectToken) return json({ description: secret, token: 'replacement-secret' }, 401);
      return fake([collection()])(input, init);
    };
    const service = createBangumiService(db, { fetcher });
    await service.saveToken({ token: secret }); await service.sync();
    const previous = service.snapshot(); rejectToken = true;
    await assert.rejects(service.saveToken({ token: 'replacement-secret' }), /无效、已过期或权限不足/);
    assert.deepEqual(service.snapshot(), previous);
    assert.equal((db.prepare('SELECT secret FROM integration_secrets').get() as { secret: string }).secret, secret);
    assert.equal(JSON.stringify(service.adminState()).includes(secret), false);
    assert.equal(JSON.stringify(service.adminState()).includes('replacement-secret'), false);
  } finally { db.close(); }
});

test('更换Token会清除旧账号快照，显式清除删除凭据与缓存', async () => {
  const db = database(); let replacement = false;
  try {
    const service = createBangumiService(db, { fetcher: async (input, init) => replacement ? json({ ...me, id: 43, username: 'other' }) : fake([collection()])(input, init) });
    await service.saveToken({ token: secret }); await service.sync(); replacement = true;
    await service.saveToken({ token: 'another-token' });
    assert.deepEqual(service.snapshot(), { configured: true, items: [], updatedAt: null });
    assert.equal(service.adminState().account?.username, 'other');
    await service.saveToken({ clearToken: true });
    assert.deepEqual(service.snapshot(), { configured: false, items: [], updatedAt: null });
    assert.equal(service.adminState().account, null);
    assert.equal(service.adminState().lastError, null);
    assert.equal((db.prepare('SELECT count(*) AS n FROM integration_secrets').get() as { n: number }).n, 0);
  } finally { db.close(); }
});

test('持久锁阻止并发同步和Token替换，过期租约可以恢复', async () => {
  const db = database(); let resolveFetch!: (response: Response) => void; let hold = false; let time = 1000;
  try {
    const fetcher = fake([], url => hold && url.pathname === '/v0/me' ? new Promise<Response>(resolve => { resolveFetch = resolve; }) : undefined);
    const service = createBangumiService(db, { fetcher, now: () => time });
    await service.saveToken({ token: secret }); hold = true;
    const pending = service.sync();
    assert.equal(service.adminState().syncing, true);
    await assert.rejects(service.sync(), error => error instanceof BangumiError && error.status === 409);
    await assert.rejects(service.saveToken({ clearToken: true }), /正在更新/);
    hold = false; resolveFetch(json(me)); await pending;
    db.prepare('INSERT INTO integration_locks(provider,owner,expires_at) VALUES(?,?,?)').run('bangumi', 'crashed-process', time + 20);
    await assert.rejects(service.sync(), /正在更新/);
    time += 21; await service.sync();
    assert.equal(service.adminState().syncing, false);
  } finally { db.close(); }
});

test('修改收藏仅允许缓存中本人公开动画，使用官方PATCH且保留其他收藏', async () => {
  const db = database(); let patches = 0; let reads = 0;
  try {
    const service = createBangumiService(db, { fetcher: fake([collection(1), collection(2)], (url, init) => {
      if (url.pathname === '/v0/users/demo/collections/1') { reads++; return json(collection(1)); }
      if (url.pathname === '/v0/users/-/collections/1') { patches++; assert.equal(init?.method, 'PATCH'); assert.deepEqual(JSON.parse(init?.body as string), { type: 2 }); return new Response(null, { status: 204 }); }
      return;
    }) });
    await service.saveToken({ token: secret }); await service.sync();
    await assert.rejects(service.updateCollection(900, 2), /请先同步此收藏/);
    assert.equal(patches, 0); assert.equal(reads, 0);
    const item = await service.updateCollection(1, 2);
    assert.equal(item.type, 2); assert.equal(patches, 1); assert.equal(reads, 1);
    assert.equal(service.snapshot().items.find(v => v.id === 1)?.type, 2);
    assert.equal(service.snapshot().items.find(v => v.id === 2)?.type, 3);
  } finally { db.close(); }
});

test('远端收藏已设为私密时禁止修改并从公开缓存删除', async () => {
  const db = database(); let hidden = false; let patches = 0;
  try {
    const service = createBangumiService(db, { fetcher: fake([collection()], (url, init) => {
      if (url.pathname === '/v0/users/demo/collections/1') return json(collection(1, { private: hidden }));
      if (init?.method === 'PATCH') { patches++; return new Response(null, { status: 204 }); }
      return;
    }) });
    await service.saveToken({ token: secret }); await service.sync(); hidden = true;
    await assert.rejects(service.updateCollection(1, 2), /已隐藏/);
    assert.equal(patches, 0); assert.deepEqual(service.snapshot().items, []);
  } finally { db.close(); }
});

test('收藏写入失败不改变缓存；状态参数不可越界', async () => {
  const db = database();
  try {
    const service = createBangumiService(db, { fetcher: fake([collection()], (url, init) => {
      if (url.pathname === '/v0/users/demo/collections/1') return json(collection());
      if (init?.method === 'PATCH') return json({ error: secret }, 403);
      return;
    }) });
    await service.saveToken({ token: secret }); await service.sync(); const previous = service.snapshot();
    await assert.rejects(service.updateCollection(1, 2), /权限不足/);
    assert.deepEqual(service.snapshot(), previous);
    await assert.rejects(service.updateCollection(1, 6 as 2), /无效的收藏状态/);
    await assert.rejects(service.updateCollection(-1, 2), /无效的收藏状态/);
  } finally { db.close(); }
});

test('缓存与凭据重启后保留，读取不依赖远端服务', async () => {
  const temporary = mkdtempSync(path.join(tmpdir(), 'blog-bangumi-'));
  const filename = path.join(temporary, 'blog.db'); let db = database(filename);
  try {
    const service = createBangumiService(db, { fetcher: fake([collection()]) });
    await service.saveToken({ token: secret }); await service.sync(); const expected = service.snapshot();
    db.close(); db = database(filename);
    const reopened = createBangumiService(db, { fetcher: async () => { throw new Error('offline'); } });
    assert.deepEqual(reopened.snapshot(), expected);
    assert.equal(reopened.adminState().tokenConfigured, true);
  } finally { db.close(); rmSync(temporary, { recursive: true, force: true }); }
});

test('封面仅允许Bangumi可信HTTPS域，账号和收藏字段严格过滤', () => {
  for (const image of ['https://evil.example/cover.jpg', 'http://lain.bgm.tv/a.jpg', 'https://lain.bgm.tv.evil.example/a.jpg', 'https://user:pass@lain.bgm.tv/a.jpg', 'https://lain.bgm.tv:444/a.jpg', 'javascript:alert(1)', '//lain.bgm.tv/a.jpg']) assert.equal(bangumiImage(image), '');
  assert.equal(bangumiImage('https://lain.bgm.tv/a.jpg'), 'https://lain.bgm.tv/a.jpg');
  assert.equal(parseBangumiCollection(collection(1, { private: undefined })), null);
  assert.throws(() => parseBangumiCollection(collection(1, { subject: { ...collection().subject, score: Infinity } })), /评分无效/);
  assert.throws(() => parseBangumiCollection(collection(1, { subject: { ...collection().subject, id: 2 } })), /数据不完整/);
  assert.throws(() => parseBangumiCollection(collection(1, { updated_at: 'bad' })), /日期无效/);
});

test('请求失败、跳转和过大响应不会泄露Token，且超时可中止', async () => {
  await assert.rejects(requestBangumi('/v0/me', secret, {}, async () => { throw new Error(`network error ${secret}`); }), error => error instanceof BangumiError && !error.message.includes(secret));
  await assert.rejects(requestBangumi('/v0/me', secret, {}, async () => new Response(null, { status: 302, headers: { Location: 'https://evil.example' } })), /暂时无法访问/);
  await assert.rejects(requestBangumi('/v0/me', secret, {}, async () => new Response('a'.repeat(1_500_001))), /数据过大/);
  await assert.rejects(requestBangumi('/v0/me', secret, { signal: AbortSignal.abort() }, async (_url, init) => { init?.signal?.throwIfAborted(); return json(me); }), /连接超时/);
});
