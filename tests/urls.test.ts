import test from 'node:test';
import assert from 'node:assert/strict';
import { encodePathSegment, toReadableUrl, isCurrentSitePath } from '../src/lib/urls';
import { postUrl } from '../src/lib/utils';
import { generatedSlug } from '../src/components/admin/api';
import { postSchema } from '../src/lib/validation';

test('文章与独立页面链接保留可读中文，浏览器请求仍正确编码', () => {
  for (const type of ['post', 'page'] as const) {
    const url = postUrl({ type, slug: '我的第一篇文章' });
    assert.equal(url, `/${type === 'page' ? 'pages' : 'posts'}/我的第一篇文章`);
    assert.equal(decodeURIComponent(new URL(url, 'https://example.com').pathname.split('/')[2]), '我的第一篇文章');
  }
});

test('中文路径中的保留字符、空格与字面量百分号不会变成 URL 分隔符', () => {
  assert.equal(encodePathSegment('中文/路径?标签#片段%2F 空格'), '中文%2F路径%3F标签%23片段%252F%20空格');
  for (const slug of ['中文', '中文 空格', '😀-日记', '字面量%20', '字面量%E4%B8%AD', '中文/路径', 'a?b#c', '中文\u00a0路径', '中文\u200b路径', '中文&英文']) {
    const url = new URL(`/posts/${encodePathSegment(slug)}`, 'https://example.com');
    assert.equal(url.search, ''); assert.equal(url.hash, '');
    assert.equal(url.pathname.split('/').length, 3);
    assert.equal(decodeURIComponent(url.pathname.split('/')[2]), slug);
  }
});

test('复制链接只恢复中文等可见 Unicode，不解码已有 URL 语法或字面量百分号', () => {
  const original = 'https://example.com/posts/%E6%88%91%E7%9A%84%E6%96%87%E7%AB%A0%20%252F?tag=%E4%B8%AD%E6%96%87%26x%3Dy#%E7%9B%AE%E5%BD%95';
  const readable = toReadableUrl(original);
  assert.equal(readable, 'https://example.com/posts/我的文章%20%252F?tag=中文%26x%3Dy#目录');
  assert.equal(new URL(readable).href, new URL(original).href);
  assert.equal(toReadableUrl(readable), readable);
  for (const escaped of ['%2F', '%25', '%252F', '%23', '%3F', '%20', '%C2%A0', '%E2%80%8B', '%FF', '%E4%B8', '%invalid']) {
    assert.equal(toReadableUrl(`/posts/中文${escaped}`), `/posts/中文${escaped}`);
  }
});

test('较长中文标题截断时保留完整字符，输入未完成时路径预览不会崩溃', () => {
  for (const character of ['𠮷', '😀']) {
    const slug = generatedSlug('中'.repeat(159) + character);
    assert.ok(slug.isWellFormed());
    assert.equal(slug, '中'.repeat(159));
    assert.doesNotThrow(() => postUrl({ type: 'post', slug }));
    const complete = generatedSlug('中'.repeat(158) + character);
    assert.equal(complete, '中'.repeat(158) + character);
  }
  assert.doesNotThrow(() => encodePathSegment('未完成\ud842'));
  assert.equal(postSchema.safeParse({ title: '测试', slug: '未完成\ud842', content: '', status: 'publish', type: 'post' }).success, false);
});

test('中文导航地址与浏览器编码后的路径匹配，忽略查询与片段并保留百分号语义', () => {
  assert.equal(isCurrentSitePath('/pages/%E5%85%B3%E4%BA%8E%E6%88%91%E4%BB%AC', '/pages/关于我们?from=nav#介绍'), true);
  assert.equal(isCurrentSitePath('/pages/中文%20空格', '/pages/中文 空格'), true);
  assert.equal(isCurrentSitePath('/pages/中文%2520空格', '/pages/中文%20空格'), false);
  assert.equal(isCurrentSitePath('/pages/中文', '/pages/其他页面'), false);
  assert.equal(isCurrentSitePath('/pages/中文', 'https://other.example/pages/中文'), false);
  assert.equal(isCurrentSitePath('/pages/中文', '//other.example/pages/中文'), false);
});
