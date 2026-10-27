import type { Post } from './types';
import { encodePathSegment } from './urls';
export { cleanExcerpt, postExcerpt } from './excerpts';
export const date = (timestamp: number, short = false) => new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', year: short ? undefined : 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(timestamp * 1000));
export const readTime = (content: string) => Math.max(1, Math.ceil(content.replace(/<[^>]*>|[#*`~]/g, '').length / 450));
export const postUrl = (post: Pick<Post, 'slug' | 'type'>) => `/${post.type === 'page' ? 'pages' : 'posts'}/${encodePathSegment(post.slug)}`;
export const coverFallbacks = ['/images/hero.svg'];
export const coverFor = (post: Post) => post.cover || coverFallbacks[post.id % coverFallbacks.length];
export const headingId = (value: string) => value.toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, '').trim().replace(/\s+/g, '-');
