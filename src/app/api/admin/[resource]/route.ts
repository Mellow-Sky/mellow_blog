import { randomUUID } from 'node:crypto';
import { mkdir, writeFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import { detectMedia } from '@/lib/media';
import { assertSameOrigin,requireAdmin } from '@/lib/auth';
import { createComment,exportBackup,getAllComments,getDashboard,getDb,getMedia,getPostById,getPosts,getSettings,getTaxonomies,savePost,saveSettings } from '@/lib/db';
import { apiError,commentSchema,HttpError,postSchema,readJson,settingsSchema,taxonomySchema } from '@/lib/validation';
export const runtime='nodejs';
export const dynamic='force-dynamic';
type Context={params:Promise<{resource:string}>};
export async function GET(_request:Request,context:Context){
 try{await requireAdmin();const {resource}=await context.params;const headers={'Cache-Control':'no-store'};
  if(resource==='dashboard')return Response.json(getDashboard(),{headers});
  if(resource==='posts')return Response.json({posts:getPosts({includeDrafts:true,type:'all'})},{headers});
  if(resource==='comments')return Response.json({comments:getAllComments()},{headers});
  if(resource==='settings')return Response.json({settings:getSettings()},{headers});
  if(resource==='taxonomies')return Response.json({taxonomies:getTaxonomies()},{headers});
  if(resource==='media')return Response.json({media:getMedia()},{headers});
  if(resource==='backup')return new Response(JSON.stringify(exportBackup(),null,2),{headers:{...headers,'Content-Type':'application/json','Content-Disposition':`attachment; filename="blog-backup-${new Date().toISOString().slice(0,10)}.json"`}});
  throw new HttpError(404,'接口不存在');
 }catch(error){return apiError(error);}
}
export async function POST(request:Request,context:Context){
 try{assertSameOrigin(request);await requireAdmin();const {resource}=await context.params;
  if(resource==='posts')return Response.json({post:savePost(postSchema.parse(await readJson(request)))},{status:201});
  if(resource==='taxonomies'){const t=taxonomySchema.parse(await readJson(request));const result=getDb().prepare('INSERT INTO taxonomies(name,slug,type,description) VALUES(?,?,?,?)').run(t.name,t.slug,t.type,t.description);return Response.json({taxonomy:{...t,id:Number(result.lastInsertRowid)}},{status:201});}
  if(resource==='comments'){
   const raw=await readJson(request) as Record<string,unknown>;const input=commentSchema.parse({...raw,author:raw.author||getSettings().author});const post=getPostById(input.postId,true);if(!post)throw new HttpError(404,'文章不存在');
   if(input.parentId&&!getDb().prepare('SELECT id FROM comments WHERE id=? AND post_id=?').get(input.parentId,input.postId))throw new HttpError(400,'回复的评论不属于此文章');
   return Response.json({comment:createComment({...input,status:'approved'})},{status:201});
  }
  if(resource==='media')return await uploadMedia(request);
  throw new HttpError(404,'接口不存在');
 }catch(error){return apiError(error);}
}
export async function PUT(request:Request,context:Context){
 try{assertSameOrigin(request);await requireAdmin();const {resource}=await context.params;if(resource!=='settings')throw new HttpError(404,'接口不存在');const value=settingsSchema.parse({...getSettings(),...await readJson(request) as object});return Response.json({settings:saveSettings(value)});}catch(error){return apiError(error);}
}
export const PATCH=PUT;
const MAX_UPLOAD=20*1024*1024;
async function uploadMedia(request:Request){
 if(Number(request.headers.get('content-length')||0)>MAX_UPLOAD+65536)throw new HttpError(413,'文件不能超过20MB');
 if(!request.headers.get('content-type')?.startsWith('multipart/form-data'))throw new HttpError(415,'请上传表单文件');
 const reader=request.body?.getReader();if(!reader)throw new HttpError(400,'未收到文件');let length=0;const chunks:Uint8Array[]=[];
 while(true){const {done,value}=await reader.read();if(done)break;length+=value.byteLength;if(length>MAX_UPLOAD+65536){await reader.cancel();throw new HttpError(413,'文件不能超过20MB');}chunks.push(value);}
 const body=Buffer.concat(chunks);const form=await new Response(body,{headers:{'content-type':request.headers.get('content-type')!}}).formData();const file=form.get('file');
 if(!(file instanceof File)||!file.size)throw new HttpError(400,'请选择文件');if(file.size>MAX_UPLOAD)throw new HttpError(413,'文件不能超过20MB');
 const bytes=Buffer.from(await file.arrayBuffer());const type=detectMedia(bytes);if(!type)throw new HttpError(415,'支持PNG、JPG、GIF、WebP、AVIF和MP3、OGG、WAV文件');
 const directory=path.join(process.cwd(),'public','uploads');await mkdir(directory,{recursive:true});const filename=`${randomUUID()}.${type.ext}`;const target=path.join(directory,filename);await writeFile(target,bytes,{flag:'wx'});
 const media={name:file.name.slice(0,255),url:`/uploads/${filename}`,mime:type.mime,size:file.size,createdAt:Math.floor(Date.now()/1000)};
 try{const result=getDb().prepare('INSERT INTO media(name,url,mime,size,created_at) VALUES(?,?,?,?,?)').run(media.name,media.url,media.mime,media.size,media.createdAt);return Response.json({media:{...media,id:Number(result.lastInsertRowid)}},{status:201});}catch(error){await unlink(target);throw error;}
}
