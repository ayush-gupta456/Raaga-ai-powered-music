import { MusicError } from './http.mjs';
export function decodeAudio(dataURL) {
  const match=typeof dataURL==='string' && dataURL.match(/^data:audio\/(mpeg|mp3|wav|x-wav|flac);base64,([A-Za-z0-9+/]+={0,2})$/);
  if(!match)throw new MusicError('The provider did not return a supported audio file. Please retry.');
  let binary;
  try{binary=atob(match[2]);}catch{throw new MusicError('The provider returned damaged audio. Please retry.');}
  const bytes=Uint8Array.from(binary,c=>c.charCodeAt(0));
  const prefix=(at,text)=>text.split('').every((c,i)=>bytes[at+i]===c.charCodeAt(0));
  const claimed=match[1];
  const wave=bytes.length>=44&&prefix(0,'RIFF')&&prefix(8,'WAVE');
  const flac=bytes.length>=42&&prefix(0,'fLaC');
  const mp3=bytes.length>=10&&(prefix(0,'ID3')||(bytes[0]===255&&(bytes[1]&224)===224&&(bytes[1]&6)!==0));
  if((claimed==='wav'||claimed==='x-wav')&&wave)return {bytes,mime:'audio/wav',extension:'wav'};
  if(claimed==='flac'&&flac)return {bytes,mime:'audio/flac',extension:'flac'};
  if((claimed==='mpeg'||claimed==='mp3')&&mp3)return {bytes,mime:'audio/mpeg',extension:'mp3'};
  throw new MusicError('The provider returned audio with an invalid or mismatched format. Please retry.');
}
export function audioFilename(title,extension) {
  const name=String(title||'').normalize('NFKD').replace(/[^a-zA-Z0-9 _-]/g,'').trim().replace(/\s+/g,'-').slice(0,64)||'ai-generated-song';
  return `${name}.${extension}`;
}
