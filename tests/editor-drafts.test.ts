import test from 'node:test';
import assert from 'node:assert/strict';
import type { Post } from '../src/lib/types';
import { contentFingerprint, editorDraftKey, readEditorDraft, removeEditorDraft, writeEditorDraft, type EditorDraft } from '../src/lib/editor-drafts';

function fixture(): EditorDraft {
  return {
    version: 1, savedAt: 1_700_000_100_000, baseUpdatedAt: 1_700_000_000,
    content: {
      tags: '未完成标签, 中文',
      post: {
        id: 42, title: '', slug: '', content: '尚未提交的中文正文。', excerpt: '',
        createdAt: 1_700_000_000, updatedAt: 1_700_000_000, status: 'publish', type: 'post',
        category: '随笔', categories: ['随笔'], tags: [], cover: '', views: 8,
        allowComment: true, pinned: false, format: 'markdown',
      },
    },
  };
}
function memory() {
  const values = new Map<string, string>();
  return {
    values,
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
  };
}

test('本地草稿保留未完成字段、正文、标签输入及冲突检测版本，可恢复完整内容', () => {
  const storage = memory(), draft = fixture(), key = editorDraftKey('博主', 'post', 42);
  assert.equal(writeEditorDraft(storage, key, draft), true);
  assert.deepEqual(readEditorDraft(storage, key, 'post', 42), draft);
  assert.equal(removeEditorDraft(storage, key), true);
  assert.equal(readEditorDraft(storage, key, 'post', 42), null);
});

test('草稿按账户、文章或页面及新建或已有编号隔离，记录身份不符时不恢复', () => {
  const keys = ['Alice', 'alice', 'a:b', 'a%3Ab', '中文账号'].flatMap(username => ['post', 'page'].flatMap(type => [0, 42].map(id => editorDraftKey(username, type as Post['type'], id))));
  assert.equal(new Set(keys).size, keys.length);
  const storage = memory(), key = editorDraftKey('Alice', 'post', 42);
  writeEditorDraft(storage, key, fixture());
  assert.equal(readEditorDraft(storage, key, 'post', 0), null);
  assert.equal(readEditorDraft(storage, key, 'page', 42), null);
  const blank = fixture(); blank.content.post.id = 0; blank.baseUpdatedAt = null;
  const newKey = editorDraftKey('Alice', 'post', 0);
  assert.equal(writeEditorDraft(storage, newKey, blank), true);
  assert.deepEqual(readEditorDraft(storage, newKey, 'post', 0), blank);
});

test('损坏、未知版本、错误形状、越界字段及过大记录不会进入恢复流程', () => {
  const storage = memory(), key = editorDraftKey('Alice', 'post', 42);
  for (const raw of ['', '{broken', 'null', '[]', '"draft"', ' '.repeat(6_500_001)]) {
    storage.setItem(key, raw);
    assert.equal(readEditorDraft(storage, key, 'post', 42), null);
  }
  const badValues: unknown[] = [
    { ...fixture(), version: 2 }, { ...fixture(), savedAt: -1 }, { ...fixture(), savedAt: Number.MAX_SAFE_INTEGER },
    { ...fixture(), baseUpdatedAt: 'yesterday' }, { ...fixture(), content: null },
  ];
  for (const patch of [
    { title: 'x'.repeat(301) }, { slug: 'x'.repeat(181) }, { content: 'x'.repeat(1_000_001) },
    { excerpt: 'x'.repeat(5001) }, { id: -1 }, { createdAt: Infinity }, { updatedAt: NaN },
    { views: 1.5 }, { status: 'deleted' }, { type: 'comment' }, { pinned: 1 }, { allowComment: 'yes' },
    { format: 'html' }, { tags: ['x'.repeat(101)] }, { tags: Array(51).fill('tag') },
    { categories: ['x'.repeat(101)] }, { categories: {} }, { cover: 'x'.repeat(2049) },
  ]) {
    const draft = fixture(); Object.assign(draft.content.post, patch); badValues.push(draft);
  }
  for (const value of badValues) {
    storage.setItem(key, JSON.stringify(value));
    assert.equal(readEditorDraft(storage, key, 'post', 42), null);
    assert.equal(writeEditorDraft(storage, key, value as EditorDraft), false);
  }
});

test('本地存储禁用、配额不足或删除失败均返回可处理的状态', () => {
  const draft = fixture(), key = editorDraftKey('Alice', 'post', 42);
  assert.equal(readEditorDraft({ getItem() { throw new Error('blocked'); } }, key, 'post', 42), null);
  assert.equal(writeEditorDraft({ setItem() { throw new Error('quota'); } }, key, draft), false);
  assert.equal(removeEditorDraft({ removeItem() { throw new Error('blocked'); } }, key), false);
});

test('草稿仅读取支持的字段，不携带存储中的未知属性', () => {
  const draft = fixture(), storage = memory(), key = editorDraftKey('Alice', 'post', 42);
  const raw = { ...draft, secret: 'not part of editor', content: { ...draft.content, post: { ...draft.content.post, serverToken: 'ignored' } } };
  storage.setItem(key, JSON.stringify(raw));
  assert.deepEqual(readEditorDraft(storage, key, 'post', 42), draft);
});

test('内容指纹仅跟踪可编辑字段，保留发布时间和未提交标签的变化', () => {
  const draft = fixture().content, fingerprint = contentFingerprint(draft);
  assert.equal(contentFingerprint({ ...draft, post: { ...draft.post, id: 90, views: 999, updatedAt: 1_900_000_000 } }), fingerprint);
  for (const patch of [
    { title: '新标题' }, { slug: '中文地址' }, { content: '新正文' }, { excerpt: '新摘要' },
    { createdAt: 1_700_000_001 }, { status: 'private' as const }, { type: 'page' as const },
    { category: '技术' }, { categories: ['技术'] }, { tags: ['标签'] }, { cover: '/uploads/new.png' },
    { allowComment: false }, { pinned: true }, { format: 'mdx' as const },
  ]) assert.notEqual(contentFingerprint({ ...draft, post: { ...draft.post, ...patch } }), fingerprint);
  assert.notEqual(contentFingerprint({ ...draft, tags: '新标签,' }), fingerprint);
  const legacy = { ...draft, post: { ...draft.post, categories: undefined } };
  assert.equal(contentFingerprint(legacy), fingerprint);
});
