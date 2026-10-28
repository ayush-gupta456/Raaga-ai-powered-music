import express from 'express';
import { Readable } from 'node:stream';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createMusicAPI } from '../lib/music.mjs';

export function createApp({env=process.env,api=createMusicAPI(),port=3000}={}) {
 const app=express();app.disable('x-powered-by');
 const origin=`http://127.0.0.1:${port}`;
 app.use((req,res,next)=>{res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');next();});
 app.use('/api/music',express.raw({type:'application/json',limit:'32kb'}),async(req,res)=>{
  const controller=new AbortController();
  const close=()=>{if(!res.writableEnded)controller.abort();};res.on('close',close);
  try {
   const headers=new Headers({'content-type':req.headers['content-type']||'',origin:req.headers.origin||''});
   // This entrypoint is loopback-only, with strict origin checking. Never trust client identity headers.
   headers.set('oai-authenticated-user-id','local-studio');
   const request=new Request(origin+req.originalUrl,{method:req.method,headers,signal:controller.signal,...(['GET','HEAD'].includes(req.method)?{}:{body:req.body?.length?new Uint8Array(req.body):''})});
   const response=await api(request,env);
   res.status(response.status);response.headers.forEach((value,key)=>res.setHeader(key,value));
   if(response.body)Readable.fromWeb(response.body).pipe(res);else res.end();
  }catch{if(!res.headersSent)res.status(502).json({error:'The music service is unavailable. Please retry.'});else res.end();}
 });
 app.use(express.static(resolve('dist-node'),{etag:false,lastModified:false}));
 app.get('/',(_req,res)=>res.sendFile(resolve('dist-node/index.html')));
 app.use((error,_req,res,_next)=>{res.status(error.status===413?413:400).json({error:error.status===413?'The song request is too large.':'Invalid request.'});});
 return app;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const port=Number(process.env.PORT)||3000;
 createApp({port}).listen(port,'127.0.0.1',()=>console.log(`Raaga: http://127.0.0.1:${port}`));
}
