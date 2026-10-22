import { z } from 'zod';
import { assertSameOrigin, requireAdmin } from '@/lib/auth';
import { updateBangumiCollection } from '@/lib/bangumi';
import { BangumiError } from '@/lib/bangumi-client';
import type { BangumiCollectionType } from '@/lib/bangumi-types';
import { apiError, parseId, readJson } from '@/lib/validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ subjectId: string }> };
const inputSchema = z.object({ type: z.number().int().min(1).max(5) }).strict();

export async function PATCH(request: Request, context: Context) {
  try {
    assertSameOrigin(request); await requireAdmin();
    const { subjectId } = await context.params;
    const { type } = inputSchema.parse(await readJson(request, 256));
    const item = await updateBangumiCollection(parseId(subjectId), type as BangumiCollectionType);
    return Response.json({ item }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return error instanceof BangumiError ? Response.json({ error: error.message }, { status: error.status, headers: { 'Cache-Control': 'no-store' } }) : apiError(error);
  }
}
