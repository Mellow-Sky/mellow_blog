import { getBangumiSnapshot } from '@/lib/bangumi';
import { getSettings } from '@/lib/db';
import { apiError } from '@/lib/validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const snapshot = getSettings().bangumiEnabled === false ? { configured: false, items: [], updatedAt: null } : getBangumiSnapshot();
    return Response.json(snapshot, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return apiError(error); }
}
