import { aceMusicProvider, makePayload } from './providers/ace-music.mjs';
import { MusicError, readJSON, errorResponse } from './http.mjs';
import { TemporaryLimits, numericSetting } from './limits.mjs';
import { audioFilename } from './audio.mjs';
export { makePayload };
export function createMusicAPI({provider=aceMusicProvider,limits=new TemporaryLimits(),observe=async()=>{}}={}) {
 return async function musicAPI(request, env={}, fetcher=fetch) {
  const path=new URL(request.url).pathname;
  if(path==='/api/music/status'&&request.method==='GET')return Response.json({configured:!!env.ACESTEP_API_KEY,provider:'ACE Music'},{headers:{'Cache-Control':'no-store'}});
  if(path!=='/api/music/generate')return errorResponse(new MusicError('This session has no saved job or song history.',404,'not_found'));
  let release, timer, observation;
  const controller=new AbortController();
  const abort=()=>controller.abort();
  try {
   if(request.method!=='POST')throw new MusicError('Method not allowed.',405,'method');
   if(request.headers.get('origin')!==new URL(request.url).origin)throw new MusicError('Open Raaga to create a song.',403,'origin');
   const user=request.headers.get('oai-authenticated-user-id');
   if(!user)throw new MusicError('Sign in to Raaga, then try again.',401,'unauthorized');
   const personalKey=request.headers.get('x-ace-music-key');
   if(personalKey!==null&&!/^[\x21-\x7e]{1,512}$/.test(personalKey))throw new MusicError('Paste a valid ACE Music API key without spaces.',400,'invalid_key');
   const providerEnv=personalKey?{...env,ACESTEP_API_KEY:personalKey,ACESTEP_MODEL:undefined}:env;
   if(!providerEnv.ACESTEP_API_KEY)throw new MusicError('Connect your ACE Music API key to create a song.',503,'not_configured');
   if(!request.headers.get('content-type')?.includes('application/json'))throw new MusicError('Expected a song form.',415,'content_type');
   const data=await readJSON(request,32000,400);
   try{makePayload(data,'validation');}catch(error){throw new MusicError(error.message||'Check your song prompt.',400,'validation');}
   release=limits.acquire(user,env);
   const timeout=numericSetting(env.MUSIC_TIMEOUT_MS,600000,10,900000);
   timer=setTimeout(abort,timeout);
   request.signal.addEventListener('abort',abort,{once:true});
   if(request.signal.aborted)abort();
   observation={user,traceId:crypto.randomUUID(),started:Date.now(),status:'error',mode:data.mode,targetDuration:makePayload(data,'validation').audio_config.duration};
   // Race also bounds providers that fail to honor cancellation.
   const aborted=new Promise((_,reject)=>{
    const stop=()=>reject(new MusicError(request.signal.aborted?'The request was cancelled. The provider may still finish its work.':'Generation timed out. The provider may still finish; retry only when ready.',request.signal.aborted?499:504,request.signal.aborted?'cancelled':'timeout'));
    if(controller.signal.aborted)stop();else controller.signal.addEventListener('abort',stop,{once:true});
   });
   const audio=await Promise.race([provider.generate(data,{env:providerEnv,signal:controller.signal,fetcher}),aborted]);
   observation.status='success';observation.model=audio.model;
   return new Response(audio.bytes,{headers:{
    'Content-Type':audio.mime,'Content-Length':String(audio.bytes.byteLength),
    'Content-Disposition':`attachment; filename="${audioFilename(data.title,audio.extension)}"`,
    'Cache-Control':'no-store, max-age=0','X-Content-Type-Options':'nosniff',
    'X-Song-Target-Duration':String(audio.targetDuration)
   }});
  }catch(error){if(observation)observation.errorCode=error instanceof MusicError?error.code:'connection_error';return errorResponse(error);}
  finally{
   clearTimeout(timer);request.signal.removeEventListener('abort',abort);release?.();
   if(observation){const {started,...event}=observation;let deadline;try{await Promise.race([Promise.resolve().then(()=>observe({...event,latency:(Date.now()-started)/1000})),new Promise(resolve=>{deadline=setTimeout(resolve,1500);})]);}catch{/* Analytics cannot affect the music response. */}finally{clearTimeout(deadline);}}
  }
 };
}
export const musicAPI=createMusicAPI();
