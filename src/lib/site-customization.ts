export type NavigationItem = { id: string; label: string; href: string; visible: boolean; newTab: boolean };
export type FooterLink = { id: string; label: string; href: string; newTab: boolean };

export const DEFAULT_LABELS = {
  browsePosts: '浏览文章', aboutMe: '关于我', loadMore: '加载更多', postListTitle: '文章', allCategories: '全部',
  archiveTitle: '文章归档', aboutTitle: '关于', musicTitle: '音乐',
  search: '搜索', searchPlaceholder: '搜索文章或分类', readSettings: '阅读设置', backToTop: '回到顶部',
  musicOpen: '打开播放器', musicClose: '收起播放器', musicPlay: '播放音乐', musicPause: '暂停音乐',
  commentsTitle: '评论', commentSubmit: '提交评论', commentSubmitting: '提交中…', commentReply: '回复',
  previousPost: '上一篇', nextPost: '下一篇', copyLink: '复制链接', linkCopied: '已复制', tableOfContents: '文章目录',
  bangumiSync: '同步', bangumiSyncing: '同步中…', rss: 'RSS', admin: '管理',
};
export type SiteLabels = { [K in keyof typeof DEFAULT_LABELS]: string };
export const LABEL_FIELDS: { key: keyof SiteLabels; label: string }[] = [
  { key: 'browsePosts', label: '首页主按钮' }, { key: 'aboutMe', label: '首页副按钮 / 作者详情' },
  { key: 'loadMore', label: '加载更多文章' }, { key: 'postListTitle', label: '文章列表标题' }, { key: 'allCategories', label: '全部分类' },
  { key: 'archiveTitle', label: '归档页标题' }, { key: 'aboutTitle', label: '关于页标题前缀' }, { key: 'musicTitle', label: '音乐页标题' },
  { key: 'search', label: '搜索按钮' }, { key: 'searchPlaceholder', label: '搜索框提示' }, { key: 'readSettings', label: '阅读设置入口' }, { key: 'backToTop', label: '回到顶部' },
  { key: 'musicOpen', label: '打开音乐播放器' }, { key: 'musicClose', label: '收起音乐播放器' }, { key: 'musicPlay', label: '播放音乐' }, { key: 'musicPause', label: '暂停音乐' },
  { key: 'commentsTitle', label: '评论区标题' }, { key: 'commentSubmit', label: '提交评论' }, { key: 'commentSubmitting', label: '评论提交中' }, { key: 'commentReply', label: '回复评论' },
  { key: 'previousPost', label: '上一篇文章' }, { key: 'nextPost', label: '下一篇文章' }, { key: 'copyLink', label: '复制文章链接' }, { key: 'linkCopied', label: '链接复制成功' }, { key: 'tableOfContents', label: '文章目录标题' },
  { key: 'bangumiSync', label: '同步追番' }, { key: 'bangumiSyncing', label: '追番同步中' }, { key: 'rss', label: '页脚 RSS 链接' }, { key: 'admin', label: '页脚管理入口' },
];
export const DEFAULT_NAVIGATION: NavigationItem[] = [
  { id: 'home', label: '首页', href: '/', visible: true, newTab: false },
  { id: 'archives', label: '归档', href: '/archives', visible: true, newTab: false },
  { id: 'bangumi', label: '追番', href: '/bangumi', visible: true, newTab: false },
  { id: 'music', label: '音乐', href: '/music', visible: true, newTab: false },
  { id: 'about', label: '关于', href: '/about', visible: true, newTab: false },
];
export const DEFAULT_SIDEBAR_LINKS: NavigationItem[] = [
  { id: 'archives', label: '文章归档', href: '/archives', visible: true, newTab: false },
  { id: 'bangumi', label: '我的追番', href: '/bangumi', visible: true, newTab: false },
  { id: 'music', label: '音乐', href: '/music', visible: true, newTab: false },
  { id: 'rss', label: 'RSS 订阅', href: '/feed.xml', visible: true, newTab: false },
];

/** Links are rendered as text; arbitrary HTML and executable URL schemes are never accepted. */
export function isSafeSiteLink(value: string): boolean {
  if (!value || value !== value.trim() || /[\\\u0000-\u001f\u007f]/.test(value)) return false;
  if (value.startsWith('#')) return value.length > 1;
  if (value.startsWith('/')) return !value.startsWith('//');
  if (/^mailto:/i.test(value)) return /^mailto:[^\s@?]+@[^\s@?]+\.[^\s@?]+$/i.test(value);
  try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) && !!url.hostname && !url.username && !url.password; }
  catch { return false; }
}
export function isInternalSiteLink(href: string): boolean { return href.startsWith('/') && !href.startsWith('//'); }
export function formatCopyright(template: string, author: string, year = new Date().getFullYear()): string {
  return template.replace(/\{(year|author)\}/g, (_, key) => key === 'year' ? String(year) : author);
}
export function visibleSiteLinks(items: NavigationItem[], bangumiEnabled: boolean): NavigationItem[] {
  return items.filter(item => item.visible && isSafeSiteLink(item.href) && (bangumiEnabled || !/^\/bangumi(?:[/?#]|$)/.test(item.href)));
}
