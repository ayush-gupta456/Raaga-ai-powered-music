import handler from 'vinext/server/fetch-handler';
import {musicAPI} from '../lib/music.mjs';
// Retained legacy Sites target. The primary authenticated deployment is Node/Vercel.
const worker={
 async fetch(request:Request,env:Cloudflare.Env,ctx:ExecutionContext){
  if(new URL(request.url).pathname.startsWith('/api/music/'))return musicAPI(request,env);
  const response=await handler.fetch(request,env,ctx);
  const result=new Response(response.body,response);
  result.headers.set('Cache-Control','no-store');
  return result;
 }
};
export default worker;
