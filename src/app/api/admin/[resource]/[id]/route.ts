import { lstat,unlink } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { assertSameOrigin,requireAdmin } from '@/lib/auth';
import { getAllComments,getDb,getMedia,getPostById,getTaxonomies,savePost } from '@/lib/db';
import { apiError,HttpError,parseId,postSchema,readJson,taxonomySchema } from '@/lib/validation';
export const runtime='nodejs';
export const dynamic='force-dynamic';
type Context={params:Promise<{resource:string;id:string}>};
export async function GET(_request:Request,context:Context){try{await requireAdmin();const {resource,id}=await context.params;if(resource!=='posts')throw new HttpError(404,'接口不存在');const post=getPostById(parseId(id),true);if(!post)throw new HttpError(404,'文章不存在');return Response.json({post},{headers:{'Cache-Control':'no-store'}});}catch(error){return apiError(error);}}
export async function PUT(request:Request,context:Context){
 try{assertSameOrigin(request);await requireAdmin();const params=await context.params;const id=parseId(params.id),db=getDb();
  if(params.resource==='posts'){const old=getPostById(id,true);if(!old)throw new HttpError(404,'文章不存在');const raw=await readJson(request) as Record<string,unknown>;const input=postSchema.parse({...old,...raw});if(!Object.prototype.hasOwnProperty.call(raw,'categories'))delete input.categories;return Response.json({post:savePost(input,id)});}
  if(params.resource==='comments'){const {status}=z.object({status:z.enum(['approved','waiting','spam'])}).parse(await readJson(request));const result=db.prepare('UPDATE comments SET status=? WHERE id=?').run(status,id);if(!result.changes)throw new HttpError(404,'评论不存在');return Response.json({comment:getAllComments().find(c=>c.id===id)});}
  if(params.resource==='taxonomies'){
   const old=getTaxonomies().find(t=>t.id===id);if(!old)throw new HttpError(404,'分类或标签不存在');const t=taxonomySchema.parse({...old,...await readJson(request) as object});
   db.transaction(()=>{
    db.prepare('UPDATE taxonomies SET name=?,slug=?,type=?,description=? WHERE id=?').run(t.name,t.slug,t.type,t.description,id);
    if(old.type==='category')db.prepare('UPDATE posts SET category=? WHERE category=?').run(t.type==='category'?t.name:'',old.name);
    else for(const p of db.prepare('SELECT id,tags FROM posts').all() as {id:number;tags:string}[]){const tags=JSON.parse(p.tags) as string[];if(tags.includes(old.name))db.prepare('UPDATE posts SET tags=? WHERE id=?').run(JSON.stringify(tags.flatMap(name=>name===old.name?(t.type==='tag'?[t.name]:[]):[name])),p.id);}
    if(t.type!==old.type)db.prepare('DELETE FROM post_taxonomies WHERE taxonomy_id=?').run(id);
   })();return Response.json({taxonomy:{...t,id}});
  }
  throw new HttpError(404,'接口不存在');
 }catch(error){return apiError(error);}
}
export const PATCH=PUT;
export async function DELETE(request:Request,context:Context){
 try{assertSameOrigin(request);await requireAdmin();const params=await context.params;const id=parseId(params.id),db=getDb();
  if(params.resource==='posts'){if(!db.prepare('DELETE FROM posts WHERE id=?').run(id).changes)throw new HttpError(404,'文章不存在');return Response.json({ok:true});}
  if(params.resource==='comments'){
   const comment=getAllComments().find(c=>c.id===id);if(!comment)throw new HttpError(404,'评论不存在');db.transaction(()=>{db.prepare('UPDATE comments SET parent_id=? WHERE parent_id=?').run(comment.parentId,id);db.prepare('DELETE FROM comments WHERE id=?').run(id);})();return Response.json({ok:true});
  }
  if(params.resource==='taxonomies'){
   const t=getTaxonomies().find(t=>t.id===id);if(!t)throw new HttpError(404,'分类或标签不存在');
   db.transaction(()=>{if(t.type==='category')db.prepare('UPDATE posts SET category=? WHERE category=?').run('',t.name);else for(const p of db.prepare('SELECT id,tags FROM posts').all() as {id:number;tags:string}[])db.prepare('UPDATE posts SET tags=? WHERE id=?').run(JSON.stringify((JSON.parse(p.tags) as string[]).filter(n=>n!==t.name)),p.id);db.prepare('DELETE FROM taxonomies WHERE id=?').run(id);})();return Response.json({ok:true});
  }
  if(params.resource==='media'){
   const media=getMedia().find(m=>m.id===id);if(!media)throw new HttpError(404,'文件不存在');
   if(!/^\/(uploads|usr)\//.test(media.url))throw new HttpError(400,'不能删除外部资源');
   const base=path.join(process.cwd(),'public'),target=path.resolve(base,`.${media.url}`);if(!target.startsWith(base+path.sep))throw new HttpError(400,'文件路径无效');
   try{const info=await lstat(target);if(info.isSymbolicLink()||!info.isFile())throw new HttpError(400,'文件路径无效');await unlink(target);}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
   db.prepare('DELETE FROM media WHERE id=?').run(id);return Response.json({ok:true});
  }
  throw new HttpError(404,'接口不存在');
 }catch(error){return apiError(error);}
}
