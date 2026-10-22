import { assertSameOrigin,rateLimit } from '@/lib/auth';
import { createComment,getComments,getDb,getPostById,getSettings } from '@/lib/db';
import { apiError,commentSchema,HttpError,parseId,readJson } from '@/lib/validation';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(request:Request){try{const id=parseId(new URL(request.url).searchParams.get('postId')||'');return Response.json({comments:getComments(id)},{headers:{'Cache-Control':'no-store'}});}catch(error){return apiError(error);}}
export async function POST(request:Request){
 try{assertSameOrigin(request);rateLimit(request,'comments',30,600);const input=commentSchema.parse(await readJson(request,25_000));const settings=getSettings(),post=getPostById(input.postId);
  if(!settings.commentsEnabled||!post?.allowComment)throw new HttpError(403,'此文章暂未开放评论');
  if(input.parentId&&!getDb().prepare("SELECT id FROM comments WHERE id=? AND post_id=? AND status='approved'").get(input.parentId,input.postId))throw new HttpError(400,'回复的评论不存在');
  const comment=createComment({...input,status:settings.commentModeration?'waiting':'approved'});const {email:_,...safe}=comment;
  return Response.json({comment:safe,message:settings.commentModeration?'评论已提交，审核通过后会显示。':'评论已发表。'},{status:201});
 }catch(error){return apiError(error);}
}
