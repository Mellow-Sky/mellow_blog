import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { getBangumiSnapshot } from '@/lib/bangumi';
import { getSettings } from '@/lib/db';
import { BangumiCollectionView } from '@/components/bangumi-collection';

export const dynamic = 'force-dynamic';

export function generateMetadata(): Metadata {
  const settings = getSettings();
  return { title: settings.bangumiTitle, description: settings.bangumiDescription || undefined };
}

export default async function BangumiPage() {
  const settings = getSettings();
  if (!settings.bangumiEnabled) notFound();
  const session = await getSession();
  return <BangumiCollectionView
    initialSnapshot={getBangumiSnapshot()}
    canManage={Boolean(session)}
    title={settings.bangumiTitle}
    description={settings.bangumiDescription}
    defaultStatus={settings.bangumiDefaultStatus}
    syncLabel={settings.labels.bangumiSync}
    syncingLabel={settings.labels.bangumiSyncing}
  />;
}
