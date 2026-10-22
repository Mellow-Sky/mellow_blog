export type SpotifyPlaybackEvent = { data?: { isPaused?: boolean; isBuffering?: boolean; playingURI?: string; duration?: number; position?: number } };
export type SpotifyEmbedListener = (event?: SpotifyPlaybackEvent) => void;
export type SpotifyEmbedController = {
  loadEntity?: (uri: string) => void;
  loadUri: (uri: string) => void;
  togglePlay: () => void;
  pause: () => void;
  destroy: () => void;
  addListener: (event: 'ready' | 'playback_update', listener: SpotifyEmbedListener) => void;
  removeListener?: (event: 'ready' | 'playback_update', listener: SpotifyEmbedListener) => void;
};
export type SpotifyIframeApi = { createController: (element: HTMLElement, options: { uri: string; width: string; height: number }, callback: (controller: SpotifyEmbedController) => void) => void };

declare global { interface Window { onSpotifyIframeApiReady?: (api: SpotifyIframeApi) => void } }

const SCRIPT_ID = 'mellow-spotify-iframe-api';
let readyApi: SpotifyIframeApi | null = null;
let pendingApi: Promise<SpotifyIframeApi> | null = null;

/** Load only after the listener opens the player, once for the entire document. */
export function loadSpotifyIframeApi(): Promise<SpotifyIframeApi> {
  if (typeof window === 'undefined') return Promise.reject(new Error('Spotify requires a browser.'));
  if (readyApi) return Promise.resolve(readyApi);
  if (pendingApi) return pendingApi;
  pendingApi = new Promise<SpotifyIframeApi>((resolve, reject) => {
    const previous = window.onSpotifyIframeApiReady;
    const script = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null || document.createElement('script');
    let settled = false;
    const finish = () => {
      clearTimeout(timer);
      script.removeEventListener('error', fail);
      if (window.onSpotifyIframeApiReady === receive) window.onSpotifyIframeApiReady = previous;
    };
    const fail = () => {
      if (settled) return;
      settled = true; finish(); script.remove(); pendingApi = null;
      reject(new Error('Spotify could not be loaded.'));
    };
    const receive = (api: SpotifyIframeApi) => {
      if (settled) return;
      settled = true; finish(); readyApi = api;
      try { previous?.(api); } catch { /* Another embed must not prevent this one from loading. */ }
      resolve(api);
    };
    const timer = setTimeout(fail, 20_000);
    window.onSpotifyIframeApiReady = receive;
    script.addEventListener('error', fail, { once: true });
    if (!script.isConnected) {
      script.id = SCRIPT_ID;
      script.src = 'https://open.spotify.com/embed/iframe-api/v1';
      script.async = true;
      script.referrerPolicy = 'strict-origin-when-cross-origin';
      document.body.appendChild(script);
    }
  });
  return pendingApi;
}
