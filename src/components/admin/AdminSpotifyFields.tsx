'use client';

import { ArrowUpRight, Music2 } from 'lucide-react';
import { normalizeSpotifyUri, spotifyOpenUrl } from '@/lib/spotify';
import type { SiteSettings } from '@/lib/types';

export default function AdminSpotifyFields({ draft, onChange }: { draft: SiteSettings; onChange: <K extends keyof SiteSettings>(key: K, value: SiteSettings[K]) => void }) {
  const normalized = normalizeSpotifyUri(draft.spotifyUri || '');
  const url = normalized ? spotifyOpenUrl(normalized) : null;
  return <div className="admin-settings-grid"><div className="admin-settings-main"><section className="admin-card admin-form">
    <div className="admin-card-heading"><h2>Spotify</h2><Music2 size={24} className="admin-accent" /></div>
    <label className="admin-switch-label"><span><strong>启用音乐播放器</strong><small>在博客中显示播放器</small></span><input type="checkbox" role="switch" checked={draft.musicEnabled} onChange={event => onChange('musicEnabled', event.target.checked)} /></label>
    <label>Spotify 链接或 URI<input name="spotifyUri" value={draft.spotifyUri || ''} onChange={event => { event.target.setCustomValidity(''); onChange('spotifyUri', event.target.value); }} onBlur={event => event.target.setCustomValidity(normalizeSpotifyUri(event.target.value) === null ? '请填写有效的 Spotify 链接或 URI。' : '')} maxLength={2048} spellCheck={false} autoComplete="off" placeholder="https://open.spotify.com/playlist/…" aria-invalid={normalized === null} aria-describedby="spotify-source-help" /><small id="spotify-source-help">支持歌单、专辑、单曲、艺人和播客。留空则隐藏播放器。</small></label>
    {normalized === null && <p className="admin-inline-error">请填写有效的 Spotify 链接或 URI。</p>}
    {url && <a className="admin-text-button" href={url} target="_blank" rel="noopener noreferrer">在 Spotify 检查内容 <ArrowUpRight size={15} aria-hidden /></a>}
  </section></div><aside><section className="admin-card admin-form"><h2>播放说明</h2><p className="admin-muted">无需 API 密钥。完整播放取决于内容、Spotify 账号和浏览器，部分内容仅提供试听。</p></section></aside></div>;
}
