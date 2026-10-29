import { targetDuration } from '../../public/duration.mjs';
import { MusicError,readJSON } from '../http.mjs';
import { decodeAudio } from '../audio.mjs';
const BASE='https://api.acemusic.ai';
const durations = {'30 seconds':30,'1 minute':60,'2 minutes':120,'3 minutes':180};
const languages = {English:'en',Hindi:'hi',Hinglish:'hi',Punjabi:'pa',Spanish:'es',Other:'unknown'};
const tempos = {Slow:75,Medium:110,Fast:145};
export function makePayload(data, model) {
  if (!data || typeof data !== 'object') throw new Error('Invalid song.');
  for (const [key,max] of Object.entries({lyrics:3500,style:1000,mood:60,voice:80,instruments:100,title:80})) {
    if (data[key] !== undefined && (typeof data[key] !== 'string' || data[key].length > max)) throw new Error('Please shorten your '+key+'.');
  }
  if (!data.style?.trim()) throw new Error('Describe your sound first.');
  if (!['vocals','instrumental'].includes(data.mode)) throw new Error('Choose a song mode.');

  for(const [field,allowed] of Object.entries({mood:['','Dreamy','Romantic','Energetic','Melancholic','Peaceful','Devotional'],language:['English','Hindi','Hinglish','Punjabi','Spanish','Other'],tempo:['Auto','Slow','Medium','Fast'],voice:['','Let the music decide','Soft male vocal','Soft female vocal','Deep male vocal','Powerful female vocal','Duet']})){if(data[field]!==undefined&&!allowed.includes(data[field]))throw new Error('Choose a supported '+field+'.');}
  const duration = data.minDuration===undefined && data.maxDuration===undefined && durations[data.duration] ? durations[data.duration] : targetDuration(data);
  const prompt = [data.style, data.mood, data.instruments, data.mode==='instrumental'?'instrumental, no vocals':data.voice, data.mode==='vocals'?(data.language||'English')+' lyrics':''].filter(Boolean).join(', ');
  // Prevent user text from closing the caption delimiter; keep every lyric line.
  const escape = s => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  if(data.mode==='vocals'&&!data.lyrics?.trim())return {model,messages:[{role:'user',content:prompt}],stream:false,sample_mode:true,thinking:true,audio_config:{duration,format:'mp3',vocal_language:languages[data.language]||'en',...(tempos[data.tempo]?{bpm:tempos[data.tempo]}:{})}};
  return {model, messages:[{role:'user',content:`<prompt>${escape(prompt)}</prompt><lyrics>${escape(data.mode==='instrumental'?'[inst]':data.lyrics)}</lyrics>`}],stream:false,thinking:true,use_format:false,audio_config:{duration,format:'mp3',vocal_language:data.mode==='instrumental'?'unknown':languages[data.language]||'unknown',...(tempos[data.tempo]?{bpm:tempos[data.tempo]}:{})}};
}

function providerFailure(status, headers) {
 if(status===401)return new MusicError('ACE Music rejected the API key. Check or replace the connected key and try again.',502,'provider_auth');
 if(status===403||status===451)return new MusicError('ACE Music denied automated access. Generation has stopped; no access controls will be bypassed.',502,'provider_access_denied');
 if(status>=300&&status<400)return new MusicError('ACE Music returned an unexpected redirect. Generation stopped for your security.',502,'provider_redirect');
 if(status===429)return new MusicError('ACE Music is busy or your account limit was reached. Please wait before retrying.',429,'provider_rate_limit',Math.min(3600,Math.max(1,Number(headers.get('retry-after'))||30)));
 if(status===402)return new MusicError('ACE Music requires account credits. Check your provider account.',502,'provider_credits');
 return new MusicError('ACE Music is unavailable right now. Please try again later.',502,'provider_unavailable');
}
/** Provider interface: generate(input, {env, signal, fetcher}) -> {bytes, mime, extension, targetDuration}. */
export const aceMusicProvider={
 async generate(input,{env,signal,fetcher=fetch}) {
  const headers={Authorization:`Bearer ${env.ACESTEP_API_KEY}`,'Content-Type':'application/json','User-Agent':'RaagaStudio/1.0'};
  const options={headers,signal,redirect:'manual'};
  const modelsResponse=await fetcher(BASE+'/v1/models',options);
  if(!modelsResponse.ok)throw providerFailure(modelsResponse.status,modelsResponse.headers);
  const models=await readJSON(modelsResponse,200000);
  const model=env.ACESTEP_MODEL||models.data?.find(m=>typeof m.id==='string'&&/ace.?step/i.test(m.id))?.id;
  if(!model)throw new MusicError('No ACE-Step model is available on this account.',502,'no_model');
  const payload=makePayload(input,model);
  const response=await fetcher(BASE+'/v1/chat/completions',{...options,method:'POST',body:JSON.stringify(payload)});
  if(!response.ok)throw providerFailure(response.status,response.headers);
  const result=await readJSON(response,16*1024*1024);
  return {...decodeAudio(result.choices?.[0]?.message?.audio?.[0]?.audio_url?.url),targetDuration:payload.audio_config.duration};
 }
};

