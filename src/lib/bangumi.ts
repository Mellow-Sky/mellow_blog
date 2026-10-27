import { getDb } from './db';
import { createBangumiService } from './bangumi-store';
import type { BangumiCollectionType } from './bangumi-types';

// This module is only imported by server pages and Route Handlers. Client UIs
// import DTO types from bangumi-types, never the credential/data layer.
const service = () => createBangumiService(getDb());
export const getBangumiSnapshot = () => service().snapshot();
export const getBangumiAdminState = () => service().adminState();
export const saveBangumiToken = (input: { token?: string; clearToken?: boolean }) => service().saveToken(input);
export const syncBangumi = () => service().sync();
export const syncBangumiIfDue = () => service().syncIfDue();
export const updateBangumiCollection = (subjectId: number, type: BangumiCollectionType) => service().updateCollection(subjectId, type);
