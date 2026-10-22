import test from 'node:test';
import assert from 'node:assert/strict';
import { officialMusicFallback } from '../src/lib/music-source';
test('官方备用音源仅为受信Meting网易云数字歌曲生成，不重写自托管链接', () => {
  assert.equal(officialMusicFallback('https://api.i-meto.com/meting/api?server=netease&type=url&id=12345&auth=sample'), 'https://music.163.com/song/media/outer/url?id=12345.mp3');
  for (const source of ['https://example.com/?server=netease&type=url&id=1','https://api.i-meto.com/meting/api?server=qq&type=url&id=1','https://api.i-meto.com/meting/api?server=netease&type=url&id=x','/uploads/own-song.mp3','javascript:alert(1)']) assert.equal(officialMusicFallback(source), null);
});
