import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_SETTINGS } from '../src/lib/db';
import { settingsSchema } from '../src/lib/validation';
import { DEFAULT_LABELS, DEFAULT_NAVIGATION, formatCopyright, isSafeSiteLink, visibleSiteLinks } from '../src/lib/site-customization';

test('自定义导航拒绝可执行地址、凭证、控制字符和重复编号', () => {
  for (const href of ['javascript:alert(1)', 'data:text/html,hello', '//evil.example', '/\\evil.example', 'https://user:password@example.com', 'https://example.com\n/path']) {
    assert.equal(isSafeSiteLink(href), false, href);
    assert.equal(settingsSchema.safeParse({ ...DEFAULT_SETTINGS, navigation: [{ id: 'one', label: '链接', href, visible: true, newTab: false }] }).success, false);
  }
  assert.equal(settingsSchema.safeParse({ ...DEFAULT_SETTINGS, navigation: [DEFAULT_NAVIGATION[0], DEFAULT_NAVIGATION[0]] }).success, false);
  assert.equal(settingsSchema.safeParse({ ...DEFAULT_SETTINGS, navigation: Array.from({ length: 21 }, (_, i) => ({ ...DEFAULT_NAVIGATION[0], id: String(i) })) }).success, false);
});

test('导航支持自定义页面、锚点、邮件与外链，空数组保留隐藏全部的选择', () => {
  for (const href of ['/pages/custom-page?from=menu', '/bangumi', '#journal', 'https://bgm.tv', 'mailto:hello@example.com']) assert.equal(isSafeSiteLink(href), true);
  const result = settingsSchema.parse({ ...DEFAULT_SETTINGS, navigation: [], sidebarLinks: [], footerLinks: [], heroPrimaryHref: '/bangumi' });
  assert.deepEqual(result.navigation, []); assert.deepEqual(result.sidebarLinks, []); assert.deepEqual(result.footerLinks, []);
  assert.equal(result.heroPrimaryHref, '/bangumi');
});

test('文案只覆盖修改项，其他默认文案兼容旧设置且不接受空标签', () => {
  const result = settingsSchema.parse({ ...DEFAULT_SETTINGS, labels: { browsePosts: '看看文章' } });
  assert.equal(result.labels.browsePosts, '看看文章'); assert.equal(result.labels.commentSubmit, DEFAULT_LABELS.commentSubmit);
  assert.equal(settingsSchema.safeParse({ ...DEFAULT_SETTINGS, labels: { search: '  ' } }).success, false);
  assert.equal(settingsSchema.safeParse({ ...DEFAULT_SETTINGS, labels: { unknownButton: 'x' } }).success, false);
  const old = { ...DEFAULT_SETTINGS } as Record<string, unknown>;
  for (const key of ['navigation', 'sidebarLinks', 'footerLinks', 'labels', 'bangumiEnabled', 'bangumiTitle', 'bangumiDefaultStatus']) delete old[key];
  const compatible = settingsSchema.strict().parse(old);
  assert.equal(compatible.bangumiDefaultStatus, 3); assert.equal(compatible.bangumiTitle, '我的追番');
  assert.equal(compatible.labels.search, DEFAULT_LABELS.search); assert.ok(compatible.navigation.some(link => link.href === '/bangumi'));
});

test('隐藏链接不输出，停用追番时同时移除默认追番入口', () => {
  const items = [...DEFAULT_NAVIGATION, { id: 'hidden', label: '隐藏', href: '/hidden', visible: false, newTab: false }];
  assert.ok(!visibleSiteLinks(items, true).some(item => item.id === 'hidden'));
  assert.ok(!visibleSiteLinks(items, false).some(item => item.href === '/bangumi'));
  assert.ok(visibleSiteLinks(items, true).some(item => item.href === '/bangumi'));
});

test('页脚版权只替换年份和作者变量，原文字与未知变量保持原样', () => {
  assert.equal(formatCopyright('© {year} {author}\n保留所有权利', 'Demo', 2026), '© 2026 Demo\n保留所有权利');
  assert.equal(formatCopyright('{author} / {year} / {unknown}', '<b>作者</b>', 2026), '<b>作者</b> / 2026 / {unknown}');
});
