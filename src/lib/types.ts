import type { NavigationItem, FooterLink, SiteLabels } from './site-customization';
export type { NavigationItem, FooterLink, SiteLabels } from './site-customization';
export type Post = {
  id: number; title: string; slug: string; content: string; excerpt: string;
  createdAt: number; updatedAt: number; status: 'publish' | 'draft' | 'private';
  type: 'post' | 'page'; category: string; categories?: string[]; tags: string[]; cover: string;
  views: number; allowComment: boolean; pinned: boolean; format: 'markdown' | 'mdx';
};
export type Comment = {
  id: number; postId: number; parentId: number; author: string; email?: string; url?: string;
  content: string; createdAt: number; status: 'approved' | 'waiting' | 'spam';
};
export type Track = { id: string; title: string; artist: string; url: string; cover: string; };
export type SiteSettings = {
  title: string; subtitle: string; description: string; author: string; avatar: string; logo: string;
  siteUrl: string; accentColor: string; background: string; backgroundOpacity: number;
  layout: 'magazine' | 'compact'; colorMode: 'light' | 'dark' | 'system';
  heroTitle: string; heroSubtitle: string; heroImage: string; heroImageAlt: string; announcement: string;
  musicEnabled: boolean; spotifyUri: string; musicPlaylistId: string; musicApi: string; tracks: Track[];
  commentsEnabled: boolean; commentModeration: boolean; footer: string;
  navigation: NavigationItem[]; sidebarLinks: NavigationItem[]; footerLinks: FooterLink[];
  footerSecondary: string; footerCopyright: string; footerShowBrand: boolean; footerShowCopyright: boolean;
  footerShowRss: boolean; footerShowAdmin: boolean; footerAlign: 'spread' | 'center';
  showSearch: boolean; showThemeToggle: boolean; showReadingSettings: boolean; showBackToTop: boolean;
  homeShowAuthorCard: boolean; homeShowSidebarLinks: boolean; homeShowAnnouncement: boolean;
  heroShowPrimaryButton: boolean; heroShowSecondaryButton: boolean; heroPrimaryHref: string; heroSecondaryHref: string;
  labels: SiteLabels;
  bangumiEnabled: boolean; bangumiTitle: string; bangumiDescription: string; bangumiDefaultStatus: 'all' | 1 | 2 | 3 | 4 | 5;
};
export type Media = { id: number; name: string; url: string; mime: string; size: number; createdAt: number };
export type Taxonomy = { id: number; name: string; slug: string; type: 'category' | 'tag'; description: string };
export type DashboardData = {
  posts: Post[]; comments: Comment[]; settings: SiteSettings; media: Media[]; taxonomies: Taxonomy[];
  stats: { posts: number; comments: number; views: number; drafts: number };
};
