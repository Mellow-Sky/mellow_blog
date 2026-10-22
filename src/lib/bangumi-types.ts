export type BangumiCollectionType = 1 | 2 | 3 | 4 | 5;

export interface BangumiCollection {
  id: number;
  name: string;
  nameCn: string;
  image: string;
  date: string;
  score: number;
  type: BangumiCollectionType;
  updatedAt: string;
  episodes: number;
  watchedEpisodes: number;
}

export interface BangumiSnapshot {
  configured: boolean;
  items: BangumiCollection[];
  updatedAt: string | null;
}

export interface BangumiAccount {
  id: number;
  username: string;
  nickname: string;
}

export interface BangumiAdminState {
  tokenConfigured: boolean;
  account: BangumiAccount | null;
  updatedAt: string | null;
  lastError: string | null;
  syncing: boolean;
  total: number;
}
