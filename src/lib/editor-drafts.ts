import type { Post } from './types';

export type EditorDraftContent = { post: Post; tags: string };
export interface EditorDraft {
  version: 1;
  savedAt: number;
  baseUpdatedAt: number | null;
  content: EditorDraftContent;
}

const MAX_RECORD_LENGTH = 6_500_000;
const MAX_DATE_MILLISECONDS = 8_640_000_000_000_000;

export function editorDraftKey(username: string, type: 'post' | 'page', postId: number): string {
  return `mellow-editor-draft:v1:${encodeURIComponent(username.toWellFormed())}:${type}:${postId}`;
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function text(value: unknown, limit: number): value is string {
  return typeof value === 'string' && value.length <= limit;
}
function integer(value: unknown, maximum = Number.MAX_SAFE_INTEGER): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= maximum;
}
function timestamp(value: unknown, milliseconds = false): value is number {
  return integer(value, milliseconds ? MAX_DATE_MILLISECONDS : MAX_DATE_MILLISECONDS / 1000);
}
function names(value: unknown, maximum: number): value is string[] {
  return Array.isArray(value) && value.length <= maximum && value.every(item => text(item, 100));
}

function parseDraft(value: unknown): EditorDraft | null {
  if (!record(value) || value.version !== 1 || !timestamp(value.savedAt, true)
    || !(value.baseUpdatedAt === null || timestamp(value.baseUpdatedAt)) || !record(value.content)) return null;
  const content = value.content;
  if (!record(content.post) || !text(content.tags, 10_000)) return null;
  const post = content.post;
  if (!integer(post.id) || !text(post.title, 300) || !text(post.slug, 180)
    || !text(post.content, 1_000_000) || !text(post.excerpt, 5000)
    || !timestamp(post.createdAt) || !timestamp(post.updatedAt) || !integer(post.views)
    || !['publish', 'draft', 'private'].includes(post.status as string)
    || !['post', 'page'].includes(post.type as string)
    || !text(post.category, 100) || !names(post.tags, 50)
    || (post.categories !== undefined && !names(post.categories, 30))
    || !text(post.cover, 2048) || typeof post.allowComment !== 'boolean' || typeof post.pinned !== 'boolean'
    || !['markdown', 'mdx'].includes(post.format as string)) return null;
  // Project only supported fields; browser storage is never an authoritative
  // source for extra properties or server-managed post metadata.
  return {
    version: 1, savedAt: value.savedAt, baseUpdatedAt: value.baseUpdatedAt,
    content: {
      tags: content.tags,
      post: {
        id: post.id, title: post.title, slug: post.slug, content: post.content, excerpt: post.excerpt,
        createdAt: post.createdAt, updatedAt: post.updatedAt, status: post.status as Post['status'], type: post.type as Post['type'],
        category: post.category, ...(post.categories === undefined ? {} : { categories: [...post.categories] }),
        tags: [...post.tags], cover: post.cover, views: post.views, allowComment: post.allowComment,
        pinned: post.pinned, format: post.format as Post['format'],
      },
    },
  };
}

export function readEditorDraft(storage: Pick<Storage, 'getItem'>, key: string, type: 'post' | 'page', postId: number): EditorDraft | null {
  try {
    const raw = storage.getItem(key);
    if (!raw || raw.length > MAX_RECORD_LENGTH) return null;
    const draft = parseDraft(JSON.parse(raw));
    return draft && draft.content.post.id === postId && draft.content.post.type === type ? draft : null;
  } catch { return null; }
}

export function writeEditorDraft(storage: Pick<Storage, 'setItem'>, key: string, draft: EditorDraft): boolean {
  try {
    const validated = parseDraft(draft);
    if (!validated) return false;
    const serialized = JSON.stringify(validated);
    if (serialized.length > MAX_RECORD_LENGTH) return false;
    storage.setItem(key, serialized);
    return true;
  } catch { return false; }
}

export function removeEditorDraft(storage: Pick<Storage, 'removeItem'>, key: string): boolean {
  try { storage.removeItem(key); return true; }
  catch { return false; }
}

export function contentFingerprint({ post, tags }: EditorDraftContent): string {
  return JSON.stringify({
    title: post.title, slug: post.slug, content: post.content, excerpt: post.excerpt,
    createdAt: post.createdAt, status: post.status, type: post.type, category: post.category,
    categories: post.categories ?? (post.category ? [post.category] : []), tags: post.tags,
    cover: post.cover, allowComment: post.allowComment, pinned: post.pinned, format: post.format,
    tagsInput: tags,
  });
}
