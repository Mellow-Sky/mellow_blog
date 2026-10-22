import Database from 'better-sqlite3';
import { chmodSync, mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type { Comment, DashboardData, Media, Post, SiteSettings, Taxonomy } from './types';
import { DEFAULT_HERO_IMAGE, DEFAULT_HERO_IMAGE_ALT } from './branding';
import { DEFAULT_LABELS, DEFAULT_NAVIGATION, DEFAULT_SIDEBAR_LINKS } from './site-customization';

export const DEFAULT_SETTINGS: SiteSettings = {
  title: '我的博客', subtitle: '记录生活 · 分享所学', description: '欢迎来到我的博客。',
  author: '博主', avatar: '/avatar.svg', logo: '', siteUrl: '', accentColor: '#6cb9cc', background: '', backgroundOpacity: 0.18,
  layout: 'magazine', colorMode: 'system', heroTitle: '记录生活，\n分享所学。', heroSubtitle: '代码、音乐与日常。',
  heroImage: DEFAULT_HERO_IMAGE, heroImageAlt: DEFAULT_HERO_IMAGE_ALT,
  announcement: '', musicEnabled: false, spotifyUri: '', musicPlaylistId: '', musicApi: 'https://api.i-meto.com/meting/api', tracks: [],
  commentsEnabled: true, commentModeration: true, footer: '记录与分享。',
  navigation: DEFAULT_NAVIGATION, sidebarLinks: DEFAULT_SIDEBAR_LINKS, footerLinks: [],
  footerSecondary: '', footerCopyright: '© {year} {author}', footerShowBrand: true, footerShowCopyright: true,
  footerShowRss: true, footerShowAdmin: true, footerAlign: 'spread',
  showSearch: true, showThemeToggle: true, showReadingSettings: true, showBackToTop: true,
  homeShowAuthorCard: true, homeShowSidebarLinks: true, homeShowAnnouncement: true,
  heroShowPrimaryButton: true, heroShowSecondaryButton: true, heroPrimaryHref: '#journal', heroSecondaryHref: '/about',
  labels: DEFAULT_LABELS,
  bangumiEnabled: true, bangumiTitle: '我的追番', bangumiDescription: '', bangumiDefaultStatus: 3,
};
let connection: Database.Database | undefined;
export function getDb() {
  if (connection) return connection;
  const filename = process.env.DATABASE_PATH || path.join(process.cwd(), 'data', 'blog.db');
  mkdirSync(path.dirname(filename), { recursive: true, mode: 0o700 });
  connection = new Database(filename);
  chmodSync(filename, 0o600);
  connection.pragma('journal_mode = WAL');
  connection.pragma('foreign_keys = ON');
  connection.pragma('busy_timeout = 5000');
  connection.exec(readFileSync(path.join(process.cwd(), 'scripts', 'schema.sql'), 'utf8'));
  connection.prepare('INSERT OR IGNORE INTO settings(id,value) VALUES(1,?)').run(JSON.stringify(DEFAULT_SETTINGS));
  return connection;
}
type Row = Record<string, any>;
const POST_SELECT="SELECT p.*, (SELECT json_group_array(name) FROM (SELECT t.name FROM post_taxonomies pt JOIN taxonomies t ON t.id=pt.taxonomy_id WHERE pt.post_id=p.id AND t.type='category' ORDER BY t.id)) AS category_names FROM posts p";
function postFromRow(r: Row): Post {
  const stored=JSON.parse(r.category_names||'[]') as string[];
  const categories=[...new Set([r.category,...stored].filter(Boolean))] as string[];
  return { id:r.id, title:r.title, slug:r.slug, content:r.content, excerpt:r.excerpt, createdAt:r.created_at, updatedAt:r.updated_at,
    status:r.status, type:r.type, category:categories[0]||'', categories, tags:JSON.parse(r.tags), cover:r.cover, views:r.views,
    allowComment:!!r.allow_comment, pinned:!!r.pinned, format:r.format };
}
function commentFromRow(r: Row, privateData = false): Comment {
  return { id:r.id, postId:r.post_id, parentId:r.parent_id, author:r.author, ...(privateData ? { email:r.email } : {}), url:r.url,
    content:r.content, createdAt:r.created_at, status:r.status };
}
export function getPosts(options: {includeDrafts?:boolean;type?:'post'|'page'|'all'} = {}): Post[] {
  const type = options.type || 'post';
  return (getDb().prepare(`${POST_SELECT} WHERE ${options.includeDrafts ? '1=1' : "p.status='publish'"}${type==='all'?'':' AND p.type=?'} ORDER BY p.pinned DESC,p.created_at DESC`).all(...(type==='all'?[]:[type])) as Row[]).map(postFromRow);
}
export function getPost(slug: string, includeDrafts = false): Post | null {
  const row=getDb().prepare(`${POST_SELECT} WHERE p.slug=?${includeDrafts?'':" AND p.status='publish'"}`).get(slug) as Row|undefined;
  return row ? postFromRow(row) : null;
}
export function getPostById(id: number, includeDrafts = false): Post | null {
  const row=getDb().prepare(`${POST_SELECT} WHERE p.id=?${includeDrafts?'':" AND p.status='publish'"}`).get(id) as Row|undefined;
  return row ? postFromRow(row) : null;
}
export function getComments(postId: number): Comment[] {
  return (getDb().prepare("SELECT c.* FROM comments c JOIN posts p ON p.id=c.post_id WHERE c.post_id=? AND c.status='approved' AND p.status='publish' ORDER BY c.created_at,c.id").all(postId) as Row[]).map(r=>commentFromRow(r));
}
export function getAllComments(): Comment[] { return (getDb().prepare('SELECT * FROM comments ORDER BY created_at DESC').all() as Row[]).map(r=>commentFromRow(r,true)); }
export function getSettings(): SiteSettings {
  const r=getDb().prepare('SELECT value FROM settings WHERE id=1').get() as Row;
  const stored = JSON.parse(r.value);
  const settings: SiteSettings = {...DEFAULT_SETTINGS,...stored,labels:{...DEFAULT_LABELS,...stored.labels}};
  return settings;
}
export function saveSettings(settings: SiteSettings): SiteSettings { getDb().prepare('UPDATE settings SET value=? WHERE id=1').run(JSON.stringify(settings)); return getSettings(); }
export function getTaxonomies(): Taxonomy[] { return getDb().prepare('SELECT * FROM taxonomies ORDER BY type,name').all() as Taxonomy[]; }
export function getMedia(): Media[] { return (getDb().prepare('SELECT * FROM media ORDER BY created_at DESC').all() as Row[]).map(r=>({id:r.id,name:r.name,url:r.url,mime:r.mime,size:r.size,createdAt:r.created_at})); }
export function getDashboard(): DashboardData {
  const posts=getPosts({includeDrafts:true,type:'all'}), comments=getAllComments();
  return { posts,comments,settings:getSettings(),media:getMedia(),taxonomies:getTaxonomies(),stats:{ posts:posts.filter(p=>p.type==='post'&&p.status==='publish').length,comments:comments.length,views:posts.reduce((n,p)=>n+p.views,0),drafts:posts.filter(p=>p.status==='draft').length } };
}
export function savePost(input: Partial<Post>, id?: number): Post {
  const db=getDb(); const existing=id?getPostById(id,true):null;
  if(id&&!existing) throw new Error('文章不存在');
  const now=Math.floor(Date.now()/1000);
  const p={title:'未命名文章',slug:`post-${Date.now()}`,content:'',excerpt:'',createdAt:now,updatedAt:now,status:'draft',type:'post',category:'',tags:[],cover:'',views:0,allowComment:true,pinned:false,format:'markdown',...existing,...input} as Post;
  let categories=input.categories;
  if(categories===undefined){
    const previous=existing?.categories||[];
    categories=existing&&input.category!==undefined&&input.category!==existing.category?[input.category,...previous.filter(name=>name!==existing.category)]:[p.category,...previous];
  }
  p.categories=[...new Set(categories.filter(Boolean))];p.category=p.categories[0]||'';
  p.updatedAt=now;
  const values=[p.title,p.slug,p.content,p.excerpt,p.createdAt,p.updatedAt,p.status,p.type,p.category,JSON.stringify(p.tags),p.cover,p.views,+p.allowComment,+p.pinned,p.format];
  return db.transaction(()=>{
    let postId=id;
    if(postId) db.prepare('UPDATE posts SET title=?,slug=?,content=?,excerpt=?,created_at=?,updated_at=?,status=?,type=?,category=?,tags=?,cover=?,views=?,allow_comment=?,pinned=?,format=? WHERE id=?').run(...values,postId);
    else postId=Number(db.prepare('INSERT INTO posts(title,slug,content,excerpt,created_at,updated_at,status,type,category,tags,cover,views,allow_comment,pinned,format) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(...values).lastInsertRowid);
    db.prepare('DELETE FROM post_taxonomies WHERE post_id=?').run(postId);
    for(const [type,names] of [['category',p.categories||[]],['tag',p.tags]] as const) for(const name of names){
      let taxonomy=db.prepare('SELECT id FROM taxonomies WHERE name=? AND type=?').get(name,type) as {id:number}|undefined;
      if(!taxonomy){
        const base=name.normalize('NFKC').trim().toLowerCase().replace(/[/?#\\\s]+/g,'-').replace(/^\.+$/,'').slice(0,140)||type;let slug=base,index=2;
        while(db.prepare('SELECT id FROM taxonomies WHERE slug=? AND type=?').get(slug,type))slug=`${base}-${index++}`;
        taxonomy={id:Number(db.prepare('INSERT INTO taxonomies(name,slug,type,description) VALUES(?,?,?,?)').run(name,slug,type,'').lastInsertRowid)};
      }
      db.prepare('INSERT OR IGNORE INTO post_taxonomies(post_id,taxonomy_id) VALUES(?,?)').run(postId,taxonomy.id);
    }
    return getPostById(postId!,true)!;
  })();
}
export function createComment(input: Omit<Comment,'id'|'createdAt'>): Comment {
 const db=getDb();
 const result=db.prepare('INSERT INTO comments(post_id,parent_id,author,email,url,content,created_at,status) VALUES(?,?,?,?,?,?,?,?)').run(input.postId,input.parentId,input.author,input.email||'',input.url||'',input.content,Math.floor(Date.now()/1000),input.status);
 return commentFromRow(db.prepare('SELECT * FROM comments WHERE id=?').get(result.lastInsertRowid) as Row,true);
}
export function exportBackup() {
 const db=getDb(); const tables=['posts','comments','taxonomies','post_taxonomies','settings','media','legacy_records'];
 return { version:1,exportedAt:new Date().toISOString(),tables:Object.fromEntries(tables.map(t=>[t,db.prepare(`SELECT * FROM ${t}`).all()])) };
}
