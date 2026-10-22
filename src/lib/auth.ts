import { createHash, createHmac, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { cookies } from 'next/headers';
import { getDb } from './db';
import { HttpError } from './validation';
const scrypt=promisify(scryptCallback);
const SESSION_SECONDS=7*24*60*60;
const COOKIE='mellow_session';
const now=()=>Math.floor(Date.now()/1000);
const sha=(v:string)=>createHash('sha256').update(v).digest('hex');
function secret(){const db=getDb();db.prepare('INSERT OR IGNORE INTO auth_meta(key,value) VALUES(?,?)').run('session_secret',randomBytes(48).toString('hex'));return (db.prepare('SELECT value FROM auth_meta WHERE key=?').get('session_secret') as {value:string}).value;}
function signature(token:string){return createHmac('sha256',process.env.SESSION_SECRET||secret()).update(token).digest('base64url');}
function equal(a:string,b:string){const ab=Buffer.from(a),bb=Buffer.from(b);return ab.length===bb.length&&timingSafeEqual(ab,bb);}
export function needsSetup(){return !getDb().prepare('SELECT id FROM admins LIMIT 1').get();}
export async function hashPassword(password:string){const salt=randomBytes(24).toString('hex');const hash=await scrypt(password,salt,64) as Buffer;return `scrypt:${salt}:${hash.toString('hex')}`;}
export async function verifyPassword(password:string,hash:string){const [kind,salt,expected]=hash.split(':');if(kind!=='scrypt'||!salt||!expected)return false;const actual=await scrypt(password,salt,64) as Buffer;return equal(actual.toString('hex'),expected);}
export function assertSameOrigin(request:Request){
 const value=request.headers.get('origin');if(!value)throw new HttpError(403,'缺少同源验证信息，请在本站操作');
 let origin:URL;try{origin=new URL(value);}catch{throw new HttpError(403,'来源验证失败');}
 const target=new URL(request.url),host=request.headers.get('host')||target.host;
 const forwarded=process.env.TRUST_PROXY==='1'?request.headers.get('x-forwarded-proto')?.split(',')[0].trim():undefined;
 const protocol=forwarded==='http'||forwarded==='https'?`${forwarded}:`:target.protocol;
 if(!['http:','https:'].includes(origin.protocol)||origin.host!==host||origin.protocol!==protocol)throw new HttpError(403,'仅允许本站提交请求');
 const site=request.headers.get('sec-fetch-site');if(site&&site!=='same-origin'&&site!=='none')throw new HttpError(403,'仅允许本站提交请求');
}
export function rateLimit(request:Request,scope:string,limit:number,windowSeconds:number){
 const ip=process.env.TRUST_PROXY==='1'?(request.headers.get('x-forwarded-for')?.split(',')[0].trim()||'unknown'):'global';
 const key=`${scope}:${sha(ip)}`,db=getDb(),time=now();
 db.transaction(()=>{db.prepare('DELETE FROM rate_limits WHERE expires_at<=?').run(time);const r=db.prepare('SELECT count FROM rate_limits WHERE key=?').get(key) as {count:number}|undefined;if(r&&r.count>=limit)throw new HttpError(429,'操作过于频繁，请稍后再试');db.prepare('INSERT INTO rate_limits(key,count,expires_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1').run(key,time+windowSeconds);})();
}
export function assertSetupAllowed(request:Request,token?:string){
 const host=new URL(request.url).hostname;
 if(process.env.NODE_ENV!=='production'&&['localhost','127.0.0.1','[::1]'].includes(host))return;
 if(!process.env.ADMIN_SETUP_TOKEN||!token||!equal(token,process.env.ADMIN_SETUP_TOKEN))throw new HttpError(403,'远程首次设置需要服务器配置的 ADMIN_SETUP_TOKEN');
}
export async function getSession(){
 const cookie=(await cookies()).get(COOKIE)?.value;if(!cookie)return null;
 const [token,sig]=cookie.split('.');if(!token||!sig||!equal(sig,signature(token)))return null;
 return getDb().prepare('SELECT a.id,a.username FROM sessions s JOIN admins a ON s.admin_id=a.id WHERE s.id=? AND s.expires_at>?').get(sha(token),now()) as {id:number;username:string}|undefined||null;
}
export async function requireAdmin(){const session=await getSession();if(!session)throw new HttpError(401,'请先登录后台');return session;}
export async function createSession(adminId:number){
 const token=randomBytes(32).toString('base64url'),db=getDb();db.prepare('DELETE FROM sessions WHERE expires_at<=?').run(now());db.prepare('INSERT INTO sessions(id,admin_id,expires_at) VALUES(?,?,?)').run(sha(token),adminId,now()+SESSION_SECONDS);
 (await cookies()).set(COOKIE,`${token}.${signature(token)}`,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',maxAge:SESSION_SECONDS,path:'/'});
}
export async function logout(){const jar=await cookies();const value=jar.get(COOKIE)?.value;if(value)getDb().prepare('DELETE FROM sessions WHERE id=?').run(sha(value.split('.')[0]));jar.delete(COOKIE);}
