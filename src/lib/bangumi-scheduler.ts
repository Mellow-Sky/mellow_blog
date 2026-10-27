import { syncBangumiIfDue } from './bangumi';

export const BANGUMI_SYNC_CHECK_MS = 60_000;

// A self-scheduling loop never overlaps its own previous check. The SQLite
// lease and persisted due date also coordinate separate server processes.
export function startBangumiSyncLoop(check: () => Promise<unknown> = syncBangumiIfDue) {
  let stopped = false;
  let timer: ReturnType<typeof setTimeout>;
  async function tick() {
    try { await check(); }
    catch { console.error('Bangumi 自动同步失败，已保留缓存；请在后台查看同步状态。'); }
    finally {
      if (!stopped) {
        timer = setTimeout(tick, BANGUMI_SYNC_CHECK_MS);
        timer.unref();
      }
    }
  }
  timer = setTimeout(tick, 0);
  timer.unref();
  return () => { stopped = true; clearTimeout(timer); };
}

const scheduler = globalThis as typeof globalThis & { __blogBangumiScheduler?: () => void };
export function startBangumiScheduler() {
  scheduler.__blogBangumiScheduler ??= startBangumiSyncLoop();
}
