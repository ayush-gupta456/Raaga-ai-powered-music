import { aceMusicProvider, makePayload } from './providers/ace-music.mjs';
import { MusicError, readJSON, errorResponse } from './http.mjs';
import { TemporaryLimits, numericSetting } from './limits.mjs';
import { audioFilename } from './audio.mjs';
export { makePayload };
export function createMusicAPI({provider=aceMusicProvider,limits=new TemporaryLimits()}={}) {
 return async function musicAPI(request, env={}, fetcher=fetch) {
  const path=new URL(request.url).pathname;
  if(path==='/api/music/status'&&request.method==='GET')return Response.json({configured:!!env.ACESTEP_API_KEY,provider:'ACE Music'},{headers:{'Cache-Control':'no-store'}});
  if(path!=='/api/music/generate')return errorResponse(new MusicError('This session has no saved job or song history.',404,'not_found'));
  let release, timer;
  const controller=new AbortController();
  const abort=()=>controller.abort();
  try {
   if(request.method!=='POST')throw new MusicError('Method not allowed.',405,'method');
   if(request.headers.get('origin')!==new URL(request.url).origin)throw new MusicError('Open Raaga to create a song.',403,'origin');
   const user=request.headers.get('oai-authenticated-user-id');
   if(!user)throw new MusicError('Sign in to Raaga, then try again.',401,'unauthorized');
   if(!env.ACESTEP_API_KEY)throw new MusicError('The music engine needs configuration. Contact the site owner.',503,'not_configured');
   if(!request.headers.get('content-type')?.includes('application/json'))throw new MusicError('Expected a song form.',415,'content_type');
   const data=await readJSON(request,32000,400);
   try{makePayload(data,'validation');}catch(error){throw new MusicError(error.message||'Check your song prompt.',400,'validation');}
   release=limits.acquire(user,env);
   const timeout=numericSetting(env.MUSIC_TIMEOUT_MS,600000,10,900000);
   timer=setTimeout(abort,timeout);
   request.signal.addEventListener('abort',abort,{once:true});
   if(request.signal.aborted)abort();
   // Race also bounds providers that fail to honor cancellation.
   const aborted=new Promise((_,reject)=>{
    const stop=()=>reject(new MusicError(request.signal.aborted?'The request was cancelled. The provider may still finish its work.':'Generation timed out. The provider may still finish; retry only when ready.',request.signal.aborted?499:504,request.signal.aborted?'cancelled':'timeout'));
    if(controller.signal.aborted)stop();else controller.signal.addEventListener('abort',stop,{once:true});
   });
   const audio=await Promise.race([provider.generate(data,{env,signal:controller.signal,fetcher}),aborted]);
   return new Response(audio.bytes,{headers:{
    'Content-Type':audio.mime,'Content-Length':String(audio.bytes.byteLength),
    'Content-Disposition':`attachment; filename="${audioFilename(data.title,audio.extension)}"`,
    'Cache-Control':'no-store, max-age=0','X-Content-Type-Options':'nosniff',
    'X-Song-Target-Duration':String(audio.targetDuration)
   }});
  }catch(error){return errorResponse(error);}
  finally{clearTimeout(timer);request.signal.removeEventListener('abort',abort);release?.();}
 };
}
export const musicAPI=createMusicAPI();
