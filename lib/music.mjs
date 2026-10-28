import { targetDuration } from '../public/duration.mjs';
const BASE = 'https://api.acemusic.ai';
const json = (value, status=200) => Response.json(value, {status, headers:{'Cache-Control':'no-store'}});
const durations = {'30 seconds':30,'1 minute':60,'2 minutes':120,'3 minutes':180};
const languages = {English:'en',Hindi:'hi',Hinglish:'hi',Punjabi:'pa',Spanish:'es',Other:'unknown'};
const tempos = {Slow:75,Medium:110,Fast:145};
export function makePayload(data, model) {
  if (!data || typeof data !== 'object') throw Error('Invalid song.');
  for (const [key,max] of Object.entries({lyrics:3500,style:1000,mood:60,voice:80,instruments:100,title:80})) {
    if (data[key] !== undefined && (typeof data[key] !== 'string' || data[key].length > max)) throw Error('Please shorten your '+key+'.');
  }
  if (!data.style?.trim()) throw Error('Describe your sound first.');
  if (!['vocals','instrumental'].includes(data.mode)) throw Error('Choose a song mode.');
  if (data.mode === 'vocals' && !data.lyrics?.trim()) throw Error('Add lyrics for a vocal song.');
  const duration = data.minDuration===undefined && data.maxDuration===undefined && durations[data.duration] ? durations[data.duration] : targetDuration(data);
  const prompt = [data.style, data.mood, data.instruments, data.mode==='instrumental'?'instrumental, no vocals':data.voice, data.mode==='vocals'?data.language+' lyrics':''].filter(Boolean).join(', ');
  // Prevent user text from closing the caption delimiter; keep every lyric line.
  const escape = s => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  return {model, messages:[{role:'user',content:`<prompt>${escape(prompt)}</prompt><lyrics>${escape(data.mode==='instrumental'?'[inst]':data.lyrics)}</lyrics>`}],stream:false,thinking:true,use_format:false,audio_config:{duration,format:'mp3',vocal_language:data.mode==='instrumental'?'unknown':languages[data.language]||'unknown',...(tempos[data.tempo]?{bpm:tempos[data.tempo]}:{})}};
}
async function boundedJSON(response, limit) {
  if (!response.body) throw Error('Empty engine response.');
  const reader=response.body.getReader(); let size=0; const chunks=[];
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>limit){await reader.cancel();throw Error('The engine returned a file larger than this studio supports. Try a shorter song.');}chunks.push(value);}
  const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}
  return JSON.parse(new TextDecoder().decode(bytes));
}
const inflight=new Set();
export async function musicAPI(request, env, fetcher=fetch) {
  const url=new URL(request.url);
  if(url.pathname==='/api/music/status' && request.method==='GET')return json({configured:!!env.ACESTEP_API_KEY,provider:'ACE Music'});
  if(url.pathname!=='/api/music/generate')return json({error:'Not found.'},404);
  if(request.method!=='POST')return json({error:'Method not allowed.'},405);
  if(request.headers.get('origin')!==url.origin)return json({error:'Open Raaga to generate a song.'},403);
  const user=request.headers.get('oai-authenticated-user-id');
  if(!user)return json({error:'Sign in to Raaga, then try again.'},401);
  if(!env.ACESTEP_API_KEY)return json({error:'The music engine needs an API key.'},503);
  if(inflight.has(user))return json({error:'Your song is still generating. Please wait.'},429);
  if(!request.headers.get('content-type')?.includes('application/json'))return json({error:'Expected a song form.'},415);
  let data;try{data=await boundedJSON(request,24000);makePayload(data,'validation');}catch(e){return json({error:e.message||'Invalid song form.'},400);}
  inflight.add(user);
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),600000);
  try{
    const headers={Authorization:`Bearer ${env.ACESTEP_API_KEY}`,'Content-Type':'application/json','User-Agent':'RaagaStudio/1.0'};
    const modelsResponse=await fetcher(BASE+'/v1/models',{headers,signal:controller.signal});
    if(!modelsResponse.ok)return json({error:modelsResponse.status===401?'ACE Music rejected the API key. Check your account key.':'ACE Music is unavailable. Try again later.'},502);
    const models=await boundedJSON(modelsResponse,200000);
    const model=env.ACESTEP_MODEL || models.data?.find(m=>/ace.?step/i.test(m.id))?.id;
    if(!model)return json({error:'No ACE-Step model is currently available on this account.'},502);
    const response=await fetcher(BASE+'/v1/chat/completions',{method:'POST',headers,body:JSON.stringify(makePayload(data,model)),signal:controller.signal});
    if(!response.ok)return json({error:response.status===429?'ACE Music is busy or your account limit was reached. Try later.':response.status===402?'ACE Music requires account credits. Check your provider account.':`ACE Music could not generate this song (status ${response.status}). Your draft is saved.`},502);
    const result=await boundedJSON(response,16*1024*1024);
    const audio=result.choices?.[0]?.message?.audio?.[0]?.audio_url?.url;
    if(typeof audio!=='string'||!/^data:audio\/(mpeg|mp3|wav|x-wav|flac);base64,[A-Za-z0-9+/]+=*$/.test(audio))return json({error:'The engine did not return a playable audio file. Your draft is saved.'},502);
    return json({audio,model,targetDuration:makePayload(data,model).audio_config.duration});
  }catch(e){return json({error:controller.signal.aborted?'Generation timed out. Your draft is saved; check ACE Music before retrying.':'The connection to ACE Music failed. Your draft is saved.'},502);}
  finally{clearTimeout(timer);inflight.delete(user);}
}
