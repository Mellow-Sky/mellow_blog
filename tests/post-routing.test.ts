import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { isValidElement, type ReactNode } from 'react';
import { getDb, getPosts, savePost } from '../src/lib/db';
import type { Post } from '../src/lib/types';
import { postSchema } from '../src/lib/validation';
import { postUrl } from '../src/lib/utils';
import { generatedSlug } from '../src/components/admin/api';
import { decodePageSlug } from '../src/lib/route-slug';

const temporary = mkdtempSync(path.join(tmpdir(), 'blog-post-routing-'));
process.env.DATABASE_PATH = path.join(temporary, 'blog.db');
const samples = ['hello-world', '中文路径', 'space slug', 'emoji-😀', '100%', 'literal%20slug', 'literal slug', 'literal%2Fname', 'literal%252Fname', 'literal%E4%B8%AD', 'literal中'];
const published: Post[] = [];
let ArticlePage: typeof import('../src/app/posts/[slug]/page').default;
let articleMetadata: typeof import('../src/app/posts/[slug]/page').generateMetadata;
let IndependentPage: typeof import('../src/app/pages/[slug]/page').default;
let pageMetadata: typeof import('../src/app/pages/[slug]/page').generateMetadata;
let CategoryPage: typeof import('../src/app/category/[slug]/page').default;

function params(slug: string) { return { params: Promise.resolve({ slug }) }; }
function text(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(text).join('');
  return isValidElement<{ children?: ReactNode }>(node) ? text(node.props.children) : '';
}
function headings(node: ReactNode): string[] {
  if (Array.isArray(node)) return node.flatMap(headings);
  if (!isValidElement<{ children?: ReactNode }>(node)) return [];
  return node.type === 'h1' ? [text(node.props.children)] : headings(node.props.children);
}
function initialCategories(node: ReactNode): string[] {
  if (Array.isArray(node)) return node.flatMap(initialCategories);
  if (!isValidElement<{ children?: ReactNode; initialCategory?: string }>(node)) return [];
  return node.props.initialCategory === undefined ? initialCategories(node.props.children) : [node.props.initialCategory];
}
const isNotFound = (error: unknown) => error instanceof Error && 'digest' in error && error.digest === 'NEXT_HTTP_ERROR_FALLBACK;404';

before(() => {
  // These checks exercise the real route and database lookup without rendering
  // the MDX subtree; its ESM-only compiler is covered by mdx-safety.test.mts.
  const contentPath = require.resolve('../src/components/content');
  const previous = require.cache[contentPath];
  require.cache[contentPath] = { id: contentPath, filename: contentPath, loaded: true, exports: { ArticleContent: () => null } } as NodeModule;
  try {
    ({ default: ArticlePage, generateMetadata: articleMetadata } = require('../src/app/posts/[slug]/page'));
    ({ default: IndependentPage, generateMetadata: pageMetadata } = require('../src/app/pages/[slug]/page'));
    ({ default: CategoryPage } = require('../src/app/category/[slug]/page'));
  } finally {
    if (previous) require.cache[contentPath] = previous;
    else delete require.cache[contentPath];
  }
  for (const type of ['post', 'page'] as const) {
    for (const slug of samples) {
      published.push(savePost(postSchema.parse({ title: `${type} ${slug}`, slug: `${type}-${slug}`, content: 'Synthetic published content.', type, status: 'publish', category: '中文分类' })));
    }
  }
});
after(() => { getDb().close(); rmSync(temporary, { recursive: true, force: true }); });

test('首页发布后的中文自动路径可以通过编码链接打开文章', async () => {
  const title = '这是我的 第一篇文章';
  const post = savePost(postSchema.parse({ title, slug: generatedSlug(title), content: 'Published after startup.', status: 'publish', type: 'post' }));
  assert.ok(getPosts().some(item => item.id === post.id));
  const url = postUrl(post);
  assert.equal(url, `/posts/${encodeURIComponent(post.slug)}`);
  const page = await ArticlePage(params(url.slice('/posts/'.length)));
  assert.deepEqual(headings(page), [title]);
});

test('文章和独立页面接受中文、空格、表情和百分号路径，仅解码一次并保持不同路径独立', async () => {
  for (const post of published) {
    const render = post.type === 'post' ? ArticlePage : IndependentPage;
    const page = await render(params(encodeURIComponent(post.slug)));
    assert.deepEqual(headings(page), [post.title], post.slug);
  }
});

test('元数据使用已经解码的原始路径，百分号形式的路径不被再次解码', async () => {
  for (const post of published) {
    const metadata = await (post.type === 'post' ? articleMetadata : pageMetadata)(params(post.slug));
    assert.equal(metadata.title, post.title, post.slug);
    if (post.type === 'post') assert.equal(metadata.alternates?.canonical, postUrl(post));
  }
});

test('页面路径解码不递归处理百分号序列，异常编码不会抛出 URIError', () => {
  for (const slug of samples) assert.equal(decodePageSlug(encodeURIComponent(slug)), slug);
  assert.equal(decodePageSlug('%252F'), '%2F');
  for (const malformed of ['%', '%invalid', '%E0%A4%A']) assert.equal(decodePageSlug(malformed), malformed);
});

test('中文分类链接解码后与分类名称匹配', async () => {
  const page = await CategoryPage(params(encodeURIComponent('中文分类')));
  assert.deepEqual(initialCategories(page), ['中文分类']);
});

test('不存在、未公开及内容类型不匹配的路径继续返回404', async () => {
  const hidden = ['draft', 'private'].map(status => savePost(postSchema.parse({ title: status, slug: `${status}-隐藏路径`, content: 'Private synthetic content.', status, type: 'post' })));
  for (const post of hidden) {
    await assert.rejects(ArticlePage(params(encodeURIComponent(post.slug))), isNotFound);
    assert.equal((await articleMetadata(params(post.slug))).title, '文章未找到');
  }
  for (const render of [ArticlePage, IndependentPage]) await assert.rejects(render(params(encodeURIComponent('不存在的路径'))), isNotFound);
  await assert.rejects(ArticlePage(params(encodeURIComponent(published.find(post => post.type === 'page')!.slug))), isNotFound);
  await assert.rejects(IndependentPage(params(encodeURIComponent(published.find(post => post.type === 'post')!.slug))), isNotFound);
});
