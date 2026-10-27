export async function adminApi<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const response = await fetch(path, {
    method,
    credentials: 'same-origin',
    cache: 'no-store',
    ...(body instanceof FormData ? { body } : body !== undefined ? {
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    } : {}),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || (response.status === 401 ? '登录已过期，请重新登录。' : '请求未成功，请稍后重试。'));
  return data as T;
}

export function dateLabel(timestamp: number) {
  return new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: 'short', day: 'numeric' }).format(timestamp < 1e12 ? timestamp * 1000 : timestamp);
}

export function sizeLabel(bytes: number) {
  return bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export type Notify = (message: string, error?: boolean) => void;

export function generatedSlug(value: string) {
  return value.toWellFormed().trim().toLowerCase().replace(/\s+/g, '-').replace(/[/?#\\\u0000-\u001f]/g, '').slice(0, 160).replace(/[\ud800-\udbff]$/, '') || `story-${Date.now()}`;
}
