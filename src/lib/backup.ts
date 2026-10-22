import { z } from 'zod';
import type Database from 'better-sqlite3';
import { postSchema,settingsSchema,taxonomySchema } from './validation';
const id=z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const integer=z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const jsonString=z.string().max(5_000_000).refine(value=>{try{JSON.parse(value);return true;}catch{return false;}},'JSON字段格式无效');
const recordJson=jsonString.refine(value=>{const object=JSON.parse(value);return object&&typeof object==='object'&&!Array.isArray(object);},'JSON字段必须是对象');
const localMedia=z.string().max(2048).refine(value=>{
 try{
  const decoded=decodeURIComponent(value);
  return /^\/(?:uploads\/|usr\/(?:picture|File|uploads)\/)/.test(decoded)&&!decoded.split('/').some(part=>part==='.'||part==='..')&&!/[\\?#\u0000-\u001f]/.test(decoded);
 }catch{return false;}
},'媒体路径必须位于本站public/usr或public/uploads目录');
const postRow=z.object({
 id,title:z.string().min(1).max(300),slug:z.string().min(1).max(180),content:z.string().max(1_000_000),excerpt:z.string().max(5000),created_at:integer,updated_at:integer,
 status:z.enum(['publish','draft','private']),type:z.enum(['post','page']),category:z.string().max(100),tags:jsonString.refine(value=>z.array(z.string().min(1).max(100)).max(50).safeParse(JSON.parse(value)).success),
 cover:z.string().max(2048),views:integer,allow_comment:z.union([z.literal(0),z.literal(1)]),pinned:z.union([z.literal(0),z.literal(1)]),format:z.enum(['markdown','mdx']),legacy_content:z.string().max(2_000_000).nullable(),legacy_fields:recordJson,
}).strict().superRefine((row,ctx)=>{
 const validated=postSchema.safeParse({title:row.title,slug:row.slug,content:row.content,excerpt:row.excerpt,createdAt:row.created_at,status:row.status,type:row.type,category:row.category,tags:JSON.parse(row.tags),cover:row.cover,allowComment:!!row.allow_comment,pinned:!!row.pinned,format:row.format});
 if(!validated.success)ctx.addIssue({code:'custom',message:'文章字段包含无效链接或数据'});
});
const commentRow=z.object({id,post_id:id,parent_id:integer,author:z.string().min(1).max(80),email:z.string().max(320),url:z.string().max(2048),content:z.string().min(1).max(10000),created_at:integer,status:z.enum(['approved','waiting','spam'])}).strict().refine(row=>!row.url||/^https?:\/\//i.test(row.url)||/^\/(?!\/)/.test(row.url),'评论链接无效');
const taxonomyRow=taxonomySchema.extend({id}).strict();
const settingsRow=z.object({id:z.literal(1),value:jsonString.refine(value=>settingsSchema.strict().safeParse(JSON.parse(value)).success,'站点设置格式无效')}).strict();
const mediaRow=z.object({id,name:z.string().min(1).max(255),url:localMedia,mime:z.string().max(150).regex(/^[\w.+-]+\/[\w.+-]+$/),size:integer,created_at:integer}).strict();
export const backupSchema=z.object({
 version:z.literal(1),exportedAt:z.iso.datetime(),tables:z.object({
  posts:z.array(postRow).max(100000),comments:z.array(commentRow).max(1000000),taxonomies:z.array(taxonomyRow).max(10000),
  post_taxonomies:z.array(z.object({post_id:id,taxonomy_id:id}).strict()).max(1000000),settings:z.array(settingsRow).length(1),
  media:z.array(mediaRow).max(100000),legacy_records:z.array(z.object({table_name:z.enum(['typecho_contents','typecho_comments','typecho_fields','typecho_metas','typecho_options','typecho_relationships','typecho_users']),row_id:integer,value:recordJson}).strict()).max(1000000),
 }).strict(),
}).strict().superRefine(({tables},ctx)=>{
 function fail(message:string){ctx.addIssue({code:'custom',message});}
 for(const table of ['posts','comments','taxonomies','media'] as const){const ids=tables[table].map(row=>row.id);if(new Set(ids).size!==ids.length)fail(`${table}包含重复编号`);}
 if(new Set(tables.posts.map(row=>row.slug)).size!==tables.posts.length)fail('文章链接标识重复');
 if(new Set(tables.taxonomies.map(row=>`${row.type}:${row.slug}`)).size!==tables.taxonomies.length)fail('分类标签标识重复');
 if(new Set(tables.media.map(row=>row.url)).size!==tables.media.length)fail('媒体路径重复');
 const posts=new Set(tables.posts.map(row=>row.id)),taxonomy=new Set(tables.taxonomies.map(row=>row.id)),comments=new Map(tables.comments.map(row=>[row.id,row]));
 for(const relation of tables.post_taxonomies)if(!posts.has(relation.post_id)||!taxonomy.has(relation.taxonomy_id))fail('分类关系引用不存在的文章或分类');
 if(new Set(tables.post_taxonomies.map(row=>`${row.post_id}:${row.taxonomy_id}`)).size!==tables.post_taxonomies.length)fail('分类关系重复');
 if(new Set(tables.legacy_records.map(row=>`${row.table_name}:${row.row_id}`)).size!==tables.legacy_records.length)fail('原始数据行重复');
 for(const comment of tables.comments){
  if(!posts.has(comment.post_id))fail('评论引用不存在的文章');
  if(comment.parent_id&&comments.get(comment.parent_id)?.post_id!==comment.post_id)fail('评论回复引用无效');
  const visited=new Set<number>();let parent=comment;
  while(parent.parent_id){if(visited.has(parent.id)){fail('评论存在循环回复');break;}visited.add(parent.id);const next=comments.get(parent.parent_id);if(!next)break;parent=next;}
 }
});
export type BlogBackup=z.infer<typeof backupSchema>;
const columns={
 posts:['id','title','slug','content','excerpt','created_at','updated_at','status','type','category','tags','cover','views','allow_comment','pinned','format','legacy_content','legacy_fields'],
 comments:['id','post_id','parent_id','author','email','url','content','created_at','status'],taxonomies:['id','name','slug','type','description'],
 post_taxonomies:['post_id','taxonomy_id'],settings:['id','value'],media:['id','name','url','mime','size','created_at'],legacy_records:['table_name','row_id','value'],
} as const;
export function restoreBackup(db:Database.Database,input:unknown){
 const backup=backupSchema.parse(input);
 db.transaction(()=>{
  for(const table of ['post_taxonomies','comments','posts','taxonomies','settings','media','legacy_records'])db.prepare(`DELETE FROM ${table}`).run();
  for(const table of ['posts','taxonomies','comments','post_taxonomies','settings','media','legacy_records'] as const){
   const names=columns[table];const statement=db.prepare(`INSERT INTO ${table}(${names.join(',')}) VALUES(${names.map(()=>'?').join(',')})`);
   for(const row of backup.tables[table])statement.run(...names.map(name=>(row as Record<string,unknown>)[name]));
  }
  if((db.pragma('foreign_key_check') as unknown[]).length)throw new Error('恢复后数据库引用检查失败');
 })();
 return {posts:backup.tables.posts.length,comments:backup.tables.comments.length,media:backup.tables.media.length};
}
