import { loadEnvConfig } from '@next/env';
import { chmodSync,mkdirSync,readFileSync,statSync } from 'node:fs';
import path from 'node:path';
import { backupSchema,restoreBackup } from '../src/lib/backup';
import { getDb } from '../src/lib/db';
loadEnvConfig(process.cwd(),process.env.NODE_ENV!=='production');
async function main(){
 const args=process.argv.slice(2);const filename=args.find(arg=>!arg.startsWith('--'));
 if(!filename||!args.includes('--confirm')||args.some(arg=>arg.startsWith('--')&&arg!=='--confirm'))throw new Error('用法：npm run backup:restore -- /绝对路径/backup.json --confirm\n恢复会替换文章、评论、分类、媒体记录与站点设置；现有管理员和登录会保留。');
 const source=path.resolve(filename);if(statSync(source).size>100*1024*1024)throw new Error('备份文件不能超过100MB');
 const validated=backupSchema.parse(JSON.parse(readFileSync(source,'utf8')));
 const db=getDb();const directory=path.join(path.dirname(db.name),'backups');mkdirSync(directory,{recursive:true,mode:0o700});
 const snapshot=path.join(directory,`before-restore-${new Date().toISOString().replace(/[:.]/g,'-')}.db`);await db.backup(snapshot);chmodSync(snapshot,0o600);
 try{const result=restoreBackup(db,validated);console.log(`恢复成功：${result.posts}篇文章与页面、${result.comments}条评论、${result.media}项媒体。\n恢复前数据库：${snapshot}\n媒体文件本体需另行恢复到 public/usr 与 public/uploads。`);}finally{db.close();}
}
main().catch(error=>{console.error(error instanceof Error?error.message:'恢复失败');process.exitCode=1;});
