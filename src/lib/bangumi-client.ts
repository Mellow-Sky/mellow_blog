import type { BangumiAccount, BangumiCollection, BangumiCollectionType } from './bangumi-types';

const API_ORIGIN = 'https://api.bgm.tv';
export const BANGUMI_USER_AGENT = 'BlogFramework/1.0.0';
export const BANGUMI_PAGE_SIZE = 50;
export const BANGUMI_MAX_ITEMS = 10_000;
const MAX_RESPONSE_BYTES = 1_500_000;

export class BangumiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export type BangumiFetch = (input: string | URL, init?: RequestInit) => Promise<Response>;
type JsonObject = Record<string, unknown>;
function object(value: unknown): JsonObject {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new BangumiError(502, 'Bangumi 返回的数据不完整，请稍后重试');
  return value as JsonObject;
}
function integer(value: unknown, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < min || value > max) throw new BangumiError(502, 'Bangumi 返回的数据不完整，请稍后重试');
  return value;
}
function text(value: unknown, maximum: number): string {
  if (typeof value !== 'string' || value.length > maximum) throw new BangumiError(502, 'Bangumi 返回的数据不完整，请稍后重试');
  return value;
}
export function validateBangumiToken(value: string): string {
  const token = value.trim();
  if (!token || token.length > 1024 || !/^[\x21-\x7e]+$/.test(token)) throw new BangumiError(400, 'Access Token 格式无效');
  return token;
}

export function bangumiImage(value: unknown): string {
  if (typeof value !== 'string' || value.length > 2048) return '';
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === 'lain.bgm.tv' && !url.username && !url.password && !url.port ? url.href : '';
  } catch { return ''; }
}

export function parseBangumiAccount(value: unknown): BangumiAccount {
  const account = object(value);
  const username = text(account.username, 100);
  if (!username || /[\u0000-\u001f\u007f/\\?#]/.test(username)) throw new BangumiError(502, 'Bangumi 账号信息不完整');
  return { id: integer(account.id, 1, Number.MAX_SAFE_INTEGER), username, nickname: text(account.nickname, 200) };
}

export function parseBangumiCollection(value: unknown): BangumiCollection | null {
  const record = object(value);
  // Missing visibility is never treated as public.
  if (record.private !== false || record.subject_type !== 2) return null;
  const subject = object(record.subject);
  if (subject.type !== 2) return null;
  const id = integer(record.subject_id, 1, Number.MAX_SAFE_INTEGER);
  if (subject.id !== id) throw new BangumiError(502, 'Bangumi 返回的数据不完整，请稍后重试');
  const date = subject.date == null ? '' : text(subject.date, 10);
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new BangumiError(502, 'Bangumi 返回的日期无效');
  const updatedAt = text(record.updated_at, 80);
  if (!Number.isFinite(Date.parse(updatedAt))) throw new BangumiError(502, 'Bangumi 返回的日期无效');
  const score = subject.score;
  if (typeof score !== 'number' || !Number.isFinite(score) || score < 0 || score > 10) throw new BangumiError(502, 'Bangumi 返回的评分无效');
  const images = subject.images && typeof subject.images === 'object' ? subject.images as JsonObject : {};
  return {
    id, name: text(subject.name, 1000), nameCn: text(subject.name_cn, 1000),
    image: bangumiImage(images.medium || images.common || images.large || images.small),
    date, score, type: integer(record.type, 1, 5) as BangumiCollectionType,
    updatedAt: new Date(updatedAt).toISOString(), episodes: integer(subject.eps, 0, 1_000_000),
    watchedEpisodes: integer(record.ep_status, 0, 1_000_000),
  };
}

export function parseBangumiPage(value: unknown, offset: number): { total: number; records: unknown[] } {
  const page = object(value);
  const total = integer(page.total, 0, BANGUMI_MAX_ITEMS);
  integer(page.limit, 1, BANGUMI_PAGE_SIZE);
  if (page.offset !== offset || !Array.isArray(page.data) || page.data.length > BANGUMI_PAGE_SIZE || page.data.length > total - offset) throw new BangumiError(502, 'Bangumi 分页数据不完整，请重新同步');
  if (offset < total && page.data.length === 0) throw new BangumiError(502, 'Bangumi 分页数据不完整，请重新同步');
  return { total, records: page.data };
}

export async function requestBangumi(
  pathname: string, token: string, options: { method?: 'GET' | 'PATCH'; body?: object; signal?: AbortSignal } = {},
  fetcher: BangumiFetch = fetch,
): Promise<unknown> {
  if (!pathname.startsWith('/v0/') || pathname.startsWith('//')) throw new BangumiError(400, '无效的 Bangumi 请求');
  const timeout = AbortSignal.timeout(12_000);
  const signal = options.signal ? AbortSignal.any([timeout, options.signal]) : timeout;
  try {
    const response = await fetcher(new URL(pathname, API_ORIGIN), {
      method: options.method || 'GET', redirect: 'error', cache: 'no-store', signal,
      headers: { Authorization: `Bearer ${token}`, 'User-Agent': BANGUMI_USER_AGENT, Accept: 'application/json', ...(options.body ? { 'Content-Type': 'application/json' } : {}) },
      ...(options.body ? { body: JSON.stringify(options.body) } : {}),
    });
    if (response.status === 401 || response.status === 403) throw new BangumiError(400, 'Access Token 无效、已过期或权限不足');
    if (response.status === 429) throw new BangumiError(429, 'Bangumi 请求过于频繁，请稍后重试');
    if (response.status === 404) throw new BangumiError(404, 'Bangumi 账号或收藏不存在');
    if (!response.ok) throw new BangumiError(502, 'Bangumi 暂时无法访问，请稍后重试');
    if (response.status === 204) return null;
    const reader = response.body?.getReader();
    if (!reader) throw new BangumiError(502, 'Bangumi 返回的数据不完整，请稍后重试');
    let size = 0;
    const chunks: Uint8Array[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_RESPONSE_BYTES) { await reader.cancel(); throw new BangumiError(502, 'Bangumi 返回的数据过大，请稍后重试'); }
      chunks.push(value);
    }
    try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
    catch { throw new BangumiError(502, 'Bangumi 返回的数据不完整，请稍后重试'); }
  } catch (error) {
    if (error instanceof BangumiError) throw error;
    if (signal.aborted) throw new BangumiError(504, 'Bangumi 连接超时，请稍后重试');
    throw new BangumiError(502, '无法连接 Bangumi，请稍后重试');
  }
}
