import { getSettings } from '@/lib/db';
import type { Track } from '@/lib/types';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const cache=new Map<string,{expires:number;tracks:Track[]}>();
const artistName=(value:unknown):string=>{const list=Array.isArray(value)?value:[value];return list.map(item=>typeof item==='string'?item:typeof item==='object'&&item!==null&&'name' in item?String(item.name):'').filter(Boolean).join(' / ').slice(0,300);};
const safe=(value:unknown):string=>{if(typeof value!=='string')return '';try{const url=new URL(value);return ['http:','https:'].includes(url.protocol)&&!!url.hostname?url.href:'';}catch{return '';}};
export async function GET(request:Request){
 const settings=getSettings();if(!settings.musicEnabled)return Response.json({tracks:[],source:'disabled'});
 const input=new URL(request.url).searchParams.get('playlist');const id=input&&/^\d{1,20}$/.test(input)?input:settings.musicPlaylistId;
 if(settings.tracks.length&&!input)return Response.json({tracks:settings.tracks,source:'custom'});
 if(!id)return Response.json({tracks:[],source:'empty'});
 const stored=cache.get(id);if(stored&&stored.expires>Date.now())return Response.json({tracks:stored.tracks,source:'netease'},{headers:{'Cache-Control':'public, max-age=60'}});
 try{
  const url=new URL('https://api.i-meto.com/meting/api');url.search=new URLSearchParams({server:'netease',type:'playlist',id}).toString();
  const response=await fetch(url,{signal:AbortSignal.timeout(8000),headers:{accept:'application/json'},redirect:'error',cache:'no-store'});if(!response.ok)throw new Error('音乐服务暂时不可用');
  const reader=response.body?.getReader();if(!reader)throw new Error('音乐响应为空');const chunks:Uint8Array[]=[];let size=0;while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>2_000_000){await reader.cancel();throw new Error('音乐响应过大');}chunks.push(value);}const data=JSON.parse(Buffer.concat(chunks).toString('utf8'));if(!Array.isArray(data))throw new Error('音乐响应格式无效');
  const tracks:Track[]=data.slice(0,100).map((v:Record<string,unknown>,index:number)=>({id:String(v.id||`${id}-${index}`),title:String(v.name||v.title||'未命名').slice(0,300),artist:artistName(v.artist)||artistName(v.author)||'未知音乐人',url:safe(v.url),cover:safe(v.pic||v.cover)})).filter((t:Track)=>t.url);
  cache.set(id,{expires:Date.now()+300_000,tracks});if(cache.size>20)cache.delete(cache.keys().next().value!);return Response.json({tracks,source:'netease'},{headers:{'Cache-Control':'public,max-age=60'}});
 }catch{return Response.json({tracks:stored?.tracks||settings.tracks,source:'fallback',message:'音乐服务暂时无法连接，可稍后重试。'},{headers:{'Cache-Control':'no-store'}});}
}
