import { loadEnvConfig } from '@next/env';
import { hashPassword } from '../src/lib/auth';
import { getDb } from '../src/lib/db';
loadEnvConfig(process.cwd(),process.env.NODE_ENV!=='production');
async function main(){
 if(!process.argv.includes('--confirm'))throw new Error('重置会使现有登录失效。确认后运行：ADMIN_USERNAME=yourname ADMIN_PASSWORD=your-new-long-password npm run admin:reset -- --confirm');
 const username=process.env.ADMIN_USERNAME,password=process.env.ADMIN_PASSWORD;
 if(!username||username.trim().length<3||username.length>64||!password||password.length<12||password.length>256)throw new Error('请设置 ADMIN_USERNAME（3–64字符）及 ADMIN_PASSWORD（12–256字符）环境变量');
 const hash=await hashPassword(password),db=getDb();
 db.transaction(()=>{db.prepare('DELETE FROM sessions').run();db.prepare('DELETE FROM admins').run();db.prepare('INSERT INTO admins(id,username,password_hash,created_at) VALUES(1,?,?,?)').run(username.trim(),hash,Math.floor(Date.now()/1000));db.prepare("DELETE FROM rate_limits WHERE key LIKE 'auth-%'").run();})();
 console.log('管理员已更新，全部旧登录已失效。');
}
main().catch(error=>{console.error(error instanceof Error?error.message:'重置失败');process.exitCode=1;});
