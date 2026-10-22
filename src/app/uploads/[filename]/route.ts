import { constants } from 'node:fs';
import { open,realpath } from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import { detectMedia } from '@/lib/media';
export const runtime='nodejs';
export const dynamic='force-dynamic';
type Context={params:Promise<{filename:string}>};
const FILE=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(png|jpg|gif|webp|avif|mp3|ogg|wav)$/;
async function serve(request:Request,context:Context):Promise<Response>{
 let handle:Awaited<ReturnType<typeof open>>|undefined;
 try{
  const {filename}=await context.params;if(!FILE.test(filename))return new Response('文件不存在',{status:404});
  const directory=await realpath(path.join(process.cwd(),'public','uploads'));
  handle=await open(path.join(directory,filename),constants.O_RDONLY|constants.O_NOFOLLOW);
  const stat=await handle.stat();if(!stat.isFile()||!stat.size||stat.size>20*1024*1024){await handle.close();return new Response('文件不存在',{status:404});}
  const signature=Buffer.alloc(64);const {bytesRead}=await handle.read(signature,0,signature.length,0);const media=detectMedia(signature.subarray(0,bytesRead));
  if(!media||media.ext!==filename.split('.').at(-1)){await handle.close();return new Response('文件格式无效',{status:404});}
  const etag=`"${stat.size.toString(16)}-${Math.trunc(stat.mtimeMs).toString(16)}"`;
  const headers=new Headers({'Content-Type':media.mime,'X-Content-Type-Options':'nosniff','Cache-Control':'public, max-age=31536000, immutable','Accept-Ranges':'bytes','ETag':etag,'Last-Modified':stat.mtime.toUTCString(),'Content-Disposition':`inline; filename="${filename}"`});
  if(request.headers.get('if-none-match')===etag){await handle.close();return new Response(null,{status:304,headers});}
  let start=0,end=stat.size-1,status=200;
  const range=request.headers.get('range'),ifRange=request.headers.get('if-range');
  if(range&&(!ifRange||ifRange===etag||ifRange===stat.mtime.toUTCString())){
   const match=/^bytes=(\d*)-(\d*)$/.exec(range);
   if(!match||(!match[1]&&!match[2])){await handle.close();return new Response(null,{status:416,headers:{'Content-Range':`bytes */${stat.size}`,'X-Content-Type-Options':'nosniff'}});}
   if(!match[1]){const suffix=Number(match[2]);start=Math.max(0,stat.size-suffix);}
   else {start=Number(match[1]);if(match[2])end=Math.min(Number(match[2]),end);}
   if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<0||start> end||start>=stat.size){await handle.close();return new Response(null,{status:416,headers:{'Content-Range':`bytes */${stat.size}`,'X-Content-Type-Options':'nosniff'}});}
   status=206;headers.set('Content-Range',`bytes ${start}-${end}/${stat.size}`);
  }
  headers.set('Content-Length',String(end-start+1));
  if(request.method==='HEAD'){await handle.close();return new Response(null,{status,headers});}
  const stream=handle.createReadStream({start,end,autoClose:true});handle=undefined;
  return new Response(Readable.toWeb(stream) as ReadableStream,{status,headers});
 }catch(error){if(handle)await handle.close().catch(()=>{});const code=(error as NodeJS.ErrnoException).code;if(code==='ENOENT'||code==='ENOTDIR'||code==='ELOOP'||code==='EACCES')return new Response('文件不存在',{status:404,headers:{'X-Content-Type-Options':'nosniff'}});console.error('Upload read failed',code||'unknown');return new Response('暂时无法读取文件',{status:500});}
}
export const GET=serve;
export const HEAD=serve;
