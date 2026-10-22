import { z } from 'zod';
import { assertSameOrigin, requireAdmin } from '@/lib/auth';
import { getBangumiAdminState, saveBangumiToken } from '@/lib/bangumi';
import { BangumiError } from '@/lib/bangumi-client';
import { apiError, readJson } from '@/lib/validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'no-store' };
const inputSchema = z.object({ token: z.string().max(1024).optional(), clearToken: z.boolean().optional() }).strict();
function errorResponse(error: unknown) {
  return error instanceof BangumiError ? Response.json({ error: error.message }, { status: error.status, headers }) : apiError(error);
}

export async function GET() {
  try { await requireAdmin(); return Response.json(getBangumiAdminState(), { headers }); }
  catch (error) { return errorResponse(error); }
}

export async function PUT(request: Request) {
  try {
    assertSameOrigin(request); await requireAdmin();
    const input = inputSchema.parse(await readJson(request, 4096));
    return Response.json(await saveBangumiToken(input), { headers });
  } catch (error) { return errorResponse(error); }
}
