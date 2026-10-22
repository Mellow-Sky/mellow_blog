import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSpotifyUri, spotifyEmbedHeight, spotifyOpenUrl } from '../src/lib/spotify';
import { loadSpotifyIframeApi, type SpotifyIframeApi } from '../src/lib/spotify-iframe';

const id = '7makk4oTQel546B0PZlDM5';

test('Spotify 内容 URI 与分享链接统一为安全标准 URI，清除跟踪参数', () => {
  for (const type of ['playlist', 'album', 'track', 'artist', 'episode', 'show']) {
    const expected = `spotify:${type}:${id}`;
    for (const source of [expected, `https://open.spotify.com/${type}/${id}`, `https://open.spotify.com/${type}/${id}/?si=private#tracking`, `https://open.spotify.com/embed/${type}/${id}?utm_source=generator`, `https://open.spotify.com/intl-zh/${type}/${id}`, `https://open.spotify.com/intl-pt-br/embed/${type}/${id}`]) {
      assert.equal(normalizeSpotifyUri(source), expected, source);
      assert.equal(spotifyOpenUrl(source), `https://open.spotify.com/${type}/${id}`);
    }
  }
  assert.equal(normalizeSpotifyUri(`  spotify:track:${id}  `), `spotify:track:${id}`);
  assert.equal(normalizeSpotifyUri(''), '');
  assert.equal(normalizeSpotifyUri('  '), '');
  assert.equal(spotifyOpenUrl(''), null);
});

test('Spotify 不接受 iframe 代码、第三方域名、凭证、其他协议或不支持的实体', () => {
  for (const source of [`http://open.spotify.com/track/${id}`, `//open.spotify.com/track/${id}`, `https://evil.example/track/${id}`, `https://open.spotify.com.evil.example/track/${id}`, `https://evil.example@open.spotify.com/track/${id}`, `https://open.spotify.com:8080/track/${id}`, `https://open.spotify.com/track/${id}/extra`, `https://open.spotify.com//track/${id}`, `https://open.spotify.com/search/${id}`, `spotify:local:${id}`, `spotify:track:${id.slice(1)}`, `spotify:track:${id}x`, `spotify:track:${id}?si=sample`, `javascript:alert(1)`, `<iframe src="https://open.spotify.com/embed/track/${id}"></iframe>`, `https://open.spotify.com/track/${id.slice(0, 20)}%20`, `https://open.spotify.com/track/\n${id}`, 'x'.repeat(2049)]) {
    assert.equal(normalizeSpotifyUri(source), null, source);
    assert.equal(spotifyOpenUrl(source), null, source);
  }
});

test('Spotify 使用官方播放器的单曲和集合尺寸', () => {
  assert.equal(spotifyEmbedHeight(`spotify:track:${id}`), 152);
  assert.equal(spotifyEmbedHeight(`spotify:episode:${id}`), 152);
  assert.equal(spotifyEmbedHeight(`spotify:playlist:${id}`), 352);
  assert.equal(spotifyEmbedHeight(`spotify:album:${id}`), 352);
});

test('Spotify 脚本并发只加载一次，网络失败可重试，成功后复用 API', async () => {
  await assert.rejects(loadSpotifyIframeApi(), /browser/);
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const previousDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const scripts = new Map<string, FakeScript>();
  let appended = 0;
  let previousReadyCalled = 0;
  class FakeScript extends EventTarget {
    id = ''; src = ''; async = false; referrerPolicy = ''; isConnected = false;
    remove() { this.isConnected = false; scripts.delete(this.id); }
  }
  const previousReady = (_api: SpotifyIframeApi) => { previousReadyCalled++; };
  const fakeWindow: { onSpotifyIframeApiReady?: (api: SpotifyIframeApi) => void } = { onSpotifyIframeApiReady: previousReady };
  Object.defineProperty(globalThis, 'window', { configurable: true, value: fakeWindow });
  Object.defineProperty(globalThis, 'document', { configurable: true, value: {
    getElementById: (scriptId: string) => scripts.get(scriptId) || null,
    createElement: () => new FakeScript(),
    body: { appendChild: (script: FakeScript) => { script.isConnected = true; scripts.set(script.id, script); appended++; } },
  } });
  try {
    const first = loadSpotifyIframeApi();
    assert.equal(loadSpotifyIframeApi(), first);
    assert.equal(appended, 1);
    const initialScript = scripts.get('mellow-spotify-iframe-api')!;
    assert.equal(initialScript.src, 'https://open.spotify.com/embed/iframe-api/v1');
    initialScript.dispatchEvent(new Event('error'));
    await assert.rejects(first, /could not be loaded/);
    assert.equal(fakeWindow.onSpotifyIframeApiReady, previousReady);
    assert.equal(scripts.size, 0);
    const retry = loadSpotifyIframeApi();
    assert.equal(loadSpotifyIframeApi(), retry);
    assert.equal(appended, 2);
    const api: SpotifyIframeApi = { createController() {} };
    fakeWindow.onSpotifyIframeApiReady!(api);
    assert.equal(await retry, api);
    assert.equal(await loadSpotifyIframeApi(), api);
    assert.equal(appended, 2);
    assert.equal(scripts.size, 1);
    assert.equal(previousReadyCalled, 1);
    assert.equal(fakeWindow.onSpotifyIframeApiReady, previousReady);
  } finally {
    if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow); else Reflect.deleteProperty(globalThis, 'window');
    if (previousDocument) Object.defineProperty(globalThis, 'document', previousDocument); else Reflect.deleteProperty(globalThis, 'document');
  }
});
