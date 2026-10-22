const ENTITY_TYPES = new Set(['track', 'album', 'playlist', 'artist', 'episode', 'show']);
const SPOTIFY_ID = /^[A-Za-z0-9]{22}$/;

/** Accept only Spotify entities that can be embedded; never accept arbitrary iframe URLs. */
export function normalizeSpotifyUri(input: string): string | null {
  const value = input.trim();
  if (!value) return '';
  if (value.length > 2048 || /[\u0000-\u0020\u007f]/.test(value)) return null;
  const uri = /^spotify:([a-z]+):([A-Za-z0-9]+)$/.exec(value);
  if (uri) return ENTITY_TYPES.has(uri[1]) && SPOTIFY_ID.test(uri[2]) ? `spotify:${uri[1]}:${uri[2]}` : null;
  try {
    if (!value.startsWith('https://')) return null;
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.hostname !== 'open.spotify.com' || url.port || url.username || url.password) return null;
    const parts = url.pathname.replace(/\/$/, '').split('/').slice(1);
    if (/^intl-[a-z]{2}(?:-[a-z]{2})?$/i.test(parts[0] || '')) parts.shift();
    if (parts[0] === 'embed') parts.shift();
    if (parts.length !== 2 || !ENTITY_TYPES.has(parts[0]) || !SPOTIFY_ID.test(parts[1])) return null;
    return `spotify:${parts[0]}:${parts[1]}`;
  } catch { return null; }
}

export function spotifyOpenUrl(input: string): string | null {
  const uri = normalizeSpotifyUri(input);
  return uri ? `https://open.spotify.com/${uri.split(':').slice(1).join('/')}` : null;
}

export function spotifyEmbedHeight(input: string): number {
  const type = normalizeSpotifyUri(input)?.split(':')[1];
  return type === 'track' || type === 'episode' ? 152 : 352;
}
