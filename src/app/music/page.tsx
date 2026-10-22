import { ArrowUpRight, Headphones } from 'lucide-react';
import type { Metadata } from 'next';
import { getSettings } from '@/lib/db';
import { spotifyOpenUrl } from '@/lib/spotify';
import { OpenMusicButton } from '@/components/music-player';
import { Reveal } from '@/components/motion';
import styles from '@/components/spotify-player.module.css';

export function generateMetadata(): Metadata { return { title: getSettings().labels.musicTitle, description: '我的歌单。' }; }
export const dynamic = 'force-dynamic';

export default function Music() {
  const settings = getSettings();
  const url = spotifyOpenUrl(settings.spotifyUri || '');
  return <div className="page-container music-page">
    <Reveal><header className="page-heading"><h1>{settings.labels.musicTitle}</h1></header></Reveal>
    <Reveal><section className={styles.room} aria-label="我的歌单">
      <div className={styles.roomTitle}><span className={styles.roomIcon} aria-hidden><Headphones size={30} /></span><div><p>Spotify</p><h2>{settings.author} 的歌单</h2></div></div>
      {settings.musicEnabled && url ? <div className={styles.roomActions}><OpenMusicButton label={settings.labels.musicOpen} /><a href={url} target="_blank" rel="noopener noreferrer">在 Spotify 打开<ArrowUpRight size={16} aria-hidden /></a></div> : <p className={styles.roomEmpty}>{settings.musicEnabled ? '歌单待更新' : '音乐暂未开启'}</p>}
    </section></Reveal>
  </div>;
}
