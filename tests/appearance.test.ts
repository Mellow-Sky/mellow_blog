import test from 'node:test';
import assert from 'node:assert/strict';
import { isBackgroundUrl, readAppearance, resetAppearance, resolveAppearance, serializeAppearance, type AppearanceOverrides } from '../src/lib/appearance';

const defaults = { colorMode: 'light', background: '/uploads/site-background.jpg', layout: 'magazine' } as const;

test('旧版自动保存的空背景不再覆盖后台图片，未覆盖项继续跟随后台更新', () => {
  for (const version of [undefined, 1, 2]) {
    const overrides = readAppearance(JSON.stringify({ version, mode: 'light', background: '', layout: 'magazine', fontSize: 19 }), defaults);
    assert.deepEqual(overrides, {});
    assert.equal(resolveAppearance(overrides, defaults).background, defaults.background);
    const changed = { colorMode: 'dark', background: '/uploads/new-background.jpg', layout: 'compact' } as const;
    assert.deepEqual(resolveAppearance(overrides, changed), { mode: 'dark', background: changed.background, layout: 'compact', fontSize: 19 });
    assert.deepEqual(JSON.parse(serializeAppearance(overrides)), { version: 3, overrides: {} });
  }
});

test('旧版自选背景和不同的主题、布局、字号保留，相同站点背景则继续跟随', () => {
  const overrides = readAppearance(JSON.stringify({ version: 2, mode: 'dark', background: 'https://images.example.com/personal.jpg', layout: 'compact', fontSize: 21 }), defaults);
  assert.deepEqual(resolveAppearance(overrides, { ...defaults, background: '/uploads/later.jpg' }), { mode: 'dark', background: 'https://images.example.com/personal.jpg', layout: 'compact', fontSize: 21 });
  assert.deepEqual(readAppearance(JSON.stringify({ version: 2, background: defaults.background }), defaults), {});
});

test('v3 仅记录主动覆盖，显式纯色和自选图片不会被后台新默认替换', () => {
  for (const background of ['', '/uploads/personal.jpg', 'https://images.example.com/personal.jpg']) {
    const choice: AppearanceOverrides = { background, fontSize: 17 };
    const persisted = readAppearance(serializeAppearance(choice), defaults);
    assert.deepEqual(persisted, choice);
    assert.equal(resolveAppearance(persisted, { ...defaults, background: '/uploads/later.jpg' }).background, background);
    assert.equal(resolveAppearance(persisted, defaults).fontSize, 17);
  }
});

test('背景跟随站点只清除背景覆盖，全恢复清除所有覆盖并跟随最新默认', () => {
  const personal: AppearanceOverrides = { mode: 'dark', background: '', layout: 'compact', fontSize: 22 };
  const followBackground = resetAppearance(personal, 'background');
  assert.deepEqual(followBackground, { mode: 'dark', layout: 'compact', fontSize: 22 });
  assert.equal(resolveAppearance(readAppearance(serializeAppearance(followBackground), defaults), defaults).background, defaults.background);
  assert.equal(personal.background, '');
  const restored = readAppearance(serializeAppearance(resetAppearance(personal)), defaults);
  assert.deepEqual(restored, {});
  assert.deepEqual(resolveAppearance(restored, { ...defaults, background: '/uploads/latest.jpg' }), { mode: 'light', background: '/uploads/latest.jpg', layout: 'magazine', fontSize: 19 });
});

test('仅迁移无版本和 v1 的旧默认 17px，v2/v3 的 17px 及其他自选字号保留', () => {
  for (const version of [undefined, 1]) assert.equal(resolveAppearance(readAppearance(JSON.stringify({ version, fontSize: 17 }), defaults), defaults).fontSize, 19);
  assert.equal(resolveAppearance(readAppearance(JSON.stringify({ version: 2, fontSize: 17 }), defaults), defaults).fontSize, 17);
  for (const fontSize of [15, 16, 17, 18, 19, 20, 21, 22, 23, 24]) {
    for (const version of [undefined, 1, 2]) {
      if ((version == null || version === 1) && fontSize === 17) continue;
      assert.equal(resolveAppearance(readAppearance(JSON.stringify({ version, fontSize }), defaults), defaults).fontSize, fontSize);
    }
    assert.equal(resolveAppearance(readAppearance(serializeAppearance({ fontSize }), defaults), defaults).fontSize, fontSize);
  }
});

test('无效存储、未知版本和错误数据形状回退到站点默认，字段独立验证', () => {
  for (const raw of [null, '', '{', 'null', '[]', 'true', '"dark"', '{"version":4,"background":""}', '{"version":3}', '{"version":3,"overrides":[]}', '{"version":3,"overrides":null}']) {
    assert.deepEqual(readAppearance(raw, defaults), {});
    assert.equal(resolveAppearance(readAppearance(raw, defaults), defaults).background, defaults.background);
  }
  for (const fontSize of ['20', 14, 25, null, {}, []]) {
    assert.deepEqual(readAppearance(JSON.stringify({ version: 3, overrides: { mode: 'invalid', layout: 'invalid', background: 'javascript:alert(1)', fontSize } }), defaults), {});
  }
  assert.deepEqual(readAppearance('{"version":3,"overrides":{"fontSize":1e999}}', defaults), {});
  assert.deepEqual(readAppearance('{"version":3,"overrides":{"mode":"dark","background":false,"unknown":"ignored"}}', defaults), { mode: 'dark' });
});

test('背景偏好仅接受本站相对路径和有效 HTTPS 图片地址', () => {
  for (const background of ['', '/uploads/picture.png', '/images/a.jpg?size=1200', 'https://images.example.com/a.jpg?size=1200']) assert.equal(isBackgroundUrl(background), true, background);
  for (const background of ['//evil.example/a.jpg', '/\\evil.example/a.jpg', '\\evil.example', 'http://example.com/a.jpg', 'https://', 'https:example.com', 'https://user:password@example.com/a.jpg', 'javascript:alert(1)', 'data:image/png;base64,test', '/uploads/a\n.jpg', ' https://example.com/a.jpg', '/'.repeat(2049)]) {
    assert.equal(isBackgroundUrl(background), false, background);
    assert.deepEqual(readAppearance(serializeAppearance({ background }), defaults), {});
  }
});
