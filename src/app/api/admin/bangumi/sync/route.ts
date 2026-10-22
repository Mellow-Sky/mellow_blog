import { assertSameOrigin, requireAdmin } from '@/lib/auth';
import { syncBangumi } from '@/lib/bangumi';
import { BangumiError } from '@/lib/bangumi-client';
import { apiError } from '@/lib/validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    assertSameOrigin(request); await requireAdmin();
    return Response.json(await syncBangumi(), { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return error instanceof BangumiError ? Response.json({ error: error.message }, { status: error.status, headers: { 'Cache-Control': 'no-store' } }) : apiError(error);
  }
}
