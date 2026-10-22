import { assertSameOrigin,assertSetupAllowed,createSession,getSession,hashPassword,logout,needsSetup,rateLimit,verifyPassword } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { apiError,credentialsSchema,HttpError,readJson } from '@/lib/validation';
export const runtime='nodejs';
export const dynamic='force-dynamic';
type Context={params:Promise<{action:string}>};
export async function GET(_request:Request,context:Context){
 try{const {action}=await context.params;if(action!=='session')throw new HttpError(404,'接口不存在');const session=await getSession();return Response.json({authenticated:!!session,needsSetup:needsSetup(),username:session?.username},{headers:{'Cache-Control':'no-store'}});}catch(error){return apiError(error);}
}
export async function POST(request:Request,context:Context){
 try{
  assertSameOrigin(request);const {action}=await context.params;
  if(action==='logout'){await logout();return Response.json({ok:true});}
  if(action!=='setup'&&action!=='login')throw new HttpError(404,'接口不存在');
  rateLimit(request,`auth-${action}`,20,900);const input=credentialsSchema.parse(await readJson(request,10_000));const db=getDb();
  if(action==='setup'){
   if(!needsSetup())throw new HttpError(409,'管理员已创建，请登录');assertSetupAllowed(request,input.setupToken);const hash=await hashPassword(input.password);
   try{db.prepare('INSERT INTO admins(id,username,password_hash,created_at) VALUES(1,?,?,?)').run(input.username,hash,Math.floor(Date.now()/1000));}catch{throw new HttpError(409,'管理员已创建，请登录');}
   await createSession(1);return Response.json({ok:true,authenticated:true});
  }
  const admin=db.prepare('SELECT id,username,password_hash FROM admins WHERE username=?').get(input.username) as {id:number;password_hash:string}|undefined;
  const dummy='scrypt:000000000000000000000000000000000000000000000000:00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000';
  const valid=await verifyPassword(input.password,admin?.password_hash||dummy);if(!admin||!valid)throw new HttpError(401,'用户名或密码错误');
  await createSession(admin.id);return Response.json({ok:true,authenticated:true});
 }catch(error){return apiError(error);}
}
