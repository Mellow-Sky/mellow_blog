export function detectMedia(bytes:Buffer):{mime:string;ext:string}|null {
 if(bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return {mime:'image/png',ext:'png'};
 if(bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return {mime:'image/jpeg',ext:'jpg'};
 if(/^GIF8[79]a$/.test(bytes.subarray(0,6).toString()))return {mime:'image/gif',ext:'gif'};
 if(bytes.subarray(0,4).toString()==='RIFF'&&bytes.subarray(8,12).toString()==='WEBP')return {mime:'image/webp',ext:'webp'};
 if(bytes.subarray(4,8).toString()==='ftyp'&&/avif|avis/.test(bytes.subarray(8,28).toString()))return {mime:'image/avif',ext:'avif'};
 if(bytes.subarray(0,3).toString()==='ID3'||(bytes[0]===255&&(bytes[1]&0xe0)===0xe0))return {mime:'audio/mpeg',ext:'mp3'};
 if(bytes.subarray(0,4).toString()==='OggS')return {mime:'audio/ogg',ext:'ogg'};
 if(bytes.subarray(0,4).toString()==='RIFF'&&bytes.subarray(8,12).toString()==='WAVE')return {mime:'audio/wav',ext:'wav'};
 return null;
}
