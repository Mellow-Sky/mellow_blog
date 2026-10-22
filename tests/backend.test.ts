import test,{after,before} from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
const temporary=mkdtempSync(path.join(tmpdir(),'blog-tests-'));
process.env.DATABASE_PATH=path.join(temporary,'blog.db');
import {getDb,getPosts,getPostById,getComments,getTaxonomies,getSettings,saveSettings,savePost,createComment} from '../src/lib/db';
import {assertSameOrigin,hashPassword,verifyPassword,rateLimit,assertSetupAllowed} from '../src/lib/auth';
import {postSchema,settingsSchema,commentSchema} from '../src/lib/validation';
let publishedPost:ReturnType<typeof savePost>;
let multiCategoryPost:ReturnType<typeof savePost>;
let firstComment:ReturnType<typeof createComment>;
before(()=>{
 const db=getDb();
 for(const table of ['posts','comments','taxonomies','post_taxonomies','media','legacy_records','admins','sessions','integration_secrets','bangumi_state']){
  assert.equal((db.prepare(`SELECT count(*) AS n FROM ${table}`).get() as {n:number}).n,0,`fresh ${table} must be empty`);
 }
 assert.deepEqual(getPosts({includeDrafts:true,type:'all'}),[]);
 assert.deepEqual(getTaxonomies(),[]);
 const settings=getSettings();
 assert.equal(settings.title,'我的博客');assert.equal(settings.author,'博主');assert.equal(settings.avatar,'/avatar.svg');
 assert.equal(settings.heroImage,'/images/hero.svg');assert.equal(settings.musicPlaylistId,'');assert.equal(settings.musicEnabled,false);
 assert.equal(settingsSchema.strict().safeParse(settings).success,true);
 publishedPost=savePost({title:'示例文章',slug:'sample-post',content:'# 示例内容\n\n用于验证博客基础功能。',status:'publish',categories:['分类一'],tags:['测试'],createdAt:1_700_000_000});
 multiCategoryPost=savePost({title:'多分类示例',slug:'multiple-categories',content:'用于验证多分类编辑。',status:'publish',categories:['分类一','分类二','分类三'],tags:['备份'],createdAt:1_700_000_001});
 savePost({title:'示例页面',slug:'sample-page',content:'用于验证独立页面。',status:'publish',type:'page',createdAt:1_700_000_002});
 firstComment=createComment({postId:publishedPost.id,parentId:0,author:'Demo',email:'demo@example.com',content:'示例评论',status:'approved'});
 createComment({postId:publishedPost.id,parentId:firstComment.id,author:'Reader',email:'reader@example.com',content:'示例回复',status:'approved'});
 db.prepare('INSERT INTO media(name,url,mime,size,created_at) VALUES(?,?,?,?,?)').run('sample.png','/uploads/sample.png','image/png',108,1_700_000_000);
 db.prepare('INSERT INTO legacy_records(table_name,row_id,value) VALUES(?,?,?)').run('typecho_contents',1,JSON.stringify({title:'Synthetic compatibility fixture'}));
});
after(()=>{getDb().close();rmSync(temporary,{recursive:true,force:true});});
test('全新数据库初始化为空，独立示例支持文章、页面、回复及多分类',()=>{
 const db=getDb();assert.equal(getPosts().length,2);assert.equal(getPosts({type:'page'}).length,1);
 const comments=getComments(publishedPost.id);assert.equal(comments[0].id,firstComment.id);assert.equal(comments[0].parentId,0);assert.equal(comments[1].parentId,firstComment.id);
 assert.equal(getTaxonomies().length,5);assert.equal((db.prepare('SELECT count(*) AS n FROM post_taxonomies').get() as {n:number}).n,6);
 assert.deepEqual(getPostById(multiCategoryPost.id)?.categories,['分类一','分类二','分类三']);
 assert.equal(db.pragma('integrity_check',{simple:true}),'ok');assert.deepEqual(db.pragma('foreign_key_check'),[]);
});
test('公开读取不会泄露评论邮箱、私有设置或未发布文章',()=>{
 assert.equal(getComments(publishedPost.id)[0].email,undefined);assert.equal(getSettings().musicPlaylistId,'');assert.equal('password' in getSettings(),false);
 const draft=savePost({title:'私密草稿',slug:'private-test',content:'private',status:'draft'});assert.equal(getPostById(draft.id),null);assert.equal(getPostById(draft.id,true)?.title,'私密草稿');
 const comment=createComment({postId:draft.id,parentId:0,author:'tester',content:'secret',status:'approved'});assert.ok(comment.id);assert.deepEqual(getComments(draft.id),[]);
});
test('密码使用随机盐和scrypt，验证错误密码会失败',async()=>{
 const one=await hashPassword('a-long-test-password'),two=await hashPassword('a-long-test-password');assert.notEqual(one,two);assert.equal(await verifyPassword('a-long-test-password',one),true);assert.equal(await verifyPassword('incorrect-test-password',one),false);
});
test('写入拒绝跨来源及缺失Origin，节流持久化',()=>{
 assert.throws(()=>assertSameOrigin(new Request('http://localhost/api',{headers:{origin:'https://evil.example'}})));
 assert.throws(()=>assertSameOrigin(new Request('http://localhost/api')));
 assert.throws(()=>assertSameOrigin(new Request('http://localhost/api',{headers:{origin:'https://localhost'}})));
 const req=new Request('http://localhost/api',{headers:{origin:'http://localhost'}});assert.doesNotThrow(()=>assertSameOrigin(req));rateLimit(req,'test',1,60);assert.throws(()=>rateLimit(req,'test',1,60));
 const prod=process.env.NODE_ENV;Object.assign(process.env,{NODE_ENV:'production'});assert.throws(()=>assertSetupAllowed(req));Object.assign(process.env,{NODE_ENV:prod||'test'});
});
test('内容与设置验证拒绝脚本URL、非受信音乐API、路径穿越和超长评论',()=>{
 assert.equal(postSchema.safeParse({title:'t',slug:'../x',content:'x',status:'publish',type:'post'}).success,false);
 assert.equal(settingsSchema.safeParse({...getSettings(),background:'javascript:alert(1)'}).success,false);
 assert.equal(settingsSchema.safeParse({...getSettings(),musicApi:'http://127.0.0.1/internal'}).success,false);
 assert.equal(commentSchema.safeParse({postId:1,author:'x',content:'a'.repeat(10001)}).success,false);
});
test('旧设置无需迁移即可获得图标、首页图片和空 Spotify 默认值',()=>{
 const legacy={...getSettings()} as Record<string,unknown>;
 for(const key of ['logo','heroImage','heroImageAlt','spotifyUri'])delete legacy[key];
 const parsed=settingsSchema.strict().parse(legacy);
 assert.equal(parsed.logo,'');assert.equal(parsed.spotifyUri,'');assert.equal(parsed.heroImage,'/images/hero.svg');assert.ok(parsed.heroImageAlt);
});
test('外观图片与 Spotify 设置写入只接受安全来源并规范化分享链接',()=>{
 const current=getSettings();
 for(const key of ['logo','heroImage']){
  for(const value of ['javascript:alert(1)','//evil.example/image.png','http://example.com/image.png','https://user:pass@example.com/a.png','/\\evil.example/a.png'])assert.equal(settingsSchema.safeParse({...current,[key]:value}).success,false,`${key}: ${value}`);
  for(const value of ['/uploads/image.png','https://images.example.com/image.png',''])assert.equal(settingsSchema.safeParse({...current,[key]:value}).success,true,`${key}: ${value}`);
 }
 assert.equal(settingsSchema.parse({...current,spotifyUri:'https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M?si=tracking'}).spotifyUri,'spotify:playlist:37i9dQZF1DXcBWIGoYBM5M');
 assert.equal(settingsSchema.safeParse({...current,spotifyUri:'https://evil.example/playlist/37i9dQZF1DXcBWIGoYBM5M'}).success,false);
});
test('备份恢复验证全部表及引用，保留管理员会话并事务恢复内容',async()=>{
 const {exportBackup}=await import('../src/lib/db');const {backupSchema,restoreBackup}=await import('../src/lib/backup');const db=getDb();
 const backup=exportBackup();assert.equal(backupSchema.safeParse(backup).success,true);
 db.prepare('INSERT INTO admins(id,username,password_hash,created_at) VALUES(1,?,?,?)').run('restore-admin','test-only',1);
 db.prepare('INSERT INTO sessions(id,admin_id,expires_at) VALUES(?,1,?)').run('preserved-session',9999999999);
 db.prepare('UPDATE posts SET title=? WHERE id=?').run('恢复前修改',publishedPost.id);
 const result=restoreBackup(db,backup);assert.equal(result.posts,backup.tables.posts.length);assert.equal(getPostById(publishedPost.id)?.title,publishedPost.title);
 assert.equal((db.prepare('SELECT username FROM admins WHERE id=1').get() as {username:string}).username,'restore-admin');assert.ok(db.prepare('SELECT id FROM sessions WHERE id=?').get('preserved-session'));
 const invalid=structuredClone(backup);(invalid.tables.comments[0] as Record<string,unknown>).post_id=999999;
 assert.equal(backupSchema.safeParse(invalid).success,false);assert.throws(()=>restoreBackup(db,invalid));assert.equal(getPosts().length,2);
 const traversal=structuredClone(backup);(traversal.tables.media[0] as Record<string,unknown>).url='/uploads/%2e%2e/%2e%2e/secret';assert.equal(backupSchema.safeParse(traversal).success,false);
 const injection=structuredClone(backup) as Record<string,unknown>;injection.tables={...backup.tables,'posts; DROP TABLE admins;--':[]};assert.equal(backupSchema.safeParse(injection).success,false);
 const circular=structuredClone(backup);(circular.tables.comments[0] as Record<string,unknown>).parent_id=firstComment.id;assert.equal(backupSchema.safeParse(circular).success,false);
});
test('命令行恢复先创建一致性备份并保留现有内容的恢复点',()=>{
 const {writeFileSync,readdirSync}=require('node:fs') as typeof import('node:fs');
 const {exportBackup}=require('../src/lib/db') as typeof import('../src/lib/db');const destination=path.join(temporary,'restore.json');writeFileSync(destination,JSON.stringify(exportBackup()));
 const output=execFileSync(process.execPath,['--import','tsx','scripts/restore-backup.ts',destination,'--confirm'],{cwd:process.cwd(),env:process.env,encoding:'utf8'});
 assert.ok(output.includes('恢复成功'));assert.ok(readdirSync(path.join(temporary,'backups')).some(name=>name.startsWith('before-restore-')&&name.endsWith('.db')));
});
test('公开待审评论响应及列表不会返回邮箱或提前展示内容',async()=>{
 const {POST,GET}=await import('../src/app/api/comments/route');
 const response=await POST(new Request('http://localhost/api/comments',{method:'POST',headers:{origin:'http://localhost','content-type':'application/json'},body:JSON.stringify({postId:publishedPost.id,author:'审核测试',email:'private@example.com',content:'待审核测试内容'})}));
 assert.equal(response.status,201);const result=await response.json();assert.equal(result.comment.status,'waiting');assert.equal('email' in result.comment,false);
 const listing=await (await GET(new Request(`http://localhost/api/comments?postId=${publishedPost.id}`))).json();assert.ok(!listing.comments.some((comment:{id:number})=>comment.id===result.comment.id));assert.ok(!JSON.stringify(listing).includes('private@example.com'));
});
test('默认停用音乐或未配置歌单时不访问上游服务',async()=>{
 const {GET}=await import('../src/app/api/music/route');const original=globalThis.fetch,settings=getSettings();let calls=0;
 try{
  globalThis.fetch=async()=>{calls++;throw new Error('must not fetch');};
  assert.deepEqual(await (await GET(new Request('http://localhost/api/music'))).json(),{tracks:[],source:'disabled'});
  saveSettings({...settings,musicEnabled:true});
  assert.deepEqual(await (await GET(new Request('http://localhost/api/music'))).json(),{tracks:[],source:'empty'});
  assert.equal(calls,0);
 }finally{globalThis.fetch=original;saveSettings(settings);}
});
test('音乐仅请求固定HTTPS上游，拒绝非HTTP音频并在服务失败时回退',async()=>{
 const {GET}=await import('../src/app/api/music/route');const original=globalThis.fetch,settings=getSettings();let called='';
 try{
  saveSettings({...settings,musicEnabled:true});
  globalThis.fetch=async(input,init)=>{called=String(input);assert.equal(init?.redirect,'error');assert.ok(init?.signal);return new Response(JSON.stringify([{id:1,name:'safe',author:'Meting author',url:'https://audio.example.com/1.mp3',pic:'https://image.example.com/1.jpg'},{id:2,url:'javascript:alert(1)'},{id:3,name:'array author',author:['Artist A','Artist B'],url:'https://audio.example.com/3.mp3'},{id:4,name:'native artist',artist:[{name:'Artist C'},{name:'Artist D'}],author:'fallback',url:'https://audio.example.com/4.mp3'}]));};
  const result=await (await GET(new Request('http://localhost/api/music?playlist=1234501'))).json();assert.ok(called.startsWith('https://api.i-meto.com/meting/api?'));assert.equal(result.tracks.length,3);assert.ok(result.tracks[0].url.startsWith('https://'));assert.equal(result.tracks[0].artist,'Meting author');assert.equal(result.tracks[1].artist,'Artist A / Artist B');assert.equal(result.tracks[2].artist,'Artist C / Artist D');
  globalThis.fetch=async()=>{throw new Error('timeout');};const fallback=await (await GET(new Request('http://localhost/api/music?playlist=1234502'))).json();assert.equal(fallback.source,'fallback');assert.ok(Array.isArray(fallback.tracks));
 }finally{globalThis.fetch=original;saveSettings(settings);}
});
test('多分类可读取，普通编辑及更换首分类不会丢失其他分类',()=>{
 const id=multiCategoryPost.id,original=getPostById(id,true)!;assert.deepEqual(new Set(original.categories),new Set(['分类一','分类二','分类三']));
 const edited=savePost({title:original.title+' edited'},id);assert.deepEqual(edited.categories,original.categories);
 const changed=savePost({category:'新分类'},id);assert.equal(changed.category,'新分类');assert.deepEqual(new Set(changed.categories),new Set(['新分类','分类二','分类三']));
 const explicit=savePost({categories:['分类一','独立分类']},id);assert.equal(explicit.category,'分类一');assert.deepEqual(new Set(explicit.categories),new Set(['分类一','独立分类']));
 savePost(original,id);assert.deepEqual(getPostById(id,true)?.categories,original.categories);
});
test('运行时新增上传文件可安全流式读取、Range、HEAD及缓存验证',async()=>{
 const {GET,HEAD}=await import('../src/app/uploads/[filename]/route');const {randomUUID}=await import('node:crypto');
 const {mkdirSync,writeFileSync,unlinkSync}=await import('node:fs');const directory=path.join(process.cwd(),'public/uploads');mkdirSync(directory,{recursive:true});
 const filename=`${randomUUID()}.png`,target=path.join(directory,filename);const bytes=Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),Buffer.alloc(100,42)]);writeFileSync(target,bytes);
 const context={params:Promise.resolve({filename})};
 try{
  const response=await GET(new Request(`http://localhost/uploads/${filename}`),context);assert.equal(response.status,200);assert.equal(response.headers.get('content-type'),'image/png');assert.equal(response.headers.get('x-content-type-options'),'nosniff');assert.deepEqual(Buffer.from(await response.arrayBuffer()),bytes);
  const etag=response.headers.get('etag')!;const cached=await GET(new Request(`http://localhost/uploads/${filename}`,{headers:{'if-none-match':etag}}),context);assert.equal(cached.status,304);
  const range=await GET(new Request(`http://localhost/uploads/${filename}`,{headers:{range:'bytes=8-17'}}),context);assert.equal(range.status,206);assert.equal(range.headers.get('content-range'),`bytes 8-17/${bytes.length}`);assert.equal((await range.arrayBuffer()).byteLength,10);
  const invalid=await GET(new Request(`http://localhost/uploads/${filename}`,{headers:{range:'bytes=10000-'}}),context);assert.equal(invalid.status,416);
  const head=await HEAD(new Request(`http://localhost/uploads/${filename}`,{method:'HEAD'}),context);assert.equal(head.status,200);assert.equal((await head.arrayBuffer()).byteLength,0);assert.equal(head.headers.get('content-length'),String(bytes.length));
  const traversal=await GET(new Request('http://localhost/uploads/x'),{params:Promise.resolve({filename:'../../data/blog.db'})});assert.equal(traversal.status,404);
  writeFileSync(target,'<html>script</html>');const fake=await GET(new Request(`http://localhost/uploads/${filename}`),context);assert.equal(fake.status,404);
 }finally{unlinkSync(target);}
});
