/** Use only the official NetEase endpoint as a fallback for a trusted Meting track. */
export function officialMusicFallback(source: string): string | null {
  try {
    const url = new URL(source);
    if (url.protocol !== 'https:' || url.hostname !== 'api.i-meto.com' || url.pathname !== '/meting/api' || url.searchParams.get('server') !== 'netease' || url.searchParams.get('type') !== 'url') return null;
    const id = url.searchParams.get('id');
    return id && /^\d{1,20}$/.test(id) ? `https://music.163.com/song/media/outer/url?id=${id}.mp3` : null;
  } catch { return null; }
}
