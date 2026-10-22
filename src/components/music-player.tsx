'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, Headphones, LoaderCircle, Pause, Play, RotateCw, X } from 'lucide-react';
import { normalizeSpotifyUri, spotifyEmbedHeight, spotifyOpenUrl } from '@/lib/spotify';
import { loadSpotifyIframeApi, type SpotifyEmbedController, type SpotifyEmbedListener } from '@/lib/spotify-iframe';
import type { SiteSettings } from '@/lib/types';
import styles from './spotify-player.module.css';

const OPEN_EVENT = 'mellow:music-open';

export function MusicPlayer({ settings }: { settings: SiteSettings }) {
  const labels = settings.labels;
  const uri = normalizeSpotifyUri(settings.spotifyUri || '') || '';
  const enabled = settings.musicEnabled && !!uri;
  const source = useRef(uri);
  source.current = uri;
  const host = useRef<HTMLDivElement>(null);
  const launcher = useRef<HTMLButtonElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const controller = useRef<SpotifyEmbedController | null>(null);
  const loadedUri = useRef('');
  const [open, setOpen] = useState(false);
  const [activated, setActivated] = useState(false);
  const [phase, setPhase] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [playing, setPlaying] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const [notice, setNotice] = useState('');
  const [reloadRequired, setReloadRequired] = useState(false);
  const [retry, setRetry] = useState(0);

  function reveal() { setOpen(true); setActivated(true); }
  function collapse() { setOpen(false); launcher.current?.focus(); }

  useEffect(() => {
    if (!enabled) return;
    const revealPlayer = () => { setOpen(true); setActivated(true); };
    window.addEventListener(OPEN_EVENT, revealPlayer);
    return () => window.removeEventListener(OPEN_EVENT, revealPlayer);
  }, [enabled]);

  useEffect(() => {
    if (!open) return;
    closeButton.current?.focus();
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { setOpen(false); launcher.current?.focus(); } };
    window.addEventListener('keydown', escape);
    return () => window.removeEventListener('keydown', escape);
  }, [open]);

  useEffect(() => {
    if (!activated || !enabled || !host.current) return;
    const mount = host.current;
    let disposed = false;
    let embed: SpotifyEmbedController | null = null;
    let observer: MutationObserver | null = null;
    let timeout: ReturnType<typeof setTimeout>;
    setPhase('loading'); setNotice(''); setPlaying(false); setBuffering(false); setReloadRequired(false);

    const onReady: SpotifyEmbedListener = () => {
      if (disposed) return;
      clearTimeout(timeout);
      setPhase('ready');
    };
    const onPlayback: SpotifyEmbedListener = event => {
      if (disposed || !event?.data) return;
      if (typeof event.data.isPaused === 'boolean') setPlaying(!event.data.isPaused);
      setBuffering(event.data.isBuffering === true);
    };
    const dispose = () => {
      disposed = true;
      clearTimeout(timeout);
      observer?.disconnect();
      if (embed) {
        try { embed.removeListener?.('ready', onReady); embed.removeListener?.('playback_update', onPlayback); } catch {}
        try { embed.pause(); } catch {}
        try { embed.destroy(); } catch {}
      }
      if (controller.current === embed) controller.current = null;
      mount.replaceChildren();
    };
    const fail = () => {
      if (disposed) return;
      dispose();
      setPlaying(false); setBuffering(false); setPhase('error');
    };
    const describeFrame = () => {
      const frame = mount.querySelector('iframe');
      if (!frame) return;
      frame.title = 'Spotify 音乐播放器';
      frame.height = String(spotifyEmbedHeight(source.current));
      frame.referrerPolicy = 'strict-origin-when-cross-origin';
      frame.setAttribute('allow', 'autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture');
      frame.setAttribute('allowfullscreen', '');
    };

    timeout = setTimeout(fail, 25_000);
    void loadSpotifyIframeApi().then(api => {
      if (disposed) return;
      const placeholder = document.createElement('div');
      mount.replaceChildren(placeholder);
      observer = new MutationObserver(describeFrame);
      observer.observe(mount, { childList: true, subtree: true });
      const initialUri = source.current;
      api.createController(placeholder, { uri: initialUri, width: '100%', height: spotifyEmbedHeight(initialUri) }, next => {
        if (disposed) { try { next.destroy(); } catch {} return; }
        embed = next;
        controller.current = next;
        loadedUri.current = initialUri;
        next.addListener('ready', onReady);
        next.addListener('playback_update', onPlayback);
        describeFrame();
        if (source.current !== initialUri) {
          (next.loadEntity || next.loadUri).call(next, source.current);
          loadedUri.current = source.current;
        }
      });
      describeFrame();
    }).catch(() => {
      if (disposed) return;
      // The official bootstrap also loads a CDN bundle. Reload the document after
      // an API failure so its internal loading guard cannot block a second try.
      setReloadRequired(true);
      fail();
    });
    return dispose;
  }, [activated, enabled, retry]);

  useEffect(() => {
    const embed = controller.current;
    if (!enabled || !embed || uri === loadedUri.current) return;
    try {
      (embed.loadEntity || embed.loadUri).call(embed, uri);
      loadedUri.current = uri;
      const frame = host.current?.querySelector('iframe');
      if (frame) frame.height = String(spotifyEmbedHeight(uri));
      setPlaying(false); setBuffering(false); setNotice('');
    } catch { setNotice('请重试，或在 Spotify 打开。'); }
  }, [uri, enabled]);

  function togglePlayback() {
    const embed = controller.current;
    if (!embed || phase !== 'ready') { reveal(); return; }
    try { embed.togglePlay(); setNotice(''); }
    catch { setNotice('请在播放器中点击播放。'); setOpen(true); }
  }

  if (!enabled) return null;
  return <div className={styles.widget} data-spotify-player data-state={phase} data-playing={playing}>
    {activated && <section id="spotify-player-panel" className={styles.panel} hidden={!open} aria-label="音乐播放器">
      <div className={styles.heading}><span><Headphones size={18} aria-hidden /> Spotify</span><button ref={closeButton} type="button" className={styles.iconButton} aria-label={labels.musicClose} onClick={collapse}><X size={20} aria-hidden /></button></div>
      <div className={styles.embedArea}>
        {phase === 'loading' && <p className={styles.status} role="status"><LoaderCircle size={20} className={styles.spinner} aria-hidden />正在连接…</p>}
        <div ref={host} className={styles.frameHost} style={{ minHeight: spotifyEmbedHeight(uri) }} hidden={phase === 'error'} data-spotify-embed />
        {phase === 'error' && <div className={styles.error} role="status"><p>暂时无法连接 Spotify。</p><button type="button" className="button button-soft" onClick={() => reloadRequired ? window.location.reload() : setRetry(value => value + 1)}><RotateCw size={16} aria-hidden />{reloadRequired ? '刷新重试' : '重试'}</button></div>}
      </div>
      {notice && <p className={styles.notice} role="status">{notice}</p>}
      <div className={styles.footer}><span>部分内容可能仅提供试听。</span><a href={spotifyOpenUrl(uri)!} target="_blank" rel="noopener noreferrer">在 Spotify 打开<ArrowUpRight size={15} aria-hidden /></a></div>
    </section>}
    <div className={styles.pill}>
      {phase === 'ready' && <button type="button" className={styles.playButton} aria-label={playing ? labels.musicPause : labels.musicPlay} onClick={togglePlayback}>{buffering ? <LoaderCircle size={18} className={styles.spinner} aria-hidden /> : playing ? <Pause size={18} aria-hidden /> : <Play size={18} aria-hidden />}</button>}
      <button ref={launcher} type="button" className={styles.launcher} aria-label={open ? labels.musicClose : labels.musicOpen} aria-controls={activated ? 'spotify-player-panel' : undefined} aria-expanded={open} onClick={() => open ? collapse() : reveal()}><Headphones size={18} aria-hidden /><span>{playing ? '正在播放' : labels.musicTitle}</span>{playing && <span className={styles.playingDot} aria-hidden />}</button>
    </div>
  </div>;
}

export function OpenMusicButton({ label = '打开播放器' }: { label?: string }) {
  return <button type="button" className="button button-primary" onClick={() => window.dispatchEvent(new Event(OPEN_EVENT))}><Headphones size={18} aria-hidden />{label}</button>;
}
