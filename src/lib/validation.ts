import { z } from 'zod';
import { DEFAULT_HERO_IMAGE, DEFAULT_HERO_IMAGE_ALT, isBrandingImageSource } from './branding';
import { normalizeSpotifyUri } from './spotify';
import { DEFAULT_LABELS, DEFAULT_NAVIGATION, DEFAULT_SIDEBAR_LINKS, isSafeSiteLink } from './site-customization';
const siteLink=z.string().trim().min(1).max(2048).refine(isSafeSiteLink,'请使用本站路径、HTTP(S) 地址、锚点或邮件地址');
const linkFields={id:z.string().min(1).max(80),label:z.string().trim().min(1).max(80),href:siteLink,newTab:z.boolean()};
const navigationItems=z.array(z.object({...linkFields,visible:z.boolean()}).strict()).max(20).refine(items=>new Set(items.map(i=>i.id)).size===items.length,'链接编号不能重复');
const footerLinks=z.array(z.object(linkFields).strict()).max(20).refine(items=>new Set(items.map(i=>i.id)).size===items.length,'链接编号不能重复');
const labelShape=Object.fromEntries(Object.entries(DEFAULT_LABELS).map(([key,value])=>[key,z.string().trim().min(1).max(key==='searchPlaceholder'?100:60).default(value)])) as {[K in keyof typeof DEFAULT_LABELS]:z.ZodDefault<z.ZodString>};
const safeUrl = z.string().max(2048).refine(v=>!v || /^\/(?!\/)/.test(v) || /^https?:\/\//i.test(v),'仅允许 HTTP(S) 或本站相对地址');
const slug = z.string().trim().min(1).max(180).refine(v=>!/[/?#\\\u0000-\u001f]/.test(v)&&v!=='.'&&v!=='..','链接标识包含无效字符');
export const postSchema=z.object({
 title:z.string().trim().min(1).max(300),slug,content:z.string().max(1_000_000),excerpt:z.string().max(5000).optional(),
 createdAt:z.number().int().nonnegative().optional(),status:z.enum(['publish','draft','private']),type:z.enum(['post','page']),
 category:z.string().max(100).optional(),categories:z.array(z.string().trim().min(1).max(100)).max(30).optional(),tags:z.array(z.string().trim().min(1).max(100)).max(50).optional(),cover:safeUrl.optional(),
 allowComment:z.boolean().optional(),pinned:z.boolean().optional(),format:z.enum(['markdown','mdx']).optional(),
});
export const taxonomySchema=z.object({name:z.string().trim().min(1).max(100),slug,type:z.enum(['category','tag']),description:z.string().max(2000).default('')});
export const commentSchema=z.object({postId:z.number().int().positive(),parentId:z.number().int().nonnegative().default(0),author:z.string().trim().min(1).max(80),email:z.union([z.email(),z.literal('')]).optional(),url:safeUrl.optional(),content:z.string().trim().min(1).max(10000)});
export const credentialsSchema=z.object({username:z.string().trim().min(3).max(64),password:z.string().min(12).max(256),setupToken:z.string().max(256).optional()});
export const settingsSchema=z.object({
 title:z.string().trim().min(1).max(100),subtitle:z.string().max(300),description:z.string().max(2000),author:z.string().trim().min(1).max(100),avatar:safeUrl,
 logo:z.string().max(2048).refine(v=>!v||isBrandingImageSource(v),'图标请使用本站路径或 HTTPS 图片地址').default(''),
 siteUrl:z.string().max(2048).refine(v=>!v||/^https?:\/\//i.test(v),'站点地址必须为HTTP(S)'),accentColor:z.string().regex(/^#[0-9a-f]{6}$/i),background:safeUrl,
 backgroundOpacity:z.number().min(0).max(1),layout:z.enum(['magazine','compact']),colorMode:z.enum(['light','dark','system']),
 heroTitle:z.string().max(300),heroSubtitle:z.string().max(1000),
 heroImage:z.string().max(2048).refine(v=>!v||isBrandingImageSource(v),'首页图片请使用本站路径或 HTTPS 地址').default(DEFAULT_HERO_IMAGE),
 heroImageAlt:z.string().max(300).default(DEFAULT_HERO_IMAGE_ALT),
 announcement:z.string().max(2000),musicEnabled:z.boolean(),
 spotifyUri:z.string().trim().max(2048).default('').transform((value,ctx)=>{const uri=normalizeSpotifyUri(value);if(uri===null){ctx.addIssue({code:'custom',message:'请填写有效的 Spotify 分享链接或 URI'});return z.NEVER;}return uri;}),
 musicPlaylistId:z.string().regex(/^(?:\d{1,20})?$/),
 musicApi:z.string().max(2048).refine(v=>v==='https://api.i-meto.com/meting/api','音乐接口仅支持受信任的 Meting 接口'),
 tracks:z.array(z.object({id:z.string().max(100),title:z.string().max(300),artist:z.string().max(300),url:safeUrl,cover:safeUrl})).max(100),
 commentsEnabled:z.boolean(),commentModeration:z.boolean(),footer:z.string().max(2000),
 navigation:navigationItems.default(DEFAULT_NAVIGATION),sidebarLinks:navigationItems.default(DEFAULT_SIDEBAR_LINKS),footerLinks:footerLinks.default([]),
 footerSecondary:z.string().max(2000).default(''),footerCopyright:z.string().max(500).default('© {year} {author}'),
 footerShowBrand:z.boolean().default(true),footerShowCopyright:z.boolean().default(true),footerShowRss:z.boolean().default(true),footerShowAdmin:z.boolean().default(true),footerAlign:z.enum(['spread','center']).default('spread'),
 showSearch:z.boolean().default(true),showThemeToggle:z.boolean().default(true),showReadingSettings:z.boolean().default(true),showBackToTop:z.boolean().default(true),
 homeShowAuthorCard:z.boolean().default(true),homeShowSidebarLinks:z.boolean().default(true),homeShowAnnouncement:z.boolean().default(true),
 heroShowPrimaryButton:z.boolean().default(true),heroShowSecondaryButton:z.boolean().default(true),heroPrimaryHref:siteLink.default('#journal'),heroSecondaryHref:siteLink.default('/about'),
 labels:z.object(labelShape).strict().default(DEFAULT_LABELS),
 bangumiEnabled:z.boolean().default(true),bangumiTitle:z.string().trim().min(1).max(100).default('我的追番'),bangumiDescription:z.string().max(1000).default(''),bangumiDefaultStatus:z.union([z.literal('all'),z.literal(1),z.literal(2),z.literal(3),z.literal(4),z.literal(5)]).default(3),
});
export class HttpError extends Error { constructor(public status:number,message:string){super(message);} }
export function parseId(id:string){if(!/^\d+$/.test(id)||Number(id)<1||!Number.isSafeInteger(Number(id)))throw new HttpError(400,'无效的编号');return Number(id);}
export async function readJson(request:Request,maxBytes=2_000_000):Promise<unknown>{
 const size=Number(request.headers.get('content-length')||0);if(size>maxBytes)throw new HttpError(413,'请求内容过大');
 if(!request.headers.get('content-type')?.includes('application/json'))throw new HttpError(415,'请使用JSON格式');
 if(!request.body)throw new HttpError(400,'请求内容不能为空');
 const reader=request.body.getReader();const chunks:Uint8Array[]=[];let bytes=0;
 while(true){const {done,value}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>maxBytes){await reader.cancel();throw new HttpError(413,'请求内容过大');}chunks.push(value);}
 try{return JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw new HttpError(400,'JSON格式无效');}
}
export function apiError(error:unknown):Response {
 if(error instanceof z.ZodError)return Response.json({error:error.issues.map(i=>`${i.path.join('.')}: ${i.message}`).join('；')},{status:400});
 if(error instanceof HttpError)return Response.json({error:error.message},{status:error.status});
 if(error instanceof Error && /UNIQUE constraint/.test(error.message))return Response.json({error:'链接标识已存在，请换一个'},{status:409});
 console.error('API error',error instanceof Error?error.message:'unknown');return Response.json({error:'服务器处理失败，请稍后重试'},{status:500});
}
